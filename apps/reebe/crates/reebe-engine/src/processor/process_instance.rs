use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::element_instances::ElementInstance;
use reebe_db::state::process_instances::ProcessInstance;
use reebe_db::state::variables::Variable;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

pub struct ProcessInstanceCreationProcessor;

pub struct ProcessInstanceCancelProcessor;

#[async_trait]
impl RecordProcessor for ProcessInstanceCreationProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "PROCESS_INSTANCE_CREATION" && intent == "CREATE"
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        // Find process definition
        let process_def = if let Some(key_str) = payload["processDefinitionKey"].as_str() {
            let key: i64 = key_str
                .parse()
                .map_err(|_| EngineError::NotFound(format!("Invalid processDefinitionKey: {key_str}")))?;
            state.backend.get_process_definition_by_key(key).await?
        } else if let Some(bpmn_id) = payload["bpmnProcessId"].as_str() {
            let version = payload["version"].as_i64().unwrap_or(-1) as i32;
            if version == -1 || version == 0 {
                state.backend.get_latest_process_definition(bpmn_id, &tenant_id).await?
            } else {
                state.backend.get_process_definition_by_id_and_version(bpmn_id, version, &tenant_id).await?
            }
        } else {
            return Err(EngineError::InvalidState(
                "Either processDefinitionKey or bpmnProcessId is required".to_string(),
            ));
        };

        // A message start event reserves the key of the instance it creates.
        let instance_key = match payload["processInstanceKey"].as_str().and_then(|s| s.parse().ok()) {
            Some(key) => key,
            None => key_gen.next_key().await?,
        };

        // Accept optional parent linkage (set by call activity spawning)
        let parent_process_instance_key: Option<i64> = payload["parentProcessInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["parentProcessInstanceKey"].as_i64());
        let parent_element_instance_key: Option<i64> = payload["parentElementInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["parentElementInstanceKey"].as_i64());

        // Insert process instance
        let pi = ProcessInstance {
            key: instance_key,
            partition_id: state.partition_id,
            process_definition_key: process_def.key,
            bpmn_process_id: process_def.bpmn_process_id.clone(),
            version: process_def.version,
            state: "ACTIVE".to_string(),
            start_date: state.clock.now(),
            end_date: None,
            parent_process_instance_key,
            parent_element_instance_key,
            root_process_instance_key: instance_key,
            tenant_id: tenant_id.clone(),
        };
        state.backend.insert_process_instance(&pi).await?;

        // Set initial variables if provided
        if let Some(vars) = payload["variables"].as_object() {
            for (name, value) in vars {
                let var_key = key_gen.next_key().await?;
                let variable = Variable {
                    key: var_key,
                    partition_id: state.partition_id,
                    name: name.clone(),
                    value: value.clone(),
                    scope_key: instance_key,
                    process_instance_key: instance_key,
                    tenant_id: tenant_id.clone(),
                    is_preview: false,
                };
                state.backend.upsert_variable(&variable).await?;
            }
        }

        // Parse BPMN to find start events
        let bpmn = reebe_bpmn::parse_bpmn(&process_def.bpmn_xml)
            .map_err(|e| EngineError::BpmnParse(e.to_string()))?;

        let process = bpmn.into_iter().find(|p| p.id == process_def.bpmn_process_id)
            .ok_or_else(|| EngineError::NotFound(format!("Process {} not found in BPMN", process_def.bpmn_process_id)))?;

        // Create element instance for the process itself — walk through full lifecycle
        let process_ei_key = key_gen.next_key().await?;
        let process_ei = ElementInstance {
            key: process_ei_key,
            partition_id: state.partition_id,
            process_instance_key: instance_key,
            process_definition_key: process_def.key,
            bpmn_process_id: process_def.bpmn_process_id.clone(),
            element_id: process_def.bpmn_process_id.clone(),
            element_type: "PROCESS".to_string(),
            state: "ACTIVATING".to_string(),
            flow_scope_key: None,
            scope_key: Some(instance_key),
            incident_key: None,
            tenant_id: tenant_id.clone(),
        };
        state.backend.insert_element_instance(&process_ei).await?;

        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_ACTIVATING".to_string(),
            key: process_ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": process_ei_key.to_string(),
                "processInstanceKey": instance_key.to_string(),
                "processDefinitionKey": process_def.key.to_string(),
                "elementId": process_def.bpmn_process_id,
                "elementType": "PROCESS",
                "bpmnProcessId": process_def.bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });

        state.backend.update_element_instance_state(process_ei_key, "ACTIVATED").await?;

        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_ACTIVATED".to_string(),
            key: process_ei_key,
            payload: serde_json::json!({
                "elementInstanceKey": process_ei_key.to_string(),
                "processInstanceKey": instance_key.to_string(),
                "processDefinitionKey": process_def.key.to_string(),
                "elementId": process_def.bpmn_process_id,
                "elementType": "PROCESS",
                "bpmnProcessId": process_def.bpmn_process_id,
                "tenantId": tenant_id,
            }),
        });

        // The process is a flow scope: it arms the timer, message and signal start
        // events of its event sub-processes.
        let activated_process_ei = ElementInstance { state: "ACTIVATED".to_string(), ..process_ei };
        super::catch_event::arm_event_subprocesses(state, writers, &process, &activated_process_ei).await?;

        // Write PROCESS_INSTANCE_CREATION.CREATED event
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE_CREATION".to_string(),
            intent: "CREATED".to_string(),
            key: instance_key,
            payload: serde_json::json!({
                "processInstanceKey": instance_key.to_string(),
                "processDefinitionKey": process_def.key.to_string(),
                "bpmnProcessId": process_def.bpmn_process_id,
                "version": process_def.version,
                "tenantId": tenant_id,
            }),
        });

        // A timer or message start event names the start event it triggered. Otherwise
        // the instance starts at the none start event, as in Zeebe; a process without
        // one starts at all of its start events.
        let start_events: Vec<&String> = match payload["startEventId"].as_str() {
            Some(id) => vec![process.start_events.iter().find(|s| *s == id).ok_or_else(|| {
                EngineError::NotFound(format!("Start event {id} of process {}", process.id))
            })?],
            None => {
                let none_start_events: Vec<&String> = process.start_events.iter()
                    .filter(|id| matches!(
                        process.elements.get(*id),
                        Some(reebe_bpmn::FlowElement::StartEvent(se)) if se.event_definition.is_none()
                    ))
                    .collect();
                if none_start_events.is_empty() {
                    process.start_events.iter().collect()
                } else {
                    none_start_events
                }
            }
        };

        // Schedule start events for activation
        for start_event_id in start_events {
            writers.commands.push(CommandToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "ACTIVATE_ELEMENT".to_string(),
                key: instance_key,
                payload: serde_json::json!({
                    "processInstanceKey": instance_key.to_string(),
                    "processDefinitionKey": process_def.key.to_string(),
                    "bpmnProcessId": process_def.bpmn_process_id,
                    "elementId": start_event_id,
                    "flowScopeKey": process_ei_key.to_string(),
                    "tenantId": tenant_id,
                }),
            });
        }

        // Set response
        writers.response = Some(serde_json::json!({
            "processInstanceKey": instance_key.to_string(),
            "processDefinitionKey": process_def.key.to_string(),
            "bpmnProcessId": process_def.bpmn_process_id,
            "version": process_def.version,
            "tenantId": tenant_id,
        }));

        Ok(())
    }
}

