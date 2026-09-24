use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::incidents::Incident;
use reebe_db::state::jobs::Job;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};
use super::throw_event::{element_was_terminated, throw_event, Thrown};

pub struct JobProcessor {
    pub job_notifier: std::sync::Arc<crate::JobNotifier>,
}

#[async_trait]
impl RecordProcessor for JobProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "JOB"
            && matches!(intent, "CREATE" | "COMPLETE" | "FAIL" | "THROW_ERROR" | "TIME_OUT" | "UPDATE_RETRIES" | "UPDATE_TIMEOUT")
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        match record.intent.as_str() {
            "CREATE" => self.create_job(record, state, writers).await,
            "COMPLETE" => self.complete_job(record, state, writers).await,
            "FAIL" => self.fail_job(record, state, writers).await,
            "THROW_ERROR" => self.throw_error(record, state, writers).await,
            "TIME_OUT" => self.timeout_job(record, state, writers).await,
            "UPDATE_RETRIES" => self.update_retries(record, state, writers).await,
            "UPDATE_TIMEOUT" => self.update_timeout(record, state, writers).await,
            _ => Ok(()),
        }
    }
}

impl JobProcessor {
    async fn create_job(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        // The element may have been terminated (by a caught error or escalation)
        // between queuing this command and processing it.
        if element_was_terminated(state, &record.payload).await {
            return Ok(());
        }

        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let job_key = key_gen.next_key().await?;
        let job_type = payload["jobType"].as_str().unwrap_or("").to_string();
        let process_instance_key: i64 = payload["processInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processInstanceKey"].as_i64())
            .unwrap_or(0);
        let element_instance_key: i64 = payload["elementInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["elementInstanceKey"].as_i64())
            .unwrap_or(0);
        let process_definition_key: i64 = payload["processDefinitionKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["processDefinitionKey"].as_i64())
            .unwrap_or(0);
        let bpmn_process_id = payload["bpmnProcessId"].as_str().unwrap_or("").to_string();
        let element_id = payload["elementId"].as_str().unwrap_or("").to_string();
        let retries = payload["retries"].as_i64().unwrap_or(3) as i32;
        let custom_headers = payload["customHeaders"].clone();

        let job = Job {
            key: job_key,
            partition_id: state.partition_id,
            job_type: job_type.clone(),
            state: "ACTIVATABLE".to_string(),
            process_instance_key,
            element_instance_key,
            process_definition_key,
            bpmn_process_id,
            element_id,
            retries,
            worker: None,
            deadline: None,
            retry_back_off_at: None,
            error_code: None,
            error_message: None,
            custom_headers,
            // What a worker sees on activation: every variable visible from the
            // element (its input mappings included), inner scopes winning.
            variables: serde_json::Value::Object(
                crate::processor::scope::visible_variables(
                    state, process_instance_key, element_instance_key,
                ).await,
            ),
            created_at: state.clock.now(),
            tenant_id: tenant_id.clone(),
        };

        state.backend.insert_job(&job).await?;

        writers.events.push(EventToWrite {
            value_type: "JOB".to_string(),
            intent: "CREATED".to_string(),
            key: job_key,
            payload: serde_json::json!({
                "jobKey": job_key.to_string(),
                "jobType": job_type,
                "processInstanceKey": process_instance_key.to_string(),
                "elementInstanceKey": element_instance_key.to_string(),
                "tenantId": tenant_id,
            }),
        });

        // Notify long-poll waiters
        self.job_notifier.notify(&job_type);

        Ok(())
    }

    async fn complete_job(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let job_key: i64 = payload["jobKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["jobKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing jobKey".to_string()))?;

        let variables = payload.get("variables").cloned();

        let job = state.backend.get_job_by_key(job_key).await?;
        // Look up the element instance to recover the correct flowScopeKey (e.g. subprocess scope)
        let ei = state.backend.get_element_instance_by_key(job.element_instance_key).await?;
        let flow_scope_key = ei.flow_scope_key.unwrap_or(job.process_instance_key);

        // The job of an ad-hoc sub-process may complete with a result that activates
        // inner elements or fulfils the completion condition. An invalid result
        // rejects the completion before anything changes.
        let ad_hoc = if ei.element_type == super::ad_hoc::AD_HOC {
            let process = super::throw_event::load_process(state, ei.process_definition_key, &ei.bpmn_process_id).await?;
            super::ad_hoc::job_result(&process, &job, payload.get("result"))?.map(|result| (process, result))
        } else {
            None
        };

        state.backend.complete_job(job_key, variables.clone()).await?;

        writers.events.push(EventToWrite {
            value_type: "JOB".to_string(),
            intent: "COMPLETED".to_string(),
            key: job_key,
            payload: serde_json::json!({
                "jobKey": job_key.to_string(),
                "jobType": job.job_type,
                "processInstanceKey": job.process_instance_key.to_string(),
                "elementInstanceKey": job.element_instance_key.to_string(),
                "tenantId": tenant_id,
            }),
        });

        if let Some((process, result)) = ad_hoc {
            if let Some(reebe_bpmn::FlowElement::SubProcess(sp)) = process.get_element_recursive(&ei.element_id) {
                let vars = variables.as_ref().and_then(|v| v.as_object());
                return super::ad_hoc::apply_job_result(state, writers, sp, &ei, vars, result).await;
            }
        }

        // Complete the element instance
        writers.commands.push(CommandToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "COMPLETE_ELEMENT".to_string(),
            key: job.element_instance_key,
            payload: serde_json::json!({
                "elementInstanceKey": job.element_instance_key.to_string(),
                "processInstanceKey": job.process_instance_key.to_string(),
                "processDefinitionKey": job.process_definition_key.to_string(),
                "elementId": job.element_id,
                "elementType": "SERVICE_TASK",
                "bpmnProcessId": job.bpmn_process_id,
                "flowScopeKey": flow_scope_key.to_string(),
                "variables": variables.unwrap_or_default(),
                "tenantId": tenant_id,
            }),
        });

        Ok(())
    }

    async fn fail_job(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let job_key: i64 = payload["jobKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["jobKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing jobKey".to_string()))?;

        let retries = payload["retries"].as_i64().unwrap_or(0) as i32;
        let error_message = payload["errorMessage"].as_str().map(|s| s.to_string());
        let retry_back_off_ms = payload["retryBackOff"].as_i64();

        let job = state.backend.get_job_by_key(job_key).await?;
        state.backend
            .fail_job(job_key, retries, error_message.as_deref(), None, retry_back_off_ms)
            .await?;

        writers.events.push(EventToWrite {
            value_type: "JOB".to_string(),
            intent: "FAILED".to_string(),
            key: job_key,
            payload: serde_json::json!({
                "jobKey": job_key.to_string(),
                "retries": retries,
                "errorMessage": error_message,
                "tenantId": tenant_id,
            }),
        });

        // If retries exhausted, create an incident
        if retries <= 0 {
            let incident_key = key_gen.next_key().await?;
            let incident = Incident {
                key: incident_key,
                partition_id: state.partition_id,
                process_instance_key: job.process_instance_key,
                process_definition_key: job.process_definition_key,
                element_instance_key: job.element_instance_key,
                element_id: job.element_id.clone(),
                error_type: "JOB_NO_RETRIES".to_string(),
                error_message: error_message.clone(),
                state: "ACTIVE".to_string(),
                job_key: Some(job_key),
                created_at: state.clock.now(),
                resolved_at: None,
                tenant_id: tenant_id.clone(),
            };
            state.backend.insert_incident(&incident).await?;

            writers.events.push(EventToWrite {
                value_type: "INCIDENT".to_string(),
                intent: "CREATED".to_string(),
                key: incident_key,
                payload: serde_json::json!({
                    "incidentKey": incident_key.to_string(),
                    "jobKey": job_key.to_string(),
                    "processInstanceKey": job.process_instance_key.to_string(),
                    "errorType": "JOB_NO_RETRIES",
                    "errorMessage": error_message,
                    "tenantId": tenant_id,
                }),
            });
        }

        Ok(())
    }

    async fn throw_error(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let job_key: i64 = payload["jobKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["jobKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing jobKey".to_string()))?;

        let error_code = payload["errorCode"].as_str().unwrap_or("").to_string();
        let error_message = payload["errorMessage"].as_str().map(|s| s.to_string());
        let error_variables = payload.get("variables").filter(|v| v.as_object().is_some_and(|o| !o.is_empty())).cloned();

        let job = state.backend.get_job_by_key(job_key).await?;
        state.backend
            .fail_job(job_key, 0, error_message.as_deref(), Some(&error_code), None)
            .await?;

        writers.events.push(EventToWrite {
            value_type: "JOB".to_string(),
            intent: "ERROR_THROWN".to_string(),
            key: job_key,
            payload: serde_json::json!({
                "jobKey": job_key.to_string(),
                "errorCode": error_code,
                "errorMessage": error_message,
                "tenantId": tenant_id,
            }),
        });

        // Hand the error to the nearest catch event; an uncaught error raises an incident.
        let thrower = state.backend.get_element_instance_by_key(job.element_instance_key).await?;
        throw_event(
            state,
            writers,
            &thrower,
            &Thrown::Error { code: error_code, message: error_message, variables: error_variables },
            Some(job_key),
        )
        .await?;

        Ok(())
    }

    async fn timeout_job(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let job_key: i64 = payload["jobKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["jobKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing jobKey".to_string()))?;

        state.backend.fail_job(job_key, 0, Some("Job timeout"), None, None).await?;

        writers.events.push(EventToWrite {
            value_type: "JOB".to_string(),
            intent: "TIMED_OUT".to_string(),
            key: job_key,
            payload: serde_json::json!({
                "jobKey": job_key.to_string(),
                "tenantId": tenant_id,
            }),
        });

        Ok(())
    }

    async fn update_retries(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let job_key: i64 = payload["jobKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["jobKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing jobKey".to_string()))?;
        let retries = payload["retries"].as_i64().unwrap_or(0) as i32;

        state.backend.update_job_retries(job_key, retries).await?;

        writers.events.push(EventToWrite {
            value_type: "JOB".to_string(),
            intent: "RETRIES_UPDATED".to_string(),
            key: job_key,
            payload: serde_json::json!({ "jobKey": job_key.to_string(), "retries": retries }),
        });

        Ok(())
    }

    async fn update_timeout(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let job_key: i64 = payload["jobKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["jobKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing jobKey".to_string()))?;
        let timeout_ms = payload["timeout"].as_i64().unwrap_or(30_000);

        let deadline = state.clock.now() + chrono::Duration::milliseconds(timeout_ms);

        state.backend.update_job_deadline(job_key, deadline).await?;

        writers.events.push(EventToWrite {
            value_type: "JOB".to_string(),
            intent: "TIMEOUT_UPDATED".to_string(),
            key: job_key,
            payload: serde_json::json!({
                "jobKey": job_key.to_string(),
                "timeout": timeout_ms,
                "deadline": deadline.timestamp_millis(),
            }),
        });

        Ok(())
    }
}
