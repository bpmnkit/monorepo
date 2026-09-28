use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;
use crate::app::ApiState;
use crate::error::{ApiError, ApiResult};

fn not_implemented() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "type": "about:blank",
            "title": "Not Implemented",
            "status": 501,
            "detail": "This endpoint is not yet implemented"
        })),
    )
}

pub async fn search_decision_definitions() -> impl IntoResponse {
    not_implemented()
}

pub async fn get_decision_definition() -> impl IntoResponse {
    not_implemented()
}

pub async fn search_decision_instances() -> impl IntoResponse {
    not_implemented()
}

pub async fn search_decision_requirements() -> impl IntoResponse {
    not_implemented()
}

/// The engine command for `POST /v2/decision-definitions/evaluation`
/// (`DecisionEvaluationInstruction`: by `decisionDefinitionId`, the latest version, or by
/// `decisionDefinitionKey`), checked as Zeebe's `EvaluateDecisionRequestValidator`
/// checks it; `Err` is a 400.
pub fn evaluation_payload(body: &serde_json::Value) -> Result<serde_json::Value, ApiError> {
    let id = body["decisionDefinitionId"].as_str();
    let key = match &body["decisionDefinitionKey"] {
        serde_json::Value::Null => None,
        serde_json::Value::String(text) => Some(text.clone()),
        other => Some(other.to_string()),
    };
    let key = match (id, key) {
        (None, None) => {
            return Err(ApiError::InvalidRequest(
                "At least one of [decisionDefinitionId, decisionDefinitionKey] is required.".to_string(),
            ))
        }
        (_, Some(key)) => Some(key.parse::<i64>().map_err(|_| {
            ApiError::InvalidRequest(format!(
                "The provided decisionDefinitionKey '{key}' is not a valid key. Expected a numeric value. \
                 Did you pass an entity id instead of an entity key?."
            ))
        })?),
        (Some(_), None) => None,
    };
    Ok(json!({
        "decisionId": id.unwrap_or_default(),
        "decisionKey": key.unwrap_or(-1),
        "variables": body.get("variables").cloned().unwrap_or_else(|| json!({})),
        "tenantId": body["tenantId"].as_str().unwrap_or_default(),
    }))
}

/// Evaluate a decision: `EvaluateDecisionResult`, 404 for a decision that is not
/// deployed. A decision that fails to evaluate is a result with `failureMessage`.
pub async fn evaluate_decision(
    State(state): State<ApiState>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let payload = evaluation_payload(&body)?;
    let tenant_id = payload["tenantId"].as_str().filter(|t| !t.is_empty()).unwrap_or("<default>").to_string();
    let result = state
        .engine
        .send_command("DECISION_EVALUATION".to_string(), "EVALUATE".to_string(), payload, tenant_id)
        .await
        .map_err(ApiError::EngineError)?;
    let failure = result["failureMessage"].as_str().filter(|m| !m.is_empty());
    Ok(Json(json!({
        "decisionDefinitionId": result["decisionId"],
        "decisionDefinitionKey": result["decisionKey"],
        "decisionDefinitionName": result["decisionName"],
        "decisionDefinitionVersion": result["decisionVersion"],
        "decisionEvaluationKey": result["decisionEvaluationKey"],
        "decisionInstanceKey": result["decisionEvaluationKey"],
        "decisionRequirementsId": result["decisionRequirementsId"],
        "decisionRequirementsKey": result["decisionRequirementsKey"],
        "evaluatedDecisions": [],
        "failedDecisionDefinitionId": failure.map(|_| result["failedDecisionId"].clone()),
        "failureMessage": failure,
        "output": result["decisionOutput"],
        "tenantId": result["tenantId"],
    })))
}
