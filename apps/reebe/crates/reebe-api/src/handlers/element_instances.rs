use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::element_instances::ElementInstanceRepository;
use crate::app::ApiState;
use crate::dto::element_instances::{
    ActivateAdHocActivitiesRequest, ElementInstanceDto, SearchElementInstancesRequest,
};
use crate::error::{ApiError, ApiResult};
use crate::pagination::PageResponse;

pub async fn get(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ElementInstanceRepository::new(pool);
    let ei = repo.get_by_key(key_i64).await.map_err(|_| ApiError::NotFound {
        resource: "element instance".to_string(),
        key: key.clone(),
    })?;

    Ok(Json(ElementInstanceDto::from(ei)))
}

pub async fn search(
    State(state): State<ApiState>,
    Json(req): Json<SearchElementInstancesRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let _after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let process_instance_key: Option<i64> = filter
        .process_instance_key
        .as_deref()
        .and_then(|s| s.parse().ok());

    // We use get_by_process_instance if key provided, otherwise return empty
    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let eis = if let Some(pi_key) = process_instance_key {
        let repo = ElementInstanceRepository::new(pool);
        repo.get_by_process_instance(pi_key)
            .await
            .map_err(|e| ApiError::InternalError(e.to_string()))?
    } else {
        vec![]
    };

    let first_key = eis.first().map(|e| e.key);
    let last_key = eis.last().map(|e| e.key);
    let dtos: Vec<ElementInstanceDto> = eis.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}

/// The engine command for `POST /v2/element-instances/ad-hoc-activities/{key}/activation`;
/// `Err` is a 400 for a body the specification does not allow.
pub fn ad_hoc_activation_payload(
    key: &str,
    req: ActivateAdHocActivitiesRequest,
) -> Result<serde_json::Value, ApiError> {
    let elements = req
        .elements
        .ok_or_else(|| ApiError::InvalidRequest("No elements provided: 'elements' is required".to_string()))?;
    let elements = elements
        .into_iter()
        .map(|element| match element.element_id {
            Some(id) if !id.is_empty() => Ok(serde_json::json!({
                "elementId": id,
                "variables": element.variables.unwrap_or_default(),
            })),
            _ => Err(ApiError::InvalidRequest("No elementId provided for an element to activate".to_string())),
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(serde_json::json!({
        "adHocSubProcessInstanceKey": key,
        "elements": elements,
        "cancelRemainingInstances": req.cancel_remaining_instances,
    }))
}

/// Activate activities within an active ad-hoc sub-process: 204, or 404 when the key
/// is not an ad-hoc sub-process instance or names an element it cannot activate.
pub async fn activate_ad_hoc_activities(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(req): Json<ActivateAdHocActivitiesRequest>,
) -> ApiResult<impl IntoResponse> {
    let payload = ad_hoc_activation_payload(&key, req)?;
    state
        .engine
        .send_command(
            "AD_HOC_SUB_PROCESS_INSTRUCTION".to_string(),
            "ACTIVATE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;
    Ok(StatusCode::NO_CONTENT)
}
