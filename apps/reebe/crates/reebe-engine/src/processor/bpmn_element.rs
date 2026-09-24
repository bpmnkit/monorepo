use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::element_instances::ElementInstance;
#[allow(unused_imports)]
use reebe_db::state::jobs::Job;
use reebe_db::state::variables::Variable;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};
use super::throw_event::{terminate_children, throw_event, ThrowOutcome, Thrown};
use super::catch_event::{
    arm_boundary_events, arm_event_based_gateway, arm_event_subprocesses, close_waits, open_wait,
    scope_interrupted, wait_of,
};
use super::join::{self, JoinScope};
use super::multi_instance;
use super::scope;
use super::{ad_hoc, compensation};

pub struct BpmnElementProcessor;

#[async_trait]
impl RecordProcessor for BpmnElementProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "PROCESS_INSTANCE"
            && matches!(intent, "ACTIVATE_ELEMENT" | "COMPLETE_ELEMENT" | "TERMINATE_ELEMENT")
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        match record.intent.as_str() {
            "ACTIVATE_ELEMENT" => self.activate_element(record, state, writers).await,
            "COMPLETE_ELEMENT" => self.complete_element(record, state, writers).await,
            "TERMINATE_ELEMENT" => self.terminate_element(record, state, writers).await,
            _ => Ok(()),
        }
    }
}

