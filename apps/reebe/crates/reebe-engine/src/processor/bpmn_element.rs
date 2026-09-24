use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::element_instances::ElementInstance;
#[allow(unused_imports)]
use reebe_db::state::jobs::Job;
use reebe_db::state::messages::MessageSubscription;
use reebe_db::state::signal_subscriptions::SignalSubscription;
use reebe_db::state::timers::Timer;
use reebe_db::state::variables::Variable;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

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

        // Evaluate input mappings (if any), store results, create incident on failure
        {
            let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
            let mut ctx_map = serde_json::Map::new();
            for v in vars {
                ctx_map.insert(v.name, v.value);
            }
            let ctx_val = serde_json::Value::Object(ctx_map);
            let ctx = reebe_feel::FeelContext::from_json(ctx_val);

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
            reebe_bpmn::FlowElement::ExclusiveGateway(_)
            | reebe_bpmn::FlowElement::ParallelGateway(_)
            | reebe_bpmn::FlowElement::InclusiveGateway(_)
            | reebe_bpmn::FlowElement::EventBasedGateway(_) => {
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
                    let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                    let mut ctx_map = serde_json::Map::new();
                    for v in vars {
                        ctx_map.insert(v.name, v.value);
                    }
                    let input_ctx = serde_json::Value::Object(ctx_map);

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
            reebe_bpmn::FlowElement::IntermediateCatchEvent(ice) => {
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

                match &ice.event_definition {
                    Some(reebe_bpmn::EventDefinition::Signal(sig)) => {
                        // Register a signal subscription — element waits for a broadcast
                        let sub = SignalSubscription {
                            key: ei_key,
                            signal_name: sig.signal_name.clone(),
                            process_instance_key,
                            element_instance_key: ei_key,
                            element_id: element_id.clone(),
                            bpmn_process_id: bpmn_process_id.clone(),
                            process_definition_key,
                            flow_scope_key,
                            tenant_id: tenant_id.clone(),
                        };
                        state.backend.insert_signal_subscription(&sub).await?;
                        // Do NOT schedule COMPLETE_ELEMENT — wait for signal broadcast
                    }
                    Some(reebe_bpmn::EventDefinition::Timer(timer_def)) => {
                        // Create a timer record; the scheduler will fire COMPLETE_ELEMENT when due.
                        let timer_ctx = {
                            let vs = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                            let mut m = serde_json::Map::new();
                            for v in vs { m.insert(v.name, v.value); }
                            reebe_feel::FeelContext::from_json(serde_json::Value::Object(m))
                        };
                        let due_date = eval_timer_due_date(&timer_def.expression, &timer_ctx, state.clock.now());
                        let timer_key = key_gen.next_key().await?;
                        let timer = Timer {
                            key: timer_key,
                            process_instance_key: Some(process_instance_key),
                            process_definition_key: Some(process_definition_key),
                            element_instance_key: Some(ei_key),
                            element_id: element_id.clone(),
                            due_date,
                            repetitions: 1,
                            state: "ACTIVE".to_string(),
                            tenant_id: tenant_id.clone(),
                        };
                        state.backend.insert_timer(&timer).await?;
                        // Do NOT schedule COMPLETE_ELEMENT — wait for timer to fire
                    }
                    Some(reebe_bpmn::EventDefinition::Message(msg_def)) => {
                        // Register a message subscription and check for existing messages
                        let sub_key = key_gen.next_key().await?;
                        let correlation_key = eval_correlation_key(
                            msg_def.correlation_key.as_deref(), state, process_instance_key,
                        ).await;
                        let sub = MessageSubscription {
                            key: sub_key,
                            message_name: msg_def.message_name.clone(),
                            correlation_key: correlation_key.clone(),
                            process_instance_key,
                            element_instance_key: ei_key,
                            state: "OPENED".to_string(),
                            tenant_id: tenant_id.clone(),
                        };
                        state.backend.insert_message_subscription(&sub).await?;

                        // Check if a matching message already exists
                        let existing = state.backend
                            .get_messages_by_correlation(&msg_def.message_name, &correlation_key, &tenant_id)
                            .await
                            .unwrap_or_default();
                        if let Some(_msg) = existing.into_iter().next() {
                            // Correlate immediately
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
                        // Otherwise wait for message correlation
                    }
                    _ => {
                        // Timer and other catch events — complete immediately for now
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
                    let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                    let mut ctx_map = serde_json::Map::new();
                    for v in vars { ctx_map.insert(v.name, v.value); }
                    let ctx = reebe_feel::FeelContext::from_json(serde_json::Value::Object(ctx_map));
                    let expr = script.trim().strip_prefix('=').unwrap_or(script.trim());
                    if let Ok(val) = reebe_feel::evaluate(expr, &ctx) {
                        let var_key = key_gen.next_key().await?;
                        state.backend.upsert_variable(&reebe_db::state::variables::Variable {
                            key: var_key,
                            partition_id: state.partition_id,
                            name: result_var.clone(),
                            value: serde_json::Value::from(val),
                            scope_key: process_instance_key,
                            process_instance_key,
                            tenant_id: tenant_id.clone(),
                            is_preview: false,
                        }).await?;
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
            reebe_bpmn::FlowElement::ReceiveTask(rt) => {
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

                // Older callers stored the message name in `messageRef`; keep them working.
                let message_name = rt.message_name.clone()
                    .or_else(|| rt.message_ref.clone())
                    .unwrap_or_default();
                let correlation_key = eval_correlation_key(
                    rt.correlation_key.as_deref(), state, process_instance_key,
                ).await;
                let sub_key = key_gen.next_key().await?;
                let sub = reebe_db::state::messages::MessageSubscription {
                    key: sub_key,
                    message_name: message_name.clone(),
                    correlation_key: correlation_key.clone(),
                    process_instance_key,
                    element_instance_key: ei_key,
                    state: "OPENED".to_string(),
                    tenant_id: tenant_id.clone(),
                };
                state.backend.insert_message_subscription(&sub).await?;

                // Check for an already-published matching message
                let existing = state.backend
                    .get_messages_by_correlation(&message_name, &correlation_key, &tenant_id)
                    .await
                    .unwrap_or_default();
                if existing.into_iter().next().is_some() {
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
                // Otherwise wait for MESSAGE.PUBLISH to correlate
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

                // Initialize multi-instance state if configured.
                if let Some(mi) = &sp.multi_instance {
                    let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                    let mut ctx_map = serde_json::Map::new();
                    for v in vars { ctx_map.insert(v.name, v.value); }
                    let ctx = reebe_feel::FeelContext::from_json(serde_json::Value::Object(ctx_map));

                    let items: Vec<serde_json::Value> = reebe_feel::parse_and_evaluate(&mi.input_collection, &ctx)
                        .ok()
                        .and_then(|v| {
                            let jv = serde_json::Value::from(v);
                            jv.as_array().cloned()
                        })
                        .unwrap_or_default();

                    let mi_items_key = key_gen.next_key().await?;
                    state.backend.upsert_variable(&Variable {
                        key: mi_items_key,
                        partition_id: state.partition_id,
                        name: "__mi_items".to_string(),
                        value: serde_json::Value::Array(items.clone()),
                        scope_key: ei_key,
                        process_instance_key,
                        tenant_id: tenant_id.clone(),
                        is_preview: false,
                    }).await?;

                    let mi_idx_key = key_gen.next_key().await?;
                    state.backend.upsert_variable(&Variable {
                        key: mi_idx_key,
                        partition_id: state.partition_id,
                        name: "__mi_idx".to_string(),
                        value: serde_json::Value::Number(serde_json::Number::from(0i64)),
                        scope_key: ei_key,
                        process_instance_key,
                        tenant_id: tenant_id.clone(),
                        is_preview: false,
                    }).await?;

                    if let (Some(item_var), Some(first_item)) = (&mi.input_element, items.first()) {
                        let iv_key = key_gen.next_key().await?;
                        state.backend.upsert_variable(&Variable {
                            key: iv_key,
                            partition_id: state.partition_id,
                            name: item_var.clone(),
                            value: first_item.clone(),
                            scope_key: ei_key,
                            process_instance_key,
                            tenant_id: tenant_id.clone(),
                            is_preview: false,
                        }).await?;
                    }
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
                let child_vars: serde_json::Value = if !ca.input_mappings.is_empty() {
                    let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                    let mut ctx_map = serde_json::Map::new();
                    for v in vars { ctx_map.insert(v.name, v.value); }
                    let ctx = reebe_feel::FeelContext::from_json(serde_json::Value::Object(ctx_map));
                    let mut out = serde_json::Map::new();
                    for m in &ca.input_mappings {
                        if let Ok(val) = reebe_feel::parse_and_evaluate(&m.source, &ctx) {
                            out.insert(m.target.clone(), serde_json::Value::from(val));
                        }
                    }
                    serde_json::Value::Object(out)
                } else {
                    // Propagate all parent variables by default
                    let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                    let mut map = serde_json::Map::new();
                    for v in vars { map.insert(v.name, v.value); }
                    serde_json::Value::Object(map)
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

        // Evaluate output mappings (if any), store results, create incident on failure
        {
            let pd_result = state.backend.get_process_definition_by_key(process_definition_key).await;
            if let Ok(pd) = pd_result {
                if let Ok(processes) = reebe_bpmn::parse_bpmn(&pd.bpmn_xml) {
                    if let Some(process) = processes
                        .iter()
                        .find(|p| p.id == bpmn_process_id || p.id == pd.bpmn_process_id)
                    {
                        if let Some(element) = process.get_element_recursive(&element_id) {
                            let output_mappings = get_output_mappings(element);
                            if !output_mappings.is_empty() {
                                let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
                                let mut ctx_map = serde_json::Map::new();
                                for v in vars {
                                    ctx_map.insert(v.name, v.value);
                                }
                                // Merge job-returned variables from the COMPLETE_ELEMENT payload so
                                // that output mappings like `=response.body.id` can reference them.
                                if let Some(job_vars) = payload.get("variables").and_then(|v| v.as_object()) {
                                    for (k, v) in job_vars {
                                        ctx_map.insert(k.clone(), v.clone());
                                    }
                                }
                                let ctx_val = serde_json::Value::Object(ctx_map);
                                let ctx = reebe_feel::FeelContext::from_json(ctx_val);

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
                                        for (name, value) in mapped_vars {
                                            let var_key = key_gen.next_key().await?;
                                            state.backend.upsert_variable(&Variable {
                                                key: var_key,
                                                partition_id: state.partition_id,
                                                name,
                                                value,
                                                scope_key: process_instance_key,
                                                process_instance_key,
                                                tenant_id: tenant_id.clone(),
                                                is_preview: false,
                                            }).await?;
                                        }
                                    }
                                }
                            } else if let Some(job_vars) =
                                payload.get("variables").and_then(|v| v.as_object())
                            {
                                // No output mappings: Zeebe merges every variable the job
                                // completed with into the process. Without this, a worker's
                                // result was only ever visible to output mappings.
                                for (name, value) in job_vars {
                                    let var_key = key_gen.next_key().await?;
                                    state.backend.upsert_variable(&Variable {
                                        key: var_key,
                                        partition_id: state.partition_id,
                                        name: name.clone(),
                                        value: value.clone(),
                                        scope_key: process_instance_key,
                                        process_instance_key,
                                        tenant_id: tenant_id.clone(),
                                        is_preview: false,
                                    }).await?;
                                }
                            }
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

        // If this is an EndEvent, check if the process (or subprocess) is complete
        if element_type == "END_EVENT" {
            // Detect whether this end event is inside an embedded subprocess by checking
            // if the flow scope element is a SUB_PROCESS rather than the root PROCESS.
            let scope_ei = state.backend.get_element_instance_by_key(flow_scope_key).await.ok();
            let is_subprocess_end = scope_ei.as_ref()
                .map(|ei| ei.element_type == "SUB_PROCESS")
                .unwrap_or(false);

            if is_subprocess_end {
                let sp_ei = scope_ei.unwrap();

                // Check for multi-instance state scoped to the subprocess element instance.
                let sp_vars = state.backend.get_variables_by_scope(sp_ei.key).await.unwrap_or_default();
                let mi_items_opt = sp_vars.iter().find(|v| v.name == "__mi_items").map(|v| v.value.clone());
                let mi_idx_opt = sp_vars.iter().find(|v| v.name == "__mi_idx").and_then(|v| v.value.as_i64());

                if let (Some(items_val), Some(current_idx)) = (mi_items_opt, mi_idx_opt) {
                    let items = items_val.as_array().cloned().unwrap_or_default();

                    // Fetch process definition once for both MI config and start events.
                    let (sp_mi, start_events) = if let Ok(pd) = state.backend.get_process_definition_by_key(process_definition_key).await {
                        if let Ok(processes) = reebe_bpmn::parse_bpmn(&pd.bpmn_xml) {
                            let found = processes.iter()
                                .find(|p| p.id == sp_ei.bpmn_process_id || p.id == bpmn_process_id)
                                .and_then(|p| p.get_element_recursive(&sp_ei.element_id))
                                .and_then(|el| if let reebe_bpmn::FlowElement::SubProcess(sp) = el {
                                    Some((sp.multi_instance.clone(), sp.start_events.clone()))
                                } else {
                                    None
                                });
                            found.map(|(mi, se)| (mi, se)).unwrap_or((None, vec![]))
                        } else {
                            (None, vec![])
                        }
                    } else {
                        (None, vec![])
                    };

                    // Collect output for this iteration if configured.
                    if let Some(ref mi) = sp_mi {
                        if let (Some(out_expr), Some(out_collection_name)) = (&mi.output_element, &mi.output_collection) {
                            let mut ctx_map = serde_json::Map::new();
                            for v in &sp_vars { ctx_map.insert(v.name.clone(), v.value.clone()); }
                            let ctx = reebe_feel::FeelContext::from_json(serde_json::Value::Object(ctx_map));
                            let expr = out_expr.trim().strip_prefix('=').unwrap_or(out_expr.trim());
                            if let Ok(val) = reebe_feel::evaluate(expr, &ctx) {
                                let jv = serde_json::Value::from(val);
                                let mut outputs: Vec<serde_json::Value> = sp_vars.iter()
                                    .find(|v| v.name == "__mi_outputs")
                                    .and_then(|v| v.value.as_array().cloned())
                                    .unwrap_or_default();
                                outputs.push(jv);
                                let out_key = key_gen.next_key().await?;
                                state.backend.upsert_variable(&Variable {
                                    key: out_key,
                                    partition_id: state.partition_id,
                                    name: "__mi_outputs".to_string(),
                                    value: serde_json::Value::Array(outputs.clone()),
                                    scope_key: sp_ei.key,
                                    process_instance_key,
                                    tenant_id: tenant_id.clone(),
                                    is_preview: false,
                                }).await?;
                                // Write output_collection to process scope after each iteration.
                                let oc_key = key_gen.next_key().await?;
                                state.backend.upsert_variable(&Variable {
                                    key: oc_key,
                                    partition_id: state.partition_id,
                                    name: out_collection_name.clone(),
                                    value: serde_json::Value::Array(outputs),
                                    scope_key: process_instance_key,
                                    process_instance_key,
                                    tenant_id: tenant_id.clone(),
                                    is_preview: false,
                                }).await?;
                            }
                        }
                    }

                    let next_idx = current_idx + 1;
                    if next_idx < items.len() as i64 {
                        // Advance index.
                        let idx_key = key_gen.next_key().await?;
                        state.backend.upsert_variable(&Variable {
                            key: idx_key,
                            partition_id: state.partition_id,
                            name: "__mi_idx".to_string(),
                            value: serde_json::Value::Number(serde_json::Number::from(next_idx)),
                            scope_key: sp_ei.key,
                            process_instance_key,
                            tenant_id: tenant_id.clone(),
                            is_preview: false,
                        }).await?;

                        // Set input_element for next iteration.
                        if let Some(ref mi) = sp_mi {
                            if let (Some(item_var), Some(next_item)) = (&mi.input_element, items.get(next_idx as usize)) {
                                let iv_key = key_gen.next_key().await?;
                                state.backend.upsert_variable(&Variable {
                                    key: iv_key,
                                    partition_id: state.partition_id,
                                    name: item_var.clone(),
                                    value: next_item.clone(),
                                    scope_key: sp_ei.key,
                                    process_instance_key,
                                    tenant_id: tenant_id.clone(),
                                    is_preview: false,
                                }).await?;
                            }
                        }

                        // Re-activate start events for the next iteration.
                        for start_id in &start_events {
                            writers.commands.push(CommandToWrite {
                                value_type: "PROCESS_INSTANCE".to_string(),
                                intent: "ACTIVATE_ELEMENT".to_string(),
                                key: process_instance_key,
                                payload: serde_json::json!({
                                    "processInstanceKey": process_instance_key.to_string(),
                                    "processDefinitionKey": process_definition_key.to_string(),
                                    "bpmnProcessId": bpmn_process_id,
                                    "elementId": start_id,
                                    "flowScopeKey": sp_ei.key.to_string(),
                                    "tenantId": tenant_id,
                                }),
                            });
                        }
                        return Ok(());
                    }
                    // All iterations done — fall through to complete the subprocess normally.
                }

                // Complete the subprocess (non-MI or MI that finished all iterations).
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

            // Root process end event — check remaining active elements
            let active_count = state.backend.get_active_element_instance_count(process_instance_key).await?;
            if active_count <= 0 {
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

                // If this is a child process (called via call activity), resume the parent.
                let pi = state.backend.get_process_instance_by_key(process_instance_key).await?;
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
            }
            return Ok(());
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
        let feel_ctx = {
            let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
            let mut ctx_map = serde_json::Map::new();
            for v in vars {
                ctx_map.insert(v.name, v.value);
            }
            reebe_feel::FeelContext::from_json(serde_json::Value::Object(ctx_map))
        };

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
        }

        Ok(())
    }
}

/// Evaluate a timer expression and return the due date.
/// Handles FEEL expressions that produce a Duration (added to now) or a DateTime.
/// Falls back to treating the expression as a raw ISO 8601 duration string.
fn eval_timer_due_date(expression: &str, ctx: &reebe_feel::FeelContext, now: chrono::DateTime<chrono::Utc>) -> chrono::DateTime<chrono::Utc> {

    // First try evaluating as a FEEL expression
    if let Ok(val) = reebe_feel::parse_and_evaluate(expression, ctx) {
        match val {
            reebe_feel::FeelValue::Duration(ms) => {
                return now + chrono::Duration::milliseconds(ms);
            }
            reebe_feel::FeelValue::DateTime(dt) => {
                return dt;
            }
            _ => {}
        }
    }

    // Try wrapping in duration("...") for plain ISO 8601 duration strings like "PT5S".
    // Use evaluate() directly — parse_and_evaluate() treats non-'=' strings as literals,
    // so it would return String("duration(...)") without evaluating the function call.
    let wrapped = format!("duration(\"{}\")", expression.trim_matches('"'));
    if let Ok(val) = reebe_feel::evaluate(&wrapped, ctx) {
        if let reebe_feel::FeelValue::Duration(ms) = val {
            return now + chrono::Duration::milliseconds(ms);
        }
    }

    // Fallback: treat as 0-delay (fire immediately)
    tracing::warn!(expression = %expression, "Could not parse timer expression; firing immediately");
    now
}

/// Resolve a subscription's correlation key against the instance's variables.
/// A `=` expression is evaluated with FEEL; Zeebe accepts a string or a number.
async fn eval_correlation_key(
    expression: Option<&str>,
    state: &EngineState,
    process_instance_key: i64,
) -> String {
    let Some(expression) = expression else { return String::new() };
    if !reebe_feel::is_feel_expression(expression) {
        return expression.to_string();
    }
    let vars = state.backend.get_variables_by_scope(process_instance_key).await.unwrap_or_default();
    let mut m = serde_json::Map::new();
    for v in vars { m.insert(v.name, v.value); }
    let ctx = reebe_feel::FeelContext::from_json(serde_json::Value::Object(m));
    match reebe_feel::parse_and_evaluate(expression, &ctx).map(serde_json::Value::from) {
        Ok(serde_json::Value::String(s)) => s,
        Ok(serde_json::Value::Null) | Err(_) => {
            tracing::warn!(expression = %expression, "Correlation key did not evaluate to a value");
            String::new()
        }
        Ok(other) => other.to_string(),
    }
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
