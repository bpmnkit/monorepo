use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::user_tasks::UserTask;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};
use super::throw_event::element_was_terminated;

pub struct UserTaskProcessor;

#[async_trait]
impl RecordProcessor for UserTaskProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "USER_TASK"
            && matches!(intent, "CREATE" | "COMPLETE" | "ASSIGN" | "UNASSIGN")
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        match record.intent.as_str() {
            "CREATE" => self.create_user_task(record, state, writers).await,
            "COMPLETE" => self.complete_user_task(record, state, writers).await,
            "ASSIGN" => self.assign_user_task(record, state, writers).await,
            "UNASSIGN" => self.unassign_user_task(record, state, writers).await,
            _ => Ok(()),
        }
    }
}

impl UserTaskProcessor {
    async fn create_user_task(
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

        let task_key = key_gen.next_key().await?;
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
        let assignee = payload["assignee"].as_str().map(|s| s.to_string());
        let form_key = payload["formKey"].as_str().map(|s| s.to_string());

        let task = UserTask {
            key: task_key,
            partition_id: state.partition_id,
            process_instance_key,
            element_instance_key,
            process_definition_key,
            bpmn_process_id: bpmn_process_id.clone(),
            element_id: element_id.clone(),
            state: "CREATED".to_string(),
            assignee: assignee.clone(),
            candidate_groups: None,
            candidate_users: None,
            due_date: None,
            follow_up_date: None,
            form_key: form_key.clone(),
            custom_headers: serde_json::Value::Object(Default::default()),
            variables: serde_json::Value::Object(Default::default()),
            created_at: state.clock.now(),
            completed_at: None,
            tenant_id: tenant_id.clone(),
        };
        state.backend.insert_user_task(&task).await?;

        writers.events.push(EventToWrite {
            value_type: "USER_TASK".to_string(),
            intent: "CREATED".to_string(),
            key: task_key,
            payload: serde_json::json!({
                "userTaskKey": task_key.to_string(),
                "processInstanceKey": process_instance_key.to_string(),
                "elementInstanceKey": element_instance_key.to_string(),
                "elementId": element_id,
                "assignee": assignee,
                "formKey": form_key,
                "tenantId": tenant_id,
            }),
        });

        Ok(())
    }

    async fn complete_user_task(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let task_key: i64 = payload["userTaskKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["userTaskKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing userTaskKey".to_string()))?;

        let variables = payload.get("variables").cloned();

        let task = state.backend.get_user_task_by_key(task_key).await?;
        state.backend.complete_user_task(task_key, variables).await?;

        writers.events.push(EventToWrite {
            value_type: "USER_TASK".to_string(),
            intent: "COMPLETED".to_string(),
            key: task_key,
            payload: serde_json::json!({
                "userTaskKey": task_key.to_string(),
                "processInstanceKey": task.process_instance_key.to_string(),
                "tenantId": tenant_id,
            }),
        });

        // Complete the element instance — pass submitted variables so that
        // output mappings defined on the user task can reference them.
        let completion_vars = payload.get("variables").cloned().unwrap_or(serde_json::json!({}));
        let ei = state.backend.get_element_instance_by_key(task.element_instance_key).await?;
        let flow_scope_key = ei.flow_scope_key.unwrap_or(task.process_instance_key);
        writers.commands.push(CommandToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "COMPLETE_ELEMENT".to_string(),
            key: task.element_instance_key,
            payload: serde_json::json!({
                "elementInstanceKey": task.element_instance_key.to_string(),
                "processInstanceKey": task.process_instance_key.to_string(),
                "processDefinitionKey": task.process_definition_key.to_string(),
                "elementId": task.element_id,
                "elementType": "USER_TASK",
                "bpmnProcessId": task.bpmn_process_id,
                "flowScopeKey": flow_scope_key.to_string(),
                "variables": completion_vars,
                "tenantId": tenant_id,
            }),
        });

        Ok(())
    }

    async fn assign_user_task(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let task_key: i64 = payload["userTaskKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["userTaskKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing userTaskKey".to_string()))?;

        let assignee = payload["assignee"].as_str().map(|s| s.to_string());

        state.backend.assign_user_task(task_key, assignee.as_deref()).await?;

        writers.events.push(EventToWrite {
            value_type: "USER_TASK".to_string(),
            intent: "ASSIGNED".to_string(),
            key: task_key,
            payload: serde_json::json!({
                "userTaskKey": task_key.to_string(),
                "assignee": assignee,
                "tenantId": tenant_id,
            }),
        });

        writers.response = Some(serde_json::json!({}));
        Ok(())
    }

    async fn unassign_user_task(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let task_key: i64 = payload["userTaskKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["userTaskKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing userTaskKey".to_string()))?;

        state.backend.assign_user_task(task_key, None).await?;

        writers.events.push(EventToWrite {
            value_type: "USER_TASK".to_string(),
            intent: "ASSIGNED".to_string(),
            key: task_key,
            payload: serde_json::json!({
                "userTaskKey": task_key.to_string(),
                "assignee": null,
                "tenantId": tenant_id,
            }),
        });

        writers.response = Some(serde_json::json!({}));
        Ok(())
    }
}