/// Evaluate I/O mappings from a FEEL expression context.
/// Returns Some(vars) with evaluated (target_name, value) pairs on success,
/// or None (plus an incident command queued into writers) on failure.
fn apply_io_mappings(
    mappings: &[reebe_bpmn::ZeebeIoMapping],
    ctx: &reebe_feel::FeelContext,
    process_instance_key: i64,
    element_instance_key: i64,
    bpmn_process_id: &str,
    tenant_id: &str,
    writers: &mut Writers,
) -> Option<Vec<(String, serde_json::Value)>> {
    let mut results = Vec::new();
    for mapping in mappings {
        match reebe_feel::parse_and_evaluate(&mapping.source, ctx) {
            Ok(val) => {
                results.push((mapping.target.clone(), serde_json::Value::from(val)));
            }
            Err(e) => {
                let error_msg = format!(
                    "Failed to evaluate I/O mapping expression '{}' targeting '{}': {}",
                    mapping.source, mapping.target, e
                );
                writers.commands.push(CommandToWrite {
                    value_type: "INCIDENT".to_string(),
                    intent: "CREATE".to_string(),
                    key: 0,
                    payload: serde_json::json!({
                        "errorType": "IO_MAPPING_ERROR",
                        "errorMessage": error_msg,
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementInstanceKey": element_instance_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });
                return None;
            }
        }
    }
    Some(results)
}

/// Extract input_mappings from a FlowElement if it supports them.
pub(crate) fn get_input_mappings(element: &reebe_bpmn::FlowElement) -> &[reebe_bpmn::ZeebeIoMapping] {
    match element {
        reebe_bpmn::FlowElement::StartEvent(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ServiceTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::UserTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ReceiveTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ScriptTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::SendTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::BusinessRuleTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::Task(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::CallActivity(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::SubProcess(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::IntermediateCatchEvent(e) => &e.input_mappings,
        _ => &[],
    }
}

/// Extract output_mappings from a FlowElement if it supports them.
fn get_output_mappings(element: &reebe_bpmn::FlowElement) -> &[reebe_bpmn::ZeebeIoMapping] {
    match element {
        reebe_bpmn::FlowElement::StartEvent(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::ServiceTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::UserTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::ReceiveTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::ScriptTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::SendTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::BusinessRuleTask(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::Task(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::CallActivity(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::SubProcess(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::IntermediateCatchEvent(e) => &e.output_mappings,
        reebe_bpmn::FlowElement::BoundaryEvent(e) => &e.output_mappings,
        _ => &[],
    }
}

impl BpmnElementProcessor {
    async fn activate_element(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;

        let process_instance_key: i64 = payload["processInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processInstanceKey".to_string()))?;

        let process_definition_key: i64 = payload["processDefinitionKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processDefinitionKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processDefinitionKey".to_string()))?;

        let element_id = payload["elementId"]
            .as_str()
            .ok_or_else(|| EngineError::InvalidState("Missing elementId".to_string()))?
            .to_string();

        let flow_scope_key: i64 = payload["flowScopeKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["flowScopeKey"].as_i64())
            .unwrap_or(process_instance_key);

        let bpmn_process_id = payload["bpmnProcessId"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let tenant_id = record.tenant_id.clone();

        // A token that arrives after its flow scope ended (terminated, or completed by
        // a terminate end event) goes nowhere.
        let scope_ei = state.backend.get_element_instance_by_key(flow_scope_key).await.ok();
        if scope_ei.as_ref().is_some_and(|scope| matches!(scope.state.as_str(), "COMPLETED" | "TERMINATED")) {
            return Ok(());
        }

        // Get process definition to find element — try in-memory cache first.
        enum ProcessesSource {
            Cached(std::sync::Arc<crate::process_def_cache::CachedProcessDef>),
            Loaded(Vec<reebe_bpmn::BpmnProcess>, String),
        }

        let source = if let Some(cached) = state.process_def_cache.get_by_key(process_definition_key) {
            ProcessesSource::Cached(cached)
        } else {
            let pd = state.backend.get_process_definition_by_key(process_definition_key).await?;
            let pd_id = pd.bpmn_process_id.clone();
            let parsed = reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
                .map_err(|e| EngineError::BpmnParse(e.to_string()))?;
            ProcessesSource::Loaded(parsed, pd_id)
        };

        let (processes_slice, pd_bpmn_process_id): (&[reebe_bpmn::BpmnProcess], &str) = match &source {
            ProcessesSource::Cached(c) => (&*c.processes, &c.bpmn_process_id),
            ProcessesSource::Loaded(v, id) => (v.as_slice(), id.as_str()),
        };

        let process = processes_slice
            .iter()
            .find(|p| p.id == bpmn_process_id || p.id == pd_bpmn_process_id)
            .ok_or_else(|| EngineError::NotFound(format!("Process {bpmn_process_id}")))?;

        let element = process
            .get_element_recursive(&element_id)
            .ok_or_else(|| EngineError::NotFound(format!("Element {element_id}")))?;

        // Resolving an incident raised while the element was activating retries that
        // same element instance, as Zeebe does, rather than creating another one.
        let retried = match payload["elementInstanceKey"].as_str().and_then(|k| k.parse::<i64>().ok()) {
            Some(key) => state.backend
                .get_element_instance_by_key(key)
                .await
                .ok()
                .filter(|ei| ei.state == "ACTIVATING"),
            None => None,
        };

        // A multi-instance activity activates its body first; the body activates the
        // inner instances, which carry their `loopCounter`.
        let loop_counter = match &retried {
            Some(ei) if element.multi_instance().is_some() && ei.element_type != multi_instance::BODY => state.backend
                .get_variables_by_scope(ei.key)
                .await?
                .into_iter()
                .find(|v| v.name == "loopCounter")
                .and_then(|v| v.value.as_i64()),
            _ => payload["loopCounter"].as_i64(),
        };
        if let (Some(mi), None) = (element.multi_instance(), loop_counter) {
            let body_key = multi_instance::activate_body(state, writers, process, mi, multi_instance::Activation {
                process_instance_key,
                process_definition_key,
                bpmn_process_id: &bpmn_process_id,
                element_id: &element_id,
                flow_scope_key,
                tenant_id: &tenant_id,
            }, retried).await?;
            set_modification_variables(state, payload, process_instance_key, body_key, &tenant_id).await?;
            return compensation::handler_activating(state, payload, process_instance_key, body_key).await;
        }

        if retried.is_none() {
            // A token still on its way when an interrupting event sub-process took over
            // its flow scope goes nowhere.
            if let (true, Some(scope)) = (payload["sequenceFlowId"].is_string(), &scope_ei) {
                if scope_interrupted(state, writers, process, scope, record.position).await? {
                    return Ok(());
                }
            }

            // A joining gateway waits for its tokens before it activates.
            if let Some((gw, inclusive)) = join::joining_gateway(element) {
                let at = JoinScope { process, process_instance_key, flow_scope_key, position: record.position };
                let arrived_on = join::arrived_on(state, &at, gw, payload).await?;
                if !join::arrive(state, writers, &at, gw, inclusive, arrived_on.as_deref()).await? {
                    return Ok(());
                }
            }
        }

        // Determine element type string
        let element_type = element_type_string(element);

        let ei = match retried {
            Some(ei) => ei,
            None => {
                let ei_key = key_gen.next_key().await?;

                // Create element instance in ACTIVATING state
                let ei = ElementInstance {
                    key: ei_key,
                    partition_id: state.partition_id,
                    process_instance_key,
                    process_definition_key,
                    bpmn_process_id: bpmn_process_id.clone(),
                    element_id: element_id.clone(),
                    element_type: element_type.clone(),
                    state: "ACTIVATING".to_string(),
                    flow_scope_key: Some(flow_scope_key),
                    scope_key: Some(ei_key),
                    incident_key: None,
                    tenant_id: tenant_id.clone(),
                };
                state.backend.insert_element_instance(&ei).await?;

                // Write ELEMENT_ACTIVATING event
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATING".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                if let (Some(mi), Some(loop_counter)) = (element.multi_instance(), loop_counter) {
                    multi_instance::init_inner(state, mi, &ei, flow_scope_key, loop_counter).await?;
                }
                set_modification_variables(state, payload, process_instance_key, ei_key, &tenant_id).await?;
                ei
            }
        };
        let ei_key = ei.key;
        // A compensation handler starts with the local variables of the activity it compensates.
        compensation::handler_activating(state, payload, process_instance_key, ei_key).await?;

        // Evaluate input mappings (if any), store results, create incident on failure
        {
            let ctx = scope::feel_context(state, process_instance_key, ei_key).await;

            let input_mappings = get_input_mappings(element);
            if !input_mappings.is_empty() {
                match apply_io_mappings(
                    input_mappings,
                    &ctx,
                    process_instance_key,
                    ei_key,
                    &bpmn_process_id,
                    &tenant_id,
                    writers,
                ) {
                    None => return Ok(()), // incident queued
                    Some(mapped_vars) => {
                        for (name, value) in mapped_vars {
                            let var_key = key_gen.next_key().await?;
                            state.backend.upsert_variable(&Variable {
                                key: var_key,
                                partition_id: state.partition_id,
                                name,
                                value,
                                scope_key: ei_key,
                                process_instance_key,
                                tenant_id: tenant_id.clone(),
                                is_preview: false,
                            }).await?;
                        }
                    }
                }
            }
        }

        let activated_event = serde_json::json!({
            "elementInstanceKey": ei_key.to_string(),
            "processInstanceKey": process_instance_key.to_string(),
            "elementId": element_id,
            "elementType": element_type,
            "bpmnProcessId": bpmn_process_id,
            "tenantId": tenant_id,
        });

        // A catch event whose event already happened — after an event-based gateway,
        // or a boundary event — completes at once, with the event's variables.
        if payload["eventTriggered"].as_bool() == Some(true) {
            state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
            writers.events.push(EventToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "ELEMENT_ACTIVATED".to_string(),
                key: ei_key,
                payload: activated_event,
            });
            writers.commands.push(CommandToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "COMPLETE_ELEMENT".to_string(),
                key: ei_key,
                payload: serde_json::json!({
                    "elementInstanceKey": ei_key.to_string(),
                    "processInstanceKey": process_instance_key.to_string(),
                    "processDefinitionKey": process_definition_key.to_string(),
                    "elementId": element_id,
                    "elementType": element_type,
                    "bpmnProcessId": bpmn_process_id,
                    "flowScopeKey": flow_scope_key.to_string(),
                    "variables": payload["eventVariables"].clone(),
                    "tenantId": tenant_id,
                }),
            });
            return Ok(());
        }

        // An activity arms its timer, message and signal boundary events. Those of a
        // multi-instance activity belong to its body, which armed them.
        let activated_ei = ElementInstance { state: "ACTIVATED".to_string(), ..ei.clone() };
        if element.is_activity() && loop_counter.is_none() {
            arm_boundary_events(state, writers, process, &activated_ei).await?;
        }

        // Element-type-specific activation
        match element {
            reebe_bpmn::FlowElement::StartEvent(_)
            | reebe_bpmn::FlowElement::EndEvent(_) => {
                // Immediately activate, then complete
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                // An error or escalation end event throws before it completes. An error
                // never completes the end event: it is caught (terminating the scope the
                // end event is in) or it raises an incident.
                let thrown = match element {
                    reebe_bpmn::FlowElement::EndEvent(e) => Thrown::from_definition(e.event_definition.as_ref()),
                    _ => None,
                };
                if let Some(thrown) = thrown {
                    let thrower = ElementInstance { state: "ACTIVATED".to_string(), ..ei.clone() };
                    let outcome = throw_event(state, writers, &thrower, &thrown, None).await?;
                    if matches!(thrown, Thrown::Error { .. })
                        || outcome == (ThrowOutcome::Caught { interrupted: true })
                    {
                        return Ok(());
                    }
                }

                // A compensation end event waits for the handlers it invoked.
                if let reebe_bpmn::FlowElement::EndEvent(reebe_bpmn::EndEvent {
                    event_definition: Some(reebe_bpmn::EventDefinition::Compensation(def)), ..
                }) = element
                {
                    if compensation::throw(state, writers, &activated_ei, def.activity_ref.as_deref()).await? {
                        return Ok(());
                    }
                }

                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::BoundaryEvent(_) => {
                // A boundary event that caught its event completes at once. (Compensation
                // boundary events are never activated: they only link an activity to its
                // compensation handler.)
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: activated_event.clone(),
                });
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::ServiceTask(st) => {
                // Create a job for the service task
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                let job_type = st
                    .task_definition
                    .as_ref()
                    .map(|td| td.job_type.clone())
                    .unwrap_or_else(|| element_id.clone());

                writers.commands.push(CommandToWrite {
                    value_type: "JOB".to_string(),
                    intent: "CREATE".to_string(),
                    key: 0,
                    payload: serde_json::json!({
                        "jobType": job_type,
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementInstanceKey": ei_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "elementId": element_id,
                        "retries": 3,
                        "customHeaders": {},
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::UserTask(ut) => {
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                let assignee = ut.assignee.clone();
                let form_key = ut.form_definition.as_ref().map(|fd| fd.form_key.clone());

                writers.commands.push(CommandToWrite {
                    value_type: "USER_TASK".to_string(),
                    intent: "CREATE".to_string(),
                    key: 0,
                    payload: serde_json::json!({
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementInstanceKey": ei_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "elementId": element_id,
                        "assignee": assignee,
                        "formKey": form_key,
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::EventBasedGateway(_) => {
                // Wait for the first of the events after the gateway; that one wins.
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: activated_event.clone(),
                });
                arm_event_based_gateway(state, writers, process, &activated_ei).await?;
            }
            reebe_bpmn::FlowElement::ExclusiveGateway(_)
            | reebe_bpmn::FlowElement::ParallelGateway(_)
            | reebe_bpmn::FlowElement::InclusiveGateway(_) => {
                // An exclusive or inclusive gateway chooses its flows while it activates.
                // When no condition holds and there is no default flow, or a condition
                // does not evaluate to a boolean, it raises an incident and stays
                // activating; resolving the incident evaluates again.
                let outgoing = process.outgoing_flows_recursive(&element_id);
                let taken: Vec<&str> = if matches!(element, reebe_bpmn::FlowElement::ParallelGateway(_)) {
                    outgoing.iter().map(|f| f.id.as_str()).collect()
                } else {
                    let ctx = scope::feel_context(state, process_instance_key, ei_key).await;
                    let chosen = match gateway_flows(element, &outgoing, &ctx) {
                        Ok(Some(flows)) => Ok(flows),
                        // Zeebe's NO_OUTGOING_FLOW_CHOSEN_ERROR, the same for both gateways.
                        Ok(None) => Err((
                            "CONDITION_ERROR",
                            "Expected at least one condition to evaluate to true, or to have a default flow".to_string(),
                        )),
                        Err(message) => Err(("EXTRACT_VALUE_ERROR", message)),
                    };
                    match chosen {
                        Ok(flows) => flows.into_iter().map(|f| f.id.as_str()).collect(),
                        Err((error_type, error_message)) => {
                            writers.commands.push(CommandToWrite {
                                value_type: "INCIDENT".to_string(),
                                intent: "CREATE".to_string(),
                                key: 0,
                                payload: serde_json::json!({
                                    "errorType": error_type,
                                    "errorMessage": error_message,
                                    "processInstanceKey": process_instance_key.to_string(),
                                    "elementInstanceKey": ei_key.to_string(),
                                    "bpmnProcessId": bpmn_process_id,
                                    "tenantId": tenant_id,
                                }),
                            });
                            return Ok(());
                        }
                    }
                };
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                // Completing takes the chosen flows.
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "takenFlows": taken,
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::BusinessRuleTask(brt) => {
                // Evaluate DMN decision and complete immediately
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                // Evaluate the DMN decision and write the result variable
                let mut decision_vars: Option<serde_json::Value> = None;
                if let Some(ref decision_id) = brt.zeebe_called_decision_id.clone() {
                    let input_ctx = serde_json::Value::Object(
                        scope::visible_variables(state, process_instance_key, ei_key).await,
                    );

                    match state.backend.get_dmn_xml_by_decision_id(decision_id).await {
                        Ok(Some(dmn_xml)) => {
                            match reebe_dmn::parse_dmn(&dmn_xml) {
                                Ok(drg) => {
                                    match reebe_dmn::evaluate_decision(&drg, decision_id, &input_ctx) {
                                        Ok(result) => {
                                            let result_var = brt.zeebe_result_variable.as_deref().unwrap_or("result");
                                            let var_key = key_gen.next_key().await?;
                                            state.backend.upsert_variable(&Variable {
                                                key: var_key,
                                                partition_id: state.partition_id,
                                                name: result_var.to_string(),
                                                value: result.clone(),
                                                scope_key: process_instance_key,
                                                process_instance_key,
                                                tenant_id: tenant_id.clone(),
                                                is_preview: false,
                                            }).await?;
                                            decision_vars = Some(serde_json::json!({ result_var: result }));
                                        }
                                        Err(e) => tracing::warn!(decision_id, "DMN evaluation failed: {e}"),
                                    }
                                }
                                Err(e) => tracing::warn!(decision_id, "DMN parse failed: {e}"),
                            }
                        }
                        Ok(None) => tracing::warn!(decision_id, "No DMN found for decision"),
                        Err(e) => tracing::warn!(decision_id, "Backend error looking up DMN: {e}"),
                    }
                }

                let mut complete_payload = serde_json::json!({
                    "elementInstanceKey": ei_key.to_string(),
                    "processInstanceKey": process_instance_key.to_string(),
                    "processDefinitionKey": process_definition_key.to_string(),
                    "elementId": element_id,
                    "elementType": element_type,
                    "bpmnProcessId": bpmn_process_id,
                    "flowScopeKey": flow_scope_key.to_string(),
                    "tenantId": tenant_id,
                });
                if let Some(vars) = decision_vars {
                    complete_payload["variables"] = vars;
                }
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: complete_payload,
                });
            }
            reebe_bpmn::FlowElement::IntermediateCatchEvent(_) => {
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                match wait_of(element) {
                    Some(wait) => open_wait(state, writers, &activated_ei, &element_id, wait).await?,
                    None => {
                        // A catch event with nothing to wait for (e.g. a link) passes through.
                        writers.commands.push(CommandToWrite {
                            value_type: "PROCESS_INSTANCE".to_string(),
                            intent: "COMPLETE_ELEMENT".to_string(),
                            key: ei_key,
                            payload: serde_json::json!({
                                "elementInstanceKey": ei_key.to_string(),
                                "processInstanceKey": process_instance_key.to_string(),
                                "processDefinitionKey": process_definition_key.to_string(),
                                "elementId": element_id,
                                "elementType": element_type,
                                "bpmnProcessId": bpmn_process_id,
                                "flowScopeKey": flow_scope_key.to_string(),
                                "tenantId": tenant_id,
                            }),
                        });
                    }
                }
            }
            reebe_bpmn::FlowElement::ScriptTask(st) => {
                // Evaluate the FEEL script expression immediately and store the result.
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                if let (Some(script), Some(result_var)) = (&st.script, &st.result_variable) {
                    let ctx = scope::feel_context(state, process_instance_key, ei_key).await;
                    let expr = script.trim().strip_prefix('=').unwrap_or(script.trim());
                    if let Ok(val) = reebe_feel::evaluate(expr, &ctx) {
                        let mut result = serde_json::Map::new();
                        result.insert(result_var.clone(), serde_json::Value::from(val));
                        scope::propagate(state, process_instance_key, ei_key, &result, &tenant_id).await?;
                    }
                }

                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::SendTask(st) => {
                // Behaves like a ServiceTask: creates a job that must be completed externally.
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                let job_type = st.task_definition.as_ref()
                    .map(|td| td.job_type.clone())
                    .unwrap_or_else(|| element_id.clone());

                writers.commands.push(CommandToWrite {
                    value_type: "JOB".to_string(),
                    intent: "CREATE".to_string(),
                    key: 0,
                    payload: serde_json::json!({
                        "jobType": job_type,
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementInstanceKey": ei_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "elementId": element_id,
                        "retries": 3,
                        "customHeaders": {},
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::ReceiveTask(_) => {
                // Waits for a message to be published (like IntermediateCatchEvent + message).
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                if let Some(wait) = wait_of(element) {
                    open_wait(state, writers, &activated_ei, &element_id, wait).await?;
                }
            }
            reebe_bpmn::FlowElement::IntermediateThrowEvent(ite) => {
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                // Escalation throw: an interrupting catch ends this path; otherwise continue.
                if let Some(thrown @ Thrown::Escalation { .. }) =
                    Thrown::from_definition(ite.event_definition.as_ref())
                {
                    let thrower = ElementInstance { state: "ACTIVATED".to_string(), ..ei.clone() };
                    let outcome = throw_event(state, writers, &thrower, &thrown, None).await?;
                    if outcome == (ThrowOutcome::Caught { interrupted: true }) {
                        return Ok(());
                    }
                }

                // A compensation throw event waits for the handlers it invoked.
                if let Some(reebe_bpmn::EventDefinition::Compensation(def)) = &ite.event_definition {
                    if compensation::throw(state, writers, &activated_ei, def.activity_ref.as_deref()).await? {
                        return Ok(());
                    }
                }

                // Signal throw: broadcast to all waiting catch events
                if let Some(reebe_bpmn::EventDefinition::Signal(sig)) = &ite.event_definition {
                    writers.commands.push(CommandToWrite {
                        value_type: "SIGNAL".to_string(),
                        intent: "BROADCAST".to_string(),
                        key: 0,
                        payload: serde_json::json!({
                            "signalName": sig.signal_name,
                            "variables": {},
                            "tenantId": tenant_id,
                        }),
                    });
                }

                // Complete the throw event and continue
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
            reebe_bpmn::FlowElement::SubProcess(sp) => {
                // An ad-hoc sub-process run by Zeebe evaluates the elements to activate
                // first; if that fails, it raises an incident and stays activating.
                let ad_hoc_elements = if sp.ad_hoc && sp.task_definition.is_none() {
                    match ad_hoc::active_elements(state, sp, process_instance_key, ei_key).await {
                        Ok(ids) => ids,
                        Err(message) => {
                            writers.commands.push(CommandToWrite {
                                value_type: "INCIDENT".to_string(),
                                intent: "CREATE".to_string(),
                                key: 0,
                                payload: serde_json::json!({
                                    "errorType": "EXTRACT_VALUE_ERROR",
                                    "errorMessage": message,
                                    "processInstanceKey": process_instance_key.to_string(),
                                    "elementInstanceKey": ei_key.to_string(),
                                    "bpmnProcessId": bpmn_process_id,
                                    "tenantId": tenant_id,
                                }),
                            });
                            return Ok(());
                        }
                    }
                } else {
                    Vec::new()
                };

                // Activate the subprocess element and launch its start events.
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                arm_event_subprocesses(state, writers, process, &activated_ei).await?;

                // An ad-hoc sub-process runs its inner elements as they are activated —
                // by `activeElementsCollection`, or by its job's results.
                if sp.ad_hoc {
                    return ad_hoc::activated(state, writers, sp, &activated_ei, &ad_hoc_elements).await;
                }

                // Fire ACTIVATE_ELEMENT for each start event inside the subprocess.
                // Use ei_key as the flowScopeKey so end-event handling can detect the scope.
                // The start event of an event sub-process that a timer, message or signal
                // triggered completes at once with the event's variables.
                for start_id in &sp.start_events {
                    let mut start_payload = serde_json::json!({
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "elementId": start_id,
                        "flowScopeKey": ei_key.to_string(),
                        "tenantId": tenant_id,
                    });
                    if let Some(variables) = payload.get("startEventVariables") {
                        start_payload["eventTriggered"] = serde_json::json!(true);
                        start_payload["eventVariables"] = variables.clone();
                    }
                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: "ACTIVATE_ELEMENT".to_string(),
                        key: process_instance_key,
                        payload: start_payload,
                    });
                }
                // COMPLETE_ELEMENT is fired when the subprocess end event fires (see complete_element).
            }
            reebe_bpmn::FlowElement::CallActivity(ca) => {
                // Spawn a child process instance and wait for it to complete.
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });

                let child_process_id = ca
                    .called_element
                    .as_ref()
                    .map(|ce| ce.process_id.clone())
                    .unwrap_or_default();

                // Collect input variables to pass to child scope.
                let visible = scope::visible_variables(state, process_instance_key, ei_key).await;
                let child_vars: serde_json::Value = if !ca.input_mappings.is_empty() {
                    let ctx = reebe_feel::FeelContext::from_json(serde_json::Value::Object(visible));
                    let mut out = serde_json::Map::new();
                    for m in &ca.input_mappings {
                        if let Ok(val) = reebe_feel::parse_and_evaluate(&m.source, &ctx) {
                            out.insert(m.target.clone(), serde_json::Value::from(val));
                        }
                    }
                    serde_json::Value::Object(out)
                } else {
                    // Propagate all parent variables by default
                    serde_json::Value::Object(visible)
                };

                // Spawn child via PROCESS_INSTANCE_CREATION; include parent linkage so that
                // when the child's end event fires, it can resume this call activity.
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE_CREATION".to_string(),
                    intent: "CREATE".to_string(),
                    key: 0,
                    payload: serde_json::json!({
                        "bpmnProcessId": child_process_id,
                        "version": -1,
                        "variables": child_vars,
                        "parentProcessInstanceKey": process_instance_key.to_string(),
                        "parentElementInstanceKey": ei_key.to_string(),
                    }),
                });
                // COMPLETE_ELEMENT will be sent when the child process completes.
            }
            _ => {
                // Default: activate immediately and complete
                state.backend.update_element_instance_state(ei_key, "ACTIVATED").await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_ACTIVATED".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });
                writers.commands.push(CommandToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "COMPLETE_ELEMENT".to_string(),
                    key: ei_key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "elementId": element_id,
                        "elementType": element_type,
                        "bpmnProcessId": bpmn_process_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
        }

        Ok(())
    }

    async fn complete_element(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;

        let ei_key: i64 = payload["elementInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["elementInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing elementInstanceKey".to_string()))?;

        let process_instance_key: i64 = payload["processInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processInstanceKey".to_string()))?;

        let process_definition_key: i64 = payload["processDefinitionKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processDefinitionKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processDefinitionKey".to_string()))?;

        let element_id = payload["elementId"].as_str().unwrap_or("").to_string();
        let element_type = payload["elementType"].as_str().unwrap_or("").to_string();
        let bpmn_process_id = payload["bpmnProcessId"].as_str().unwrap_or("").to_string();
        let flow_scope_key: i64 = payload["flowScopeKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["flowScopeKey"].as_i64())
            .unwrap_or(process_instance_key);
        let tenant_id = record.tenant_id.clone();

        // A job, message or timer can still arrive for an element that a caught error
        // or escalation has terminated; it no longer completes anything.
        let current = state.backend.get_element_instance_by_key(ei_key).await.ok();
        if current.as_ref().is_some_and(|c| c.state == "TERMINATED") {
            return Ok(());
        }
        // The element instance's own flow scope is authoritative: a called process
        // completing its call activity names the calling process instance instead.
        let flow_scope_key = current.as_ref().and_then(|c| c.flow_scope_key).unwrap_or(flow_scope_key);
        let is_mi_body = element_type == multi_instance::BODY;
        let mi_body = match state.backend.get_element_instance_by_key(flow_scope_key).await {
            Ok(scope_ei) if !is_mi_body && scope_ei.element_type == multi_instance::BODY => Some(scope_ei),
            _ => None,
        };
        let definition = match state.backend.get_process_definition_by_key(process_definition_key).await {
            Ok(pd) => reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
                .ok()
                .and_then(|ps| ps.into_iter().find(|p| p.id == bpmn_process_id || p.id == pd.bpmn_process_id)),
            Err(_) => None,
        };
        let multi_instance_of = definition
            .as_ref()
            .and_then(|p| p.get_element_recursive(&element_id))
            .and_then(|e| e.multi_instance())
            .cloned();

        // Transition through COMPLETING -> COMPLETED
        state.backend.update_element_instance_state(ei_key, "COMPLETING").await?;
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_COMPLETING".to_string(),
            key: ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": ei_key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "elementId": element_id,
                "elementType": element_type,
                "bpmnProcessId": bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });

        // An ad-hoc sub-process ends what still runs inside it and hands on its output collection.
        if let (Some(reebe_bpmn::FlowElement::SubProcess(sp)), Some(ad_hoc_ei)) = (
            definition.as_ref().and_then(|p| p.get_element_recursive(&element_id)).filter(|_| !is_mi_body),
            &current,
        ) {
            if sp.ad_hoc {
                terminate_children(state, writers, ad_hoc_ei).await?;
                ad_hoc::completing(state, sp, ad_hoc_ei).await?;
            }
        }

        // Evaluate output mappings (if any), store results, create incident on failure.
        // A multi-instance body has none of its own: they apply to each inner instance.
        if let Some(element) = definition.as_ref().and_then(|p| p.get_element_recursive(&element_id)).filter(|_| !is_mi_body) {
            let job_vars = payload.get("variables").and_then(|v| v.as_object());
            let output_mappings = get_output_mappings(element);
            if !output_mappings.is_empty() {
                let mut ctx_map = scope::visible_variables(state, process_instance_key, ei_key).await;
                // Merge job-returned variables from the COMPLETE_ELEMENT payload so
                // that output mappings like `=response.body.id` can reference them.
                if let Some(job_vars) = job_vars {
                    for (k, v) in job_vars {
                        ctx_map.insert(k.clone(), v.clone());
                    }
                }
                let ctx = reebe_feel::FeelContext::from_json(serde_json::Value::Object(ctx_map));

                match apply_io_mappings(
                    output_mappings,
                    &ctx,
                    process_instance_key,
                    ei_key,
                    &bpmn_process_id,
                    &tenant_id,
                    writers,
                ) {
                    None => return Ok(()), // incident queued
                    Some(mapped_vars) => {
                        // Mapped variables leave the element; an inner multi-instance
                        // instance may update its own local output element with them.
                        let from = if mi_body.is_some() { ei_key } else { flow_scope_key };
                        let mapped: serde_json::Map<String, serde_json::Value> = mapped_vars.into_iter().collect();
                        scope::propagate(state, process_instance_key, from, &mapped, &tenant_id).await?;
                    }
                }
            } else if let Some(job_vars) = job_vars {
                // No output mappings: Zeebe merges every variable the job completed
                // with, each into the nearest scope that has it, else the process.
                scope::propagate(state, process_instance_key, ei_key, job_vars, &tenant_id).await?;
            }
        }

        // An inner multi-instance instance: collect its output and check the completion
        // condition before it completes, so that a condition that is not a boolean
        // leaves it completing with an incident, as in Zeebe.
        let mut completion_condition_met = false;
        if let (Some(mi), Some(body), Some(inner)) = (&multi_instance_of, &mi_body, &current) {
            match multi_instance::inner_completing(state, mi, inner, body).await? {
                Ok(met) => completion_condition_met = met,
                Err(message) => {
                    writers.commands.push(CommandToWrite {
                        value_type: "INCIDENT".to_string(),
                        intent: "CREATE".to_string(),
                        key: 0,
                        payload: serde_json::json!({
                            "errorType": "EXTRACT_VALUE_ERROR",
                            "errorMessage": message,
                            "processInstanceKey": process_instance_key.to_string(),
                            "elementInstanceKey": ei_key.to_string(),
                            "bpmnProcessId": bpmn_process_id,
                            "tenantId": tenant_id,
                        }),
                    });
                    return Ok(());
                }
            }
        }

        // An event sub-process of an ad-hoc sub-process ends a path in it: as in Zeebe's
        // `beforeExecutionPathCompleted`, the ad-hoc sub-process's completion condition is
        // evaluated before the event sub-process completes. A result that is not a
        // boolean raises an incident on the event sub-process, which stays completing;
        // resolving it completes the event sub-process again.
        let mut ad_hoc_fulfilled = None;
        if element_type == "EVENT_SUB_PROCESS" {
            if let Ok(ad_hoc_ei) = state.backend.get_element_instance_by_key(flow_scope_key).await {
                if let (ad_hoc::AD_HOC, Some(reebe_bpmn::FlowElement::SubProcess(sp))) = (
                    ad_hoc_ei.element_type.as_str(),
                    definition.as_ref().and_then(|p| p.get_element_recursive(&ad_hoc_ei.element_id)),
                ) {
                    match ad_hoc::completion_condition(state, sp, &ad_hoc_ei).await? {
                        Ok(fulfilled) => ad_hoc_fulfilled = fulfilled,
                        Err(message) => {
                            writers.commands.push(CommandToWrite {
                                value_type: "INCIDENT".to_string(),
                                intent: "CREATE".to_string(),
                                key: 0,
                                payload: serde_json::json!({
                                    "errorType": "EXTRACT_VALUE_ERROR",
                                    "errorMessage": message,
                                    "processInstanceKey": process_instance_key.to_string(),
                                    "elementInstanceKey": ei_key.to_string(),
                                    "bpmnProcessId": bpmn_process_id,
                                    "tenantId": tenant_id,
                                }),
                            });
                            return Ok(());
                        }
                    }
                }
            }
        }

        state.backend.update_element_instance_state(ei_key, "COMPLETED").await?;
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_COMPLETED".to_string(),
            key: ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": ei_key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "elementId": element_id,
                "elementType": element_type,
                "bpmnProcessId": bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });
        // Its boundary timers and subscriptions, and anything else it waited on, end with it.
        close_waits(state, ei_key).await?;

        if let Some(mi) = &multi_instance_of {
            if let (Some(body), Some(inner)) = (&mi_body, &current) {
                // An inner instance: the body decides what happens next.
                let inner = ElementInstance { state: "COMPLETED".to_string(), ..inner.clone() };
                return multi_instance::inner_completed(state, writers, mi, &inner, body, completion_condition_met).await;
            }
            if let (true, Some(body)) = (is_mi_body, &current) {
                multi_instance::body_completed(state, mi, body).await?;
            }
        }

        // A completed activity with a compensation handler can be compensated later; a
        // completed compensation handler may let its throw event continue.
        if let (Some(process), Some(completed)) = (definition.as_ref(), &current) {
            let completed = ElementInstance { state: "COMPLETED".to_string(), ..completed.clone() };
            compensation::activity_completed(state, process, &completed).await?;
            compensation::handler_completed(state, writers, &completed).await?;
        }

        // An element without an outgoing sequence flow ends its path: an end event, an
        // event sub-process, or an activity without one. Its flow scope completes once
        // nothing inside it is active any more. A terminate end event first terminates
        // everything else in its flow scope.
        let element = definition.as_ref().and_then(|p| p.get_element_recursive(&element_id));
        // A link throw event continues at the link catch event of its name.
        let link_catch = definition.as_ref().and_then(|p| p.link_catch_event(&element_id)).map(str::to_string);
        let ends_path = link_catch.is_none() && (element_type == "END_EVENT"
            || definition.as_ref().is_some_and(|p| element.is_some() && p.outgoing_flows_recursive(&element_id).is_empty()));
        if ends_path {
            let terminates = matches!(
                element,
                Some(reebe_bpmn::FlowElement::EndEvent(e)) if matches!(e.event_definition, Some(reebe_bpmn::EventDefinition::Terminate))
            );
            if terminates {
                if let Ok(scope) = state.backend.get_element_instance_by_key(flow_scope_key).await {
                    terminate_children(state, writers, &scope).await?;
                }
            } else if let Some(process) = definition.as_ref().filter(|p| join::has_inclusive_join(p)) {
                // An inclusive join of the scope waiting for this path activates now.
                let at = JoinScope { process, process_instance_key, flow_scope_key, position: record.position };
                join::reevaluate_inclusive_joins(state, writers, &at, &join_context(process_instance_key, process_definition_key, &bpmn_process_id, &tenant_id)).await?;
            }
            return complete_flow_scope(state, writers, record.position, FlowScope {
                key: flow_scope_key,
                process_instance_key,
                process_definition_key,
                bpmn_process_id: &bpmn_process_id,
                tenant_id: &tenant_id,
            }, terminates, ad_hoc_fulfilled).await;
        }

        // Get outgoing sequence flows and activate targets
        let pd = state.backend.get_process_definition_by_key(process_definition_key).await?;
        let processes = reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
            .map_err(|e| EngineError::BpmnParse(e.to_string()))?;
        let process = processes
            .iter()
            .find(|p| p.id == bpmn_process_id || p.id == pd.bpmn_process_id)
            .ok_or_else(|| EngineError::NotFound(format!("Process {bpmn_process_id}")))?;

        let outgoing = process.outgoing_flows_recursive(&element_id);

        let element = process.get_element_recursive(&element_id);
        let taken: Vec<&reebe_bpmn::SequenceFlow> = if let Some(ids) = payload["takenFlows"].as_array() {
            // A gateway chose its flows when it activated.
            outgoing.iter().copied().filter(|f| ids.iter().any(|id| id.as_str() == Some(f.id.as_str()))).collect()
        } else {
            match element {
                Some(gw @ (reebe_bpmn::FlowElement::ExclusiveGateway(_) | reebe_bpmn::FlowElement::InclusiveGateway(_))) => {
                    let feel_ctx = scope::feel_context(state, process_instance_key, flow_scope_key).await;
                    gateway_flows(gw, &outgoing, &feel_ctx).ok().flatten().unwrap_or_default()
                }
                // Every other element takes all its outgoing flows: Zeebe evaluates
                // conditions only at exclusive and inclusive gateways, and ignores them
                // elsewhere (a parallel gateway's, an activity's).
                _ => outgoing.clone(),
            }
        };

        for flow in taken {
            let flow_key = key_gen.next_key().await?;
            writers.events.push(EventToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "SEQUENCE_FLOW_TAKEN".to_string(),
                key: flow_key,
                payload: serde_json::json!({
                    "flowKey": flow_key.to_string(),
                    "elementId": flow.id,
                    "processInstanceKey": process_instance_key.to_string(),
                    "processDefinitionKey": process_definition_key.to_string(),
                    "bpmnProcessId": bpmn_process_id,
                    "sourceElementId": element_id,
                    "targetElementId": flow.target_ref,
                    "tenantId": tenant_id,
                }),
            });
            writers.commands.push(CommandToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "ACTIVATE_ELEMENT".to_string(),
                key: process_instance_key,
                payload: serde_json::json!({
                    "processInstanceKey": process_instance_key.to_string(),
                    "processDefinitionKey": process_definition_key.to_string(),
                    "bpmnProcessId": bpmn_process_id,
                    "elementId": flow.target_ref,
                    "flowScopeKey": flow_scope_key.to_string(),
                    "sequenceFlowId": flow.id,
                    "tenantId": tenant_id,
                }),
            });
        }

        if let Some(catch_id) = &link_catch {
            writers.commands.push(CommandToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "ACTIVATE_ELEMENT".to_string(),
                key: process_instance_key,
                payload: serde_json::json!({
                    "processInstanceKey": process_instance_key.to_string(),
                    "processDefinitionKey": process_definition_key.to_string(),
                    "bpmnProcessId": bpmn_process_id,
                    "elementId": catch_id,
                    "flowScopeKey": flow_scope_key.to_string(),
                    "tenantId": tenant_id,
                }),
            });
        }

        // This element's tokens have moved on: an inclusive join waiting for them may
        // now see its untaken flows out of reach.
        if join::has_inclusive_join(process) {
            let at = JoinScope { process, process_instance_key, flow_scope_key, position: record.position };
            join::reevaluate_inclusive_joins(state, writers, &at, &join_context(process_instance_key, process_definition_key, &bpmn_process_id, &tenant_id)).await?;
        }

        Ok(())
    }

    async fn terminate_element(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;

        let ei_key: i64 = payload["elementInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["elementInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing elementInstanceKey".to_string()))?;

        let process_instance_key: i64 = payload["processInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processInstanceKey".to_string()))?;

        let element_id = payload["elementId"].as_str().unwrap_or("").to_string();
        let element_type = payload["elementType"].as_str().unwrap_or("").to_string();
        let bpmn_process_id = payload["bpmnProcessId"].as_str().unwrap_or("").to_string();
        let tenant_id = record.tenant_id.clone();

        state.backend.update_element_instance_state(ei_key, "TERMINATED").await?;
        close_waits(state, ei_key).await?;

        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_TERMINATED".to_string(),
            key: ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": ei_key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "elementId": element_id,
                "elementType": element_type,
                "bpmnProcessId": bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });

        // Check if process is done
        let active_count = state.backend.get_active_element_instance_count(process_instance_key).await?;
        if active_count <= 0 {
            state.backend
                .update_process_instance_state(process_instance_key, "CANCELED", Some(state.clock.now()))
                .await?;
            super::start_event::instance_ended(state, writers, process_instance_key).await?;
        }

        Ok(())
    }
}

/// The variables a process instance modification gives the element it activates,
/// local to its new element instance before its input mappings apply.
async fn set_modification_variables(
    state: &EngineState,
    payload: &serde_json::Value,
    process_instance_key: i64,
    element_instance_key: i64,
    tenant_id: &str,
) -> EngineResult<()> {
    for (name, value) in payload["localVariables"].as_object().into_iter().flatten() {
        scope::set_local(state, process_instance_key, element_instance_key, name, value.clone(), tenant_id).await?;
    }
    Ok(())
}

/// The flow scope a path ended in: an embedded or event sub-process, or the process.
struct FlowScope<'a> {
    key: i64,
    process_instance_key: i64,
    process_definition_key: i64,
    bpmn_process_id: &'a str,
    tenant_id: &'a str,
}

/// Complete a flow scope in which a path ended, as Zeebe does: only once no element
/// instance is active inside it and no token is on its way to one. After a terminate
/// end event (`terminated_rest`), the rest of the scope has been terminated and it
/// completes at once. An ad-hoc sub-process decides itself, each time a path in it
/// ends, with `ad_hoc_fulfilled`, its completion condition's result.
async fn complete_flow_scope(
    state: &EngineState,
    writers: &mut Writers,
    position: i64,
    scope: FlowScope<'_>,
    terminated_rest: bool,
    ad_hoc_fulfilled: Option<bool>,
) -> EngineResult<()> {
    let FlowScope { key, process_instance_key, process_definition_key, bpmn_process_id, tenant_id } = scope;
    let scope_ei = state.backend.get_element_instance_by_key(key).await.ok();
    let sub_process = scope_ei.filter(|ei| ei.element_type != "PROCESS");
    let is_ad_hoc = sub_process.as_ref().is_some_and(|sp| sp.element_type == ad_hoc::AD_HOC);

    if !terminated_rest && !is_ad_hoc {
        let still_active = match &sub_process {
            Some(sp) => state.backend
                .get_element_instances_by_process_instance(process_instance_key)
                .await?
                .iter()
                .any(|ei| ei.flow_scope_key == Some(sp.key) && !matches!(ei.state.as_str(), "COMPLETED" | "TERMINATED")),
            None => state.backend.get_active_element_instance_count(process_instance_key).await? > 0,
        };
        // A token waiting at a join is active in its flow scope, even if the join can
        // never activate.
        let join_waiting = state.backend
            .get_join_tokens(process_instance_key)
            .await?
            .iter()
            .any(|t| sub_process.is_none() || t.flow_scope_key == key);
        if still_active || join_waiting {
            return Ok(());
        }
        // A sequence flow taken to an element of the scope that has not activated yet.
        let key_text = key.to_string();
        let activating = writers.commands.iter().any(|c| {
            c.intent == "ACTIVATE_ELEMENT" && c.payload["flowScopeKey"].as_str() == Some(key_text.as_str())
        });
        if activating
            || state.backend.has_pending_activation(state.partition_id, position, "flowScopeKey", &key_text).await?
        {
            return Ok(());
        }
    }

    if let Some(sp_ei) = sub_process {
        if sp_ei.state != "ACTIVATED" {
            return Ok(());
        }
        // A flow inside an ad-hoc sub-process ended: the ad-hoc sub-process decides.
        if matches!(sp_ei.element_type.as_str(), ad_hoc::INNER | ad_hoc::AD_HOC) {
            let process = super::throw_event::load_process(state, process_definition_key, bpmn_process_id).await?;
            if sp_ei.element_type == ad_hoc::INNER {
                return ad_hoc::inner_completed(state, writers, &process, &sp_ei).await;
            }
            if let Some(reebe_bpmn::FlowElement::SubProcess(sp)) = process.get_element_recursive(&sp_ei.element_id) {
                return ad_hoc::flow_ended(state, writers, sp, &sp_ei, ad_hoc_fulfilled).await;
            }
            return Ok(());
        }
        // Complete the subprocess.
        state.backend.update_element_instance_state(sp_ei.key, "COMPLETED").await?;
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_COMPLETED".to_string(),
            key: sp_ei.key,
            payload: serde_json::json!({
                "elementInstanceKey": sp_ei.key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "elementId": sp_ei.element_id,
                "elementType": sp_ei.element_type,
                "bpmnProcessId": bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });
        // Fire COMPLETE_ELEMENT for the subprocess so the outer flow is activated.
        writers.commands.push(CommandToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "COMPLETE_ELEMENT".to_string(),
            key: sp_ei.key,
            payload: serde_json::json!({
                "elementInstanceKey": sp_ei.key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "processDefinitionKey": process_definition_key.to_string(),
                "elementId": sp_ei.element_id,
                "elementType": sp_ei.element_type,
                "bpmnProcessId": bpmn_process_id,
                "flowScopeKey": sp_ei.flow_scope_key.unwrap_or(process_instance_key).to_string(),
                "tenantId": tenant_id,
            }),
        });
        return Ok(());
    }

    let pi = state.backend.get_process_instance_by_key(process_instance_key).await?;
    if pi.state != "ACTIVE" {
        return Ok(());
    }
    // Mark the PROCESS-level element instance as COMPLETED; the event sub-processes
    // it armed are disarmed.
    state.backend.complete_process_element(process_instance_key).await?;
    for process_ei in state.backend
        .get_element_instances_by_process_instance(process_instance_key)
        .await?
        .iter()
        .filter(|ei| ei.element_type == "PROCESS")
    {
        close_waits(state, process_ei.key).await?;
    }

    // Complete the process instance itself
    state.backend
        .update_process_instance_state(process_instance_key, "COMPLETED", Some(state.clock.now()))
        .await?;
    writers.events.push(EventToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "ELEMENT_COMPLETED".to_string(),
        key: process_instance_key,
        payload: serde_json::json!({
            "elementInstanceKey": process_instance_key.to_string(),
            "processInstanceKey": process_instance_key.to_string(),
            "elementId": bpmn_process_id,
            "elementType": "PROCESS",
            "bpmnProcessId": bpmn_process_id,
            "tenantId": tenant_id,
        }),
    });
    super::start_event::instance_ended(state, writers, process_instance_key).await?;

    // If this is a child process (called via call activity), resume the parent.
    if let (Some(parent_pi_key), Some(call_ei_key)) =
        (pi.parent_process_instance_key, pi.parent_element_instance_key)
    {
        // Retrieve the call activity element instance to get parent process def key
        // and element ID — needed for output mapping evaluation.
        let call_ei = state.backend.get_element_instance_by_key(call_ei_key).await?;

        // Propagate child output variables to parent scope via output mappings.
        // If the call activity has output mappings they will be evaluated by
        // complete_element; we pass the child's variables in the payload.
        let child_vars = {
            let vs = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
            let mut m = serde_json::Map::new();
            for v in vs { m.insert(v.name, v.value); }
            serde_json::Value::Object(m)
        };

        writers.commands.push(CommandToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "COMPLETE_ELEMENT".to_string(),
            key: call_ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": call_ei_key.to_string(),
                "processInstanceKey": parent_pi_key.to_string(),
                "processDefinitionKey": call_ei.process_definition_key.to_string(),
                "elementId": call_ei.element_id,
                "elementType": "CALL_ACTIVITY",
                "bpmnProcessId": call_ei.bpmn_process_id,
                "flowScopeKey": parent_pi_key.to_string(),
                "variables": child_vars,
                "tenantId": tenant_id,
            }),
        });
    }
    Ok(())
}

/// The fields of an `ACTIVATE_ELEMENT` command that re-evaluates a join.
fn join_context(process_instance_key: i64, process_definition_key: i64, bpmn_process_id: &str, tenant_id: &str) -> serde_json::Value {
    serde_json::json!({
        "processInstanceKey": process_instance_key.to_string(),
        "processDefinitionKey": process_definition_key.to_string(),
        "bpmnProcessId": bpmn_process_id,
        "tenantId": tenant_id,
    })
}

/// The flows an exclusive or inclusive gateway takes: `Ok(None)` when no condition
/// holds and there is no default flow (Zeebe's `CONDITION_ERROR`), `Err` with the
/// incident message when a condition does not evaluate to a boolean (Zeebe's
/// `EXTRACT_VALUE_ERROR`; the conditions after it are not evaluated).
///
/// An exclusive gateway takes the first flow whose condition holds, else its default
/// flow; a flow without a condition that is not the default is taken last. An
/// inclusive gateway takes every non-default flow whose condition holds (a flow
/// without a condition always does), else its default flow.
fn gateway_flows<'a>(
    element: &reebe_bpmn::FlowElement,
    outgoing: &[&'a reebe_bpmn::SequenceFlow],
    ctx: &reebe_feel::FeelContext,
) -> Result<Option<Vec<&'a reebe_bpmn::SequenceFlow>>, String> {
    let (gw, inclusive) = match element {
        reebe_bpmn::FlowElement::ExclusiveGateway(gw) => (gw, false),
        reebe_bpmn::FlowElement::InclusiveGateway(gw) => (gw, true),
        _ => return Ok(Some(outgoing.to_vec())),
    };
    if outgoing.is_empty() {
        return Ok(Some(Vec::new()));
    }
    let is_default = |f: &reebe_bpmn::SequenceFlow| f.is_default || gw.default_flow.as_deref() == Some(f.id.as_str());
    let has_condition = |f: &reebe_bpmn::SequenceFlow| f.condition_expression.as_ref().is_some_and(|c| !c.trim().is_empty());
    let default = outgoing.iter().copied().find(|f| is_default(f));
    let mut taken = Vec::new();
    for flow in outgoing.iter().copied().filter(|f| !is_default(f) && (inclusive || has_condition(f))) {
        if eval_flow_condition(&flow.condition_expression, ctx)? {
            taken.push(flow);
            if !inclusive {
                break;
            }
        }
    }
    if taken.is_empty() && !inclusive {
        taken.extend(outgoing.iter().copied().find(|f| !is_default(f) && !has_condition(f)).filter(|_| default.is_none()));
    }
    Ok(if taken.is_empty() { default.map(|f| vec![f]) } else { Some(taken) })
}

/// Evaluate a sequence flow condition: `true` without one. A condition must evaluate
/// to a boolean, as in Zeebe; anything else (`null` for a missing variable, too) or
/// an evaluation error is `Err` with the incident message.
fn eval_flow_condition(condition: &Option<String>, ctx: &reebe_feel::FeelContext) -> Result<bool, String> {
    let Some(cond) = condition.as_deref().map(str::trim).filter(|c| !c.is_empty()) else { return Ok(true) };
    eval_boolean(cond, ctx)
}

/// Evaluate a condition that must be a boolean, as Zeebe's `evaluateBooleanExpression`
/// does: any other result (`null` for a missing variable, too) or an evaluation error is
/// `Err` with the `EXTRACT_VALUE_ERROR` incident message. The leading `=` is optional.
pub(crate) fn eval_boolean(condition: &str, ctx: &reebe_feel::FeelContext) -> Result<bool, String> {
    let cond = condition.trim();
    let expr = cond.strip_prefix('=').unwrap_or(cond).trim();
    match reebe_feel::evaluate(expr, ctx) {
        Ok(reebe_feel::FeelValue::Bool(holds)) => Ok(holds),
        Ok(other) => Err(format!(
            "Expected result of the expression '{expr}' to be 'BOOLEAN', but was '{}'.",
            zeebe_result_type(&other),
        )),
        Err(e) => Err(format!("Expected result of the expression '{expr}' to be 'BOOLEAN', but it failed to evaluate: {e}")),
    }
}

/// The name Zeebe's expression language gives the type of a result.
fn zeebe_result_type(value: &reebe_feel::FeelValue) -> &'static str {
    use reebe_feel::FeelValue;
    match value {
        FeelValue::Null => "NULL",
        FeelValue::Bool(_) => "BOOLEAN",
        FeelValue::Integer(_) | FeelValue::Float(_) => "NUMBER",
        FeelValue::String(_) => "STRING",
        FeelValue::List(_) => "ARRAY",
        FeelValue::Context(_) => "OBJECT",
        FeelValue::DateTime(_) => "DATE_TIME",
        FeelValue::Duration(_) => "DURATION",
        FeelValue::Date(_) | FeelValue::Time(_) | FeelValue::Range { .. } => "UNKNOWN",
    }
}

fn element_type_string(element: &reebe_bpmn::FlowElement) -> String {
    match element {
        reebe_bpmn::FlowElement::StartEvent(_) => "START_EVENT".to_string(),
        reebe_bpmn::FlowElement::EndEvent(_) => "END_EVENT".to_string(),
        reebe_bpmn::FlowElement::ServiceTask(_) => "SERVICE_TASK".to_string(),
        reebe_bpmn::FlowElement::UserTask(_) => "USER_TASK".to_string(),
        reebe_bpmn::FlowElement::ReceiveTask(_) => "RECEIVE_TASK".to_string(),
        reebe_bpmn::FlowElement::ScriptTask(_) => "SCRIPT_TASK".to_string(),
        reebe_bpmn::FlowElement::SendTask(_) => "SEND_TASK".to_string(),
        reebe_bpmn::FlowElement::BusinessRuleTask(_) => "BUSINESS_RULE_TASK".to_string(),
        reebe_bpmn::FlowElement::Task(_) => element.bpmn_element_type().to_string(),
        reebe_bpmn::FlowElement::CallActivity(_) => "CALL_ACTIVITY".to_string(),
        reebe_bpmn::FlowElement::SubProcess(sp) if sp.ad_hoc => "AD_HOC_SUB_PROCESS".to_string(),
        reebe_bpmn::FlowElement::SubProcess(sp) if sp.triggered_by_event => "EVENT_SUB_PROCESS".to_string(),
        reebe_bpmn::FlowElement::SubProcess(_) => "SUB_PROCESS".to_string(),
        reebe_bpmn::FlowElement::ParallelGateway(_) => "PARALLEL_GATEWAY".to_string(),
        reebe_bpmn::FlowElement::ExclusiveGateway(_) => "EXCLUSIVE_GATEWAY".to_string(),
        reebe_bpmn::FlowElement::InclusiveGateway(_) => "INCLUSIVE_GATEWAY".to_string(),
        reebe_bpmn::FlowElement::EventBasedGateway(_) => "EVENT_BASED_GATEWAY".to_string(),
        reebe_bpmn::FlowElement::IntermediateCatchEvent(_) => "INTERMEDIATE_CATCH_EVENT".to_string(),
        reebe_bpmn::FlowElement::IntermediateThrowEvent(_) => "INTERMEDIATE_THROW_EVENT".to_string(),
        reebe_bpmn::FlowElement::BoundaryEvent(_) => "BOUNDARY_EVENT".to_string(),
    }
}
