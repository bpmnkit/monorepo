//! `DECISION_EVALUATION` `EVALUATE`: evaluate a deployed decision, named by its id (the
//! latest version) or by its key, as Zeebe's `DecisionEvaluationEvaluateProcessor` does.

use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{EventToWrite, RecordProcessor, Writers};

pub struct DecisionEvaluationProcessor;

fn key_of(value: &serde_json::Value) -> Option<i64> {
    match value {
        serde_json::Value::String(text) => text.parse().ok(),
        other => other.as_i64(),
    }
}

#[async_trait]
impl RecordProcessor for DecisionEvaluationProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "DECISION_EVALUATION" && intent == "EVALUATE"
    }

    async fn process(&self, record: &DbRecord, state: &EngineState, writers: &mut Writers) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = payload["tenantId"].as_str().filter(|t| !t.is_empty()).unwrap_or(&record.tenant_id).to_string();
        let decision_id = payload["decisionId"].as_str().unwrap_or_default();
        let decision_key = key_of(&payload["decisionKey"]).unwrap_or(-1);
        let decision = if !decision_id.is_empty() {
            state.backend.get_latest_decision_definition(decision_id, &tenant_id).await?.ok_or_else(|| {
                EngineError::NotFound(format!(
                    "Expected to evaluate decision '{decision_id}', but no decision found for id '{decision_id}'"
                ))
            })?
        } else if decision_key > -1 {
            state.backend
                .get_decision_definition_by_key(decision_key)
                .await?
                .filter(|d| d.tenant_id == tenant_id)
                .ok_or_else(|| {
                    EngineError::NotFound(format!(
                        "Expected to evaluate decision '{decision_key}', but no decision found for key '{decision_key}'"
                    ))
                })?
        } else {
            return Err(EngineError::InvalidArgument(
                "Expected either a decision id or a valid decision key, but none provided".to_string(),
            ));
        };

        let drg = reebe_dmn::parse_dmn(&decision.dmn_xml)
            .map_err(|e| EngineError::Internal(format!("DMN of decision '{}' does not parse: {e}", decision.decision_id)))?;
        let variables = match &payload["variables"] {
            serde_json::Value::Object(_) => payload["variables"].clone(),
            _ => serde_json::json!({}),
        };
        let (output, failure) = match reebe_dmn::evaluate_decision(&drg, &decision.decision_id, &variables) {
            Ok(output) => (output, None),
            Err(e) => (serde_json::Value::Null, Some(e.to_string())),
        };
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let evaluation_key = key_gen.next_key().await?;
        let result = serde_json::json!({
            "decisionEvaluationKey": evaluation_key.to_string(),
            "decisionKey": decision.key.to_string(),
            "decisionId": decision.decision_id,
            "decisionName": decision.name.clone().unwrap_or_default(),
            "decisionVersion": decision.version,
            "decisionRequirementsKey": decision.decision_requirements_key.to_string(),
            "decisionRequirementsId": decision.decision_requirements_id,
            "decisionOutput": output.to_string(),
            "failedDecisionId": if failure.is_some() { decision.decision_id.clone() } else { String::new() },
            "failureMessage": failure.clone().unwrap_or_default(),
            "tenantId": decision.tenant_id,
        });
        writers.events.push(EventToWrite {
            value_type: "DECISION_EVALUATION".to_string(),
            intent: if failure.is_some() { "FAILED" } else { "EVALUATED" }.to_string(),
            key: evaluation_key,
            payload: result.clone(),
        });
        writers.response = Some(result);
        Ok(())
    }
}
