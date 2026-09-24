use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::incidents::Incident;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
#[allow(unused_imports)]
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

pub struct IncidentProcessor;

#[async_trait]
impl RecordProcessor for IncidentProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "INCIDENT" && matches!(intent, "CREATE" | "RESOLVE")
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        if record.intent == "CREATE" {
            return self.create_incident(record, state, writers).await;
        }
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let incident_key: i64 = payload["incidentKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["incidentKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing incidentKey".to_string()))?;

        let incident = state.backend.get_incident_by_key(incident_key).await?;
        state.backend.resolve_incident(incident_key).await?;

        writers.events.push(EventToWrite {
            value_type: "INCIDENT".to_string(),
            intent: "RESOLVED".to_string(),
            key: incident_key,
            payload: serde_json::json!({
                "incidentKey": incident_key.to_string(),
                "processInstanceKey": incident.process_instance_key.to_string(),
                "tenantId": tenant_id,
            }),
        });

        if let Some(job_key) = incident.job_key {
            // Job incident: re-activate the job if it now has retries.
            if let Ok(job) = state.backend.get_job_by_key(job_key).await {
                if job.retries > 0 {
                    // update_retries already flips state FAILED→ACTIVATABLE when retries > 0
                    state.backend.update_job_retries(job_key, job.retries).await?;

                    writers.events.push(EventToWrite {
                        value_type: "JOB".to_string(),
                        intent: "RETRIES_UPDATED".to_string(),
                        key: job_key,
                        payload: serde_json::json!({
                            "jobKey": job_key.to_string(),
                            "retries": job.retries,
                            "tenantId": tenant_id,
                        }),
                    });
                }
            }
        } else {
            // Non-job incident (e.g. IO_MAPPING_ERROR): re-trigger element processing.
            if let Ok(ei) = state.backend.get_element_instance_by_key(incident.element_instance_key).await {
                // An ad-hoc inner instance completes without a command of its own: its
                // completion condition is evaluated again.
                if ei.element_type == super::ad_hoc::INNER && ei.state == "COMPLETING" {
                    let process = super::throw_event::load_process(state, ei.process_definition_key, &ei.bpmn_process_id).await?;
                    super::ad_hoc::inner_completed(state, writers, &process, &ei).await?;
                    writers.response = Some(serde_json::json!({
                        "incidentKey": incident_key.to_string(),
                        "tenantId": tenant_id,
                    }));
                    return Ok(());
                }
                let intent = match ei.state.as_str() {
                    "ACTIVATING" => Some("ACTIVATE_ELEMENT"),
                    "COMPLETING" => Some("COMPLETE_ELEMENT"),
                    _ => None,
                };

                if let Some(cmd_intent) = intent {
                    let flow_scope_key = ei
                        .flow_scope_key
                        .unwrap_or(ei.process_instance_key);

                    writers.commands.push(CommandToWrite {
                        value_type: "PROCESS_INSTANCE".to_string(),
                        intent: cmd_intent.to_string(),
                        key: ei.key,
                        payload: serde_json::json!({
                            "elementInstanceKey": ei.key.to_string(),
                            "processInstanceKey": ei.process_instance_key.to_string(),
                            "processDefinitionKey": ei.process_definition_key.to_string(),
                            "elementId": ei.element_id,
                            "elementType": ei.element_type,
                            "bpmnProcessId": ei.bpmn_process_id,
                            "flowScopeKey": flow_scope_key.to_string(),
                            "tenantId": tenant_id,
                        }),
                    });
                }
            }
        }

        writers.response = Some(serde_json::json!({
            "incidentKey": incident_key.to_string(),
            "tenantId": tenant_id,
        }));

        Ok(())
    }}

impl IncidentProcessor {
    /// Raise an incident an element processor asked for (e.g. a failed I/O mapping).
    /// The element stays where it is until the incident is resolved.
    async fn create_incident(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let element_instance_key: i64 = payload["elementInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["elementInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing elementInstanceKey".to_string()))?;
        let ei = state.backend.get_element_instance_by_key(element_instance_key).await?;
        let error_type = payload["errorType"].as_str().unwrap_or("UNKNOWN").to_string();
        let error_message = payload["errorMessage"].as_str().map(|s| s.to_string());

        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let incident_key = key_gen.next_key().await?;
        state.backend.insert_incident(&Incident {
            key: incident_key,
            partition_id: state.partition_id,
            process_instance_key: ei.process_instance_key,
            process_definition_key: ei.process_definition_key,
            element_instance_key: ei.key,
            element_id: ei.element_id.clone(),
            error_type: error_type.clone(),
            error_message: error_message.clone(),
            state: "ACTIVE".to_string(),
            job_key: None,
            created_at: state.clock.now(),
            resolved_at: None,
            tenant_id: record.tenant_id.clone(),
        }).await?;

        writers.events.push(EventToWrite {
            value_type: "INCIDENT".to_string(),
            intent: "CREATED".to_string(),
            key: incident_key,
            payload: serde_json::json!({
                "incidentKey": incident_key.to_string(),
                "processInstanceKey": ei.process_instance_key.to_string(),
                "elementInstanceKey": ei.key.to_string(),
                "elementId": ei.element_id,
                "errorType": error_type,
                "errorMessage": error_message,
                "tenantId": record.tenant_id,
            }),
        });
        Ok(())
    }
}
