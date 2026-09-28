use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::variables::Variable;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{EventToWrite, RecordProcessor, Writers};

pub struct VariableDocumentProcessor;

#[async_trait]
impl RecordProcessor for VariableDocumentProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        (value_type == "VARIABLE" && intent == "SET_DOCUMENT")
            || (value_type == "VARIABLE_DOCUMENT" && intent == "UPDATE")
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

        // The gRPC `SetVariables` call names the scope by `elementInstanceKey`: a process
        // instance or an element instance. `local: false` propagates from it, as Zeebe
        // does: each variable goes to the nearest scope that has it, else the process.
        let key = |name: &str| payload[name].as_str().and_then(|s| s.parse().ok()).or_else(|| payload[name].as_i64());
        if let Some(scope_key) = key("elementInstanceKey") {
            let process_instance_key = match state.backend.get_element_instance_by_key(scope_key).await {
                Ok(scope) => scope.process_instance_key,
                Err(_) => state.backend.get_process_instance_by_key(scope_key).await.map(|pi| pi.key).map_err(|_| {
                    EngineError::NotFound(format!(
                        "Expected to update variables for element with key '{scope_key}', but no such element was found"
                    ))
                })?,
            };
            let variables = payload["variables"].as_object().cloned().unwrap_or_default();
            if payload["local"].as_bool() == Some(true) {
                for (name, value) in variables {
                    super::scope::set_local(state, process_instance_key, scope_key, &name, value, &tenant_id).await?;
                }
            } else {
                super::scope::propagate(state, process_instance_key, scope_key, &variables, &tenant_id).await?;
            }
            writers.response = Some(serde_json::json!({
                "processInstanceKey": process_instance_key.to_string(),
                "tenantId": tenant_id,
            }));
            return Ok(());
        }

        let process_instance_key: i64 = key("processInstanceKey")
            .ok_or_else(|| EngineError::InvalidState("Missing processInstanceKey".to_string()))?;

        // Scope key: LOCAL uses element scope, PROPAGATE/default uses process instance scope
        let propagation = payload["local"]
            .as_bool()
            .map(|b| if b { "LOCAL" } else { "PROPAGATE" })
            .or_else(|| payload["propagation"].as_str())
            .unwrap_or("PROPAGATE");

        let scope_key: i64 = if propagation == "LOCAL" {
            payload["scopeKey"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .or_else(|| payload["scopeKey"].as_i64())
                .unwrap_or(process_instance_key)
        } else {
            // PROPAGATE: use process instance scope
            process_instance_key
        };

        if let Some(variables) = payload["variables"].as_object() {
            for (name, value) in variables {
                let var_key = key_gen.next_key().await?;
                let variable = Variable {
                    key: var_key,
                    partition_id: state.partition_id,
                    name: name.clone(),
                    value: value.clone(),
                    scope_key,
                    process_instance_key,
                    tenant_id: tenant_id.clone(),
                    is_preview: false,
                };
                state.backend.upsert_variable(&variable).await?;

                writers.events.push(EventToWrite {
                    value_type: "VARIABLE".to_string(),
                    intent: "CREATED".to_string(),
                    key: var_key,
                    payload: serde_json::json!({
                        "variableKey": var_key.to_string(),
                        "name": name,
                        "value": value,
                        "scopeKey": scope_key.to_string(),
                        "processInstanceKey": process_instance_key.to_string(),
                        "tenantId": tenant_id,
                    }),
                });
            }
        }

        writers.response = Some(serde_json::json!({
            "processInstanceKey": process_instance_key.to_string(),
            "tenantId": tenant_id,
        }));

        Ok(())
    }
}
