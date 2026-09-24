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
use super::catch_event::{arm_boundary_events, arm_event_based_gateway, close_waits, open_wait, wait_of};
use super::multi_instance;
use super::scope;

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
fn get_input_mappings(element: &reebe_bpmn::FlowElement) -> &[reebe_bpmn::ZeebeIoMapping] {
    match element {
        reebe_bpmn::FlowElement::StartEvent(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ServiceTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::UserTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ReceiveTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::ScriptTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::SendTask(e) => &e.input_mappings,
        reebe_bpmn::FlowElement::BusinessRuleTask(e) => &e.input_mappings,
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
        if let Ok(scope) = state.backend.get_element_instance_by_key(flow_scope_key).await {
            if matches!(scope.state.as_str(), "COMPLETED" | "TERMINATED") {
                return Ok(());
            }
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

        // A multi-instance activity activates its body first; the body activates the
        // inner instances, which carry their `loopCounter`.
        let loop_counter = payload["loopCounter"].as_i64();
        if let (Some(mi), None) = (element.multi_instance(), loop_counter) {
            return multi_instance::activate_body(state, writers, process, mi, multi_instance::Activation {
                process_instance_key,
                process_definition_key,
                bpmn_process_id: &bpmn_process_id,
                element_id: &element_id,
                flow_scope_key,
                tenant_id: &tenant_id,
            }).await;
        }

        // Parallel join gateway: count tokens before creating an element instance.
        if let reebe_bpmn::FlowElement::ParallelGateway(gw) = element {
            let incoming_count = gw.incoming.len() as i32;
            if incoming_count > 1 {
                let count = state.backend
                    .increment_and_get_gateway_token(process_instance_key, &element_id)
                    .await?;
                if count < incoming_count {
                    // Not all tokens have arrived yet — wait silently.
                    return Ok(());
                }
                // All tokens arrived. Clean up and proceed to activate once.
                state.backend
                    .delete_gateway_token(process_instance_key, &element_id)
                    .await?;
            }
        }

        // Determine element type string
        let element_type = element_type_string(element);

        // Generate element instance key
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
                // Check for compensation end event
                let is_compensation_end = matches!(
                    element,
                    reebe_bpmn::FlowElement::EndEvent(e)
                        if matches!(&e.event_definition, Some(reebe_bpmn::EventDefinition::Compensation))
                );

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

                if is_compensation_end {
                    // Find all completed elements in this scope that have a compensation boundary event
                    let all_instances = state.backend.get_element_instances_by_process_instance(process_instance_key).await.unwrap_or_default();

                    // Collect completed element IDs (in order, for LIFO we reverse later)
                    let completed_element_ids: Vec<String> = all_instances
                        .iter()
                        .filter(|ei| ei.state == "COMPLETED" && ei.key != ei_key)
                        .map(|ei| ei.element_id.clone())
                        .collect();

                    // Find boundary events of type COMPENSATION attached to completed elements
                    let mut compensation_handlers: Vec<String> = Vec::new();
                    for (id, elem) in &process.elements {
                        if let reebe_bpmn::FlowElement::BoundaryEvent(be) = elem {
                            if matches!(&be.event_definition, Some(reebe_bpmn::EventDefinition::Compensation)) {
                                if completed_element_ids.contains(&be.attached_to_ref) {
                                    compensation_handlers.push(id.clone());
                                }
                            }
                        }
                    }

                    // Activate in reverse order (LIFO compensation semantics)
                    compensation_handlers.reverse();
                    for handler_id in compensation_handlers {
                        writers.commands.push(CommandToWrite {
                            value_type: "PROCESS_INSTANCE".to_string(),
                            intent: "ACTIVATE_ELEMENT".to_string(),
                            key: process_instance_key,
                            payload: serde_json::json!({
                                "processInstanceKey": process_instance_key.to_string(),
                                "processDefinitionKey": process_definition_key.to_string(),
                                "bpmnProcessId": bpmn_process_id,
                                "elementId": handler_id,
                                "flowScopeKey": flow_scope_key.to_string(),
                                "tenantId": tenant_id,
                            }),
                        });
                    }

                    // Still schedule completion of the compensation end event itself
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
                } else {
                    // Schedule completion
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
            reebe_bpmn::FlowElement::BoundaryEvent(be) => {
                // Handle compensation boundary event activation
                let is_compensation = matches!(
                    &be.event_definition,
                    Some(reebe_bpmn::EventDefinition::Compensation)
                );

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

                if is_compensation {
                    // Find the outgoing elements of this compensation handler boundary event
                    // and activate them (the compensation task)
                    let outgoing = process.outgoing_flows_recursive(&element_id);
                    for flow in outgoing {
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
                                "tenantId": tenant_id,
                            }),
                        });
                    }

                    // Also complete this boundary event element
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
                } else {
                    // Non-compensation boundary events just complete normally
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
                // Evaluate gateway and take appropriate outgoing flows
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

                // For gateways, schedule completion to evaluate outgoing flows
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

                // An ad-hoc sub-process with a job worker implementation (the AI Agent
                // Sub-process connector) is driven by that job: the worker decides which
                // inner elements to run. Completing the job completes the sub-process;
                // activating inner elements from the job result is not supported.
                if sp.ad_hoc {
                    match &sp.task_definition {
                        Some(td) => writers.commands.push(CommandToWrite {
                            value_type: "JOB".to_string(),
                            intent: "CREATE".to_string(),
                            key: 0,
                            payload: serde_json::json!({
                                "jobType": td.job_type,
                                "processInstanceKey": process_instance_key.to_string(),
                                "elementInstanceKey": ei_key.to_string(),
                                "processDefinitionKey": process_definition_key.to_string(),
                                "bpmnProcessId": bpmn_process_id,
                                "elementId": element_id,
                                "retries": 3,
                                "customHeaders": {},
                                "tenantId": tenant_id,
                            }),
                        }),
                        None => writers.commands.push(CommandToWrite {
                            value_type: "INCIDENT".to_string(),
                            intent: "CREATE".to_string(),
                            key: 0,
                            payload: serde_json::json!({
                                "errorType": "UNKNOWN",
                                "errorMessage": format!(
                                    "Ad-hoc sub-process '{element_id}' has no job worker implementation \
                                     (zeebe:taskDefinition); Reebe runs ad-hoc sub-processes only through their job"
                                ),
                                "processInstanceKey": process_instance_key.to_string(),
                                "elementInstanceKey": ei_key.to_string(),
                                "bpmnProcessId": bpmn_process_id,
                                "tenantId": tenant_id,
                            }),
                        }),
                    }
                    return Ok(());
                }

                // Fire ACTIVATE_ELEMENT for each start event inside the subprocess.
                // Use ei_key as the flowScopeKey so end-event handling can detect the scope.
                for start_id in &sp.start_events {
                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: "ACTIVATE_ELEMENT".to_string(),
                        key: process_instance_key,
                        payload: serde_json::json!({
                            "processInstanceKey": process_instance_key.to_string(),
                            "processDefinitionKey": process_definition_key.to_string(),
                            "bpmnProcessId": bpmn_process_id,
                            "elementId": start_id,
                            "flowScopeKey": ei_key.to_string(),
                            "tenantId": tenant_id,
                        }),
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
                return multi_instance::inner_completed(state, writers, mi, &inner, body).await;
            }
            if let (true, Some(body)) = (is_mi_body, &current) {
                multi_instance::body_completed(state, mi, body).await?;
            }
        }

        // An element without an outgoing sequence flow ends its path: an end event, an
        // event sub-process, or an activity without one. Its flow scope completes once
        // nothing inside it is active any more. A terminate end event first terminates
        // everything else in its flow scope.
        let element = definition.as_ref().and_then(|p| p.get_element_recursive(&element_id));
        let ends_path = element_type == "END_EVENT"
            || definition.as_ref().is_some_and(|p| element.is_some() && p.outgoing_flows_recursive(&element_id).is_empty());
        if ends_path {
            let terminates = matches!(
                element,
                Some(reebe_bpmn::FlowElement::EndEvent(e)) if matches!(e.event_definition, Some(reebe_bpmn::EventDefinition::Terminate))
            );
            if terminates {
                if let Ok(scope) = state.backend.get_element_instance_by_key(flow_scope_key).await {
                    terminate_children(state, writers, &scope).await?;
                }
            }
            return complete_flow_scope(state, writers, record.position, FlowScope {
                key: flow_scope_key,
                process_instance_key,
                process_definition_key,
                bpmn_process_id: &bpmn_process_id,
                tenant_id: &tenant_id,
            }, terminates).await;
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

        // Load variables once for condition evaluation
        let feel_ctx = scope::feel_context(state, process_instance_key, flow_scope_key).await;

        if element_type == "EXCLUSIVE_GATEWAY" {
            // Evaluate conditioned flows first; unconditioned and default flows are fallbacks.
            // This ensures that a flow with a condition always wins over a flow with no
            // condition, regardless of document order.
            let mut chosen: Option<(String, String)> = None; // (flow_id, target_id)
            let mut default_entry: Option<(String, String)> = None;

            for flow in &outgoing {
                let has_condition = flow.condition_expression.as_ref()
                    .map(|c| !c.trim().is_empty())
                    .unwrap_or(false);
                // Unconditioned flows and explicit defaults are both fallbacks.
                if flow.is_default || !has_condition {
                    if default_entry.is_none() {
                        default_entry = Some((flow.id.clone(), flow.target_ref.clone()));
                    }
                    continue;
                }
                if chosen.is_some() {
                    continue;
                }
                if eval_flow_condition(&flow.condition_expression, &feel_ctx) {
                    chosen = Some((flow.id.clone(), flow.target_ref.clone()));
                }
            }

            if let Some((flow_id, target_id)) = chosen.or(default_entry) {
                let flow_key = key_gen.next_key().await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "SEQUENCE_FLOW_TAKEN".to_string(),
                    key: flow_key,
                    payload: serde_json::json!({
                        "flowKey": flow_key.to_string(),
                        "elementId": flow_id,
                        "processInstanceKey": process_instance_key.to_string(),
                        "processDefinitionKey": process_definition_key.to_string(),
                        "bpmnProcessId": bpmn_process_id,
                        "sourceElementId": element_id,
                        "targetElementId": target_id,
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
                        "elementId": target_id,
                        "flowScopeKey": flow_scope_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
        } else {
            // All other gateways and elements: take every flow whose condition is true.
            for flow in &outgoing {
                if eval_flow_condition(&flow.condition_expression, &feel_ctx) {
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
                            "tenantId": tenant_id,
                        }),
                    });
                }
            }
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
/// completes at once.
async fn complete_flow_scope(
    state: &EngineState,
    writers: &mut Writers,
    position: i64,
    scope: FlowScope<'_>,
    terminated_rest: bool,
) -> EngineResult<()> {
    let FlowScope { key, process_instance_key, process_definition_key, bpmn_process_id, tenant_id } = scope;
    let scope_ei = state.backend.get_element_instance_by_key(key).await.ok();
    let sub_process = scope_ei.filter(|ei| ei.element_type != "PROCESS");

    if !terminated_rest {
        let still_active = match &sub_process {
            Some(sp) => state.backend
                .get_element_instances_by_process_instance(process_instance_key)
                .await?
                .iter()
                .any(|ei| ei.flow_scope_key == Some(sp.key) && !matches!(ei.state.as_str(), "COMPLETED" | "TERMINATED")),
            None => state.backend.get_active_element_instance_count(process_instance_key).await? > 0,
        };
        if still_active {
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
                "elementType": "SUB_PROCESS",
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
                "elementType": "SUB_PROCESS",
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
    // Mark the PROCESS-level element instance as COMPLETED
    state.backend.complete_process_element(process_instance_key).await?;

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

/// Evaluate a sequence flow condition expression.
/// Returns true if there is no condition, the condition is empty, or it evaluates to true.
fn eval_flow_condition(condition: &Option<String>, ctx: &reebe_feel::FeelContext) -> bool {
    match condition {
        None => true,
        Some(cond) if cond.trim().is_empty() => true,
        Some(cond) => {
            // Strip optional leading `=` (BPMN FEEL convention) before evaluating.
            // Some editors omit it; always evaluate as FEEL regardless.
            let expr = cond.trim().strip_prefix('=').unwrap_or(cond.trim()).trim();
            match reebe_feel::evaluate(expr, ctx) {
                Ok(val) => matches!(val, reebe_feel::FeelValue::Bool(true)),
                Err(_) => false,
            }
        }
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
        reebe_bpmn::FlowElement::CallActivity(_) => "CALL_ACTIVITY".to_string(),
        reebe_bpmn::FlowElement::SubProcess(sp) if sp.ad_hoc => "AD_HOC_SUB_PROCESS".to_string(),
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