#[async_trait]
impl RecordProcessor for ProcessInstanceCancelProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "PROCESS_INSTANCE" && intent == "CANCEL"
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let process_instance_key: i64 = payload["processInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing processInstanceKey".to_string()))?;

        // Terminate all active element instances
        let instances = state.backend
            .get_element_instances_by_process_instance(process_instance_key)
            .await
            .unwrap_or_default();

        for ei in &instances {
            if matches!(ei.state.as_str(), "ACTIVATING" | "ACTIVATED" | "COMPLETING") {
                state.backend.update_element_instance_state(ei.key, "TERMINATED").await?;
                super::catch_event::close_waits(state, ei.key).await?;
                writers.events.push(EventToWrite {
                    value_type: "PROCESS_INSTANCE".to_string(),
                    intent: "ELEMENT_TERMINATED".to_string(),
                    key: ei.key,
                    payload: serde_json::json!({
                        "elementInstanceKey": ei.key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "elementId": ei.element_id,
                        "elementType": ei.element_type,
                        "bpmnProcessId": ei.bpmn_process_id,
                        "tenantId": tenant_id,
                    }),
                });
            }
        }

        // Cancel all active/activatable jobs for this process
        state.backend.cancel_jobs_by_process_instance(process_instance_key).await?;

        // Mark process instance as canceled
        state.backend
            .update_process_instance_state(process_instance_key, "CANCELED", Some(state.clock.now()))
            .await?;
        super::start_event::instance_ended(state, writers, process_instance_key).await?;

        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "PROCESS_INSTANCE_CANCELED".to_string(),
            key: process_instance_key,
            payload: serde_json::json!({
                "processInstanceKey": process_instance_key.to_string(),
                "tenantId": tenant_id,
            }),
        });

        writers.response = Some(serde_json::json!({
            "processInstanceKey": process_instance_key.to_string(),
            "tenantId": tenant_id,
        }));

        Ok(())
    }
}
