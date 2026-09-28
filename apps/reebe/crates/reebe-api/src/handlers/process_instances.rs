use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;
use reebe_db::state::process_instances::ProcessInstanceRepository;
use reebe_db::state::incidents::IncidentRepository;
use reebe_db::state::element_instances::ElementInstanceRepository;
use reebe_db::state::batch_operations::{BatchOperation, BatchOperationRepository};
use crate::app::ApiState;
use crate::dto::process_instances::{
    CreateProcessInstanceRequest,
    ProcessInstanceDto, SearchProcessInstancesRequest,
};
use crate::dto::incidents::IncidentDto;
use crate::error::{ApiError, ApiResult};
use crate::pagination::{PageRequest, PageResponse};
use crate::tenant::tenant_from_headers;

pub async fn create_process_instance(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(req): Json<CreateProcessInstanceRequest>,
) -> ApiResult<impl IntoResponse> {
    let header_tenant = tenant_from_headers(&headers);
    let tenant_id = if header_tenant != "<default>" {
        header_tenant
    } else {
        req.tenant_id.unwrap_or_else(|| "<default>".to_string())
    };

    let mut payload = serde_json::json!({
        "tenantId": tenant_id,
    });

    if let Some(key) = &req.process_definition_key {
        payload["processDefinitionKey"] = serde_json::Value::String(key.clone());
    }
    if let Some(id) = &req.bpmn_process_id {
        payload["bpmnProcessId"] = serde_json::Value::String(id.clone());
    }
    if let Some(version) = req.version {
        payload["version"] = serde_json::Value::Number(version.into());
    }
    if let Some(vars) = &req.variables {
        payload["variables"] = vars.clone();
    }

    let response = state
        .engine
        .send_command(
            "PROCESS_INSTANCE_CREATION".to_string(),
            "CREATE".to_string(),
            payload,
            tenant_id,
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok((StatusCode::OK, Json(response)))
}

pub async fn get_process_instance(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ProcessInstanceRepository::new(pool);
    let pi = repo.get_by_key(key_i64).await.map_err(|_e| {
        ApiError::NotFound {
            resource: "process instance".to_string(),
            key: key.clone(),
        }
    })?;

    Ok(Json(ProcessInstanceDto::from(pi)))
}

pub async fn search_process_instances(
    State(state): State<ApiState>,
    Json(req): Json<SearchProcessInstancesRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();

    let filter = req.filter.unwrap_or_default();

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ProcessInstanceRepository::new(pool);
    let instances = repo
        .search(
            filter.state.as_deref(),
            filter.bpmn_process_id.as_deref(),
            filter.tenant_id.as_deref(),
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = instances.first().map(|i| i.key);
    let last_key = instances.last().map(|i| i.key);
    let dtos: Vec<ProcessInstanceDto> = instances.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}

pub async fn cancel_process_instance(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let _key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let payload = serde_json::json!({
        "processInstanceKey": key,
    });

    state
        .engine
        .send_command(
            "PROCESS_INSTANCE".to_string(),
            "CANCEL".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn batch_cancel_process_instances(
    State(state): State<ApiState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let batch_key = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    // Collect instance keys from request filter
    let instance_keys: Vec<i64> = req
        .get("filter")
        .and_then(|f| f.get("processInstanceKeys"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
                .collect()
        })
        .unwrap_or_default();

    let items_count = instance_keys.len() as i64;

    // Insert batch operation record
    let batch_repo = BatchOperationRepository::new(&state.pool);
    let batch_op = BatchOperation {
        key: batch_key,
        operation_type: "CANCEL_PROCESS_INSTANCE".to_string(),
        state: "ACTIVE".to_string(),
        items_count,
        completed_items: 0,
        failed_items: 0,
        error_message: None,
        created_at: chrono::Utc::now(),
        completed_at: None,
    };
    batch_repo
        .insert(&batch_op)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let mut completed = 0i64;
    let mut failed = 0i64;

    for key in &instance_keys {
        let payload = serde_json::json!({ "processInstanceKey": key.to_string() });
        match state
            .engine
            .send_command(
                "PROCESS_INSTANCE".to_string(),
                "CANCEL".to_string(),
                payload,
                "<default>".to_string(),
            )
            .await
        {
            Ok(_) => completed += 1,
            Err(_) => failed += 1,
        }
    }

    batch_repo
        .update_progress(batch_key, completed, failed)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;
    batch_repo
        .mark_completed(batch_key)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    Ok(Json(json!({ "batchOperationKey": batch_key.to_string() })))
}

pub async fn delete_process_instances(
    State(state): State<ApiState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let batch_key = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let instance_keys: Vec<i64> = req
        .get("filter")
        .and_then(|f| f.get("processInstanceKeys"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
                .collect()
        })
        .unwrap_or_default();

    let items_count = instance_keys.len() as i64;

    let batch_repo = BatchOperationRepository::new(&state.pool);
    let batch_op = BatchOperation {
        key: batch_key,
        operation_type: "DELETE_PROCESS_INSTANCE".to_string(),
        state: "ACTIVE".to_string(),
        items_count,
        completed_items: 0,
        failed_items: 0,
        error_message: None,
        created_at: chrono::Utc::now(),
        completed_at: None,
    };
    batch_repo
        .insert(&batch_op)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let mut completed = 0i64;
    let mut failed = 0i64;

    for key in &instance_keys {
        let payload = serde_json::json!({ "processInstanceKey": key.to_string() });
        match state
            .engine
            .send_command(
                "PROCESS_INSTANCE".to_string(),
                "CANCEL".to_string(),
                payload,
                "<default>".to_string(),
            )
            .await
        {
            Ok(_) => completed += 1,
            Err(_) => failed += 1,
        }
    }

    batch_repo
        .update_progress(batch_key, completed, failed)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;
    batch_repo
        .mark_completed(batch_key)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    Ok(Json(json!({ "batchOperationKey": batch_key.to_string() })))
}

pub async fn batch_migrate_process_instances(
    State(_state): State<ApiState>,
    Json(_req): Json<serde_json::Value>,
) -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "title": "Not Implemented",
            "status": 501,
            "detail": "Batch migration not yet implemented"
        })),
    )
}

pub async fn migrate_process_instance() -> impl IntoResponse {
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

/// A key of the REST API: a string of digits, or a number.
fn rest_key(value: &serde_json::Value, field: &str, violations: &mut Vec<String>) -> i64 {
    let text = match value {
        serde_json::Value::Null => return -1,
        serde_json::Value::String(text) => text.clone(),
        other => other.to_string(),
    };
    text.parse().unwrap_or_else(|_| {
        violations.push(format!(
            "The provided {field} '{text}' is not a valid key. Expected a numeric value. Did you pass an entity id instead of an entity key?"
        ));
        -1
    })
}

/// `ModifyProcessInstanceVariableInstruction`s as the engine's variable instructions.
fn rest_variable_instructions(value: &serde_json::Value, violations: &mut Vec<String>) -> Vec<serde_json::Value> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .map(|vi| {
            let variables = vi["variables"].as_object().cloned().unwrap_or_default();
            if variables.is_empty() && !violations.iter().any(|v| v == "No variables provided") {
                violations.push("No variables provided".to_string());
            }
            json!({ "elementId": vi["scopeId"].as_str().unwrap_or_default(), "variables": variables })
        })
        .collect()
}

/// The engine command for `POST /v2/process-instances/{key}/modification`, from the body
/// the specification defines (`ProcessInstanceModificationInstruction`), checked as
/// Zeebe's `ProcessInstanceRequestValidator` checks it; `Err` is a 400.
pub fn modification_payload(key: &str, body: &serde_json::Value) -> Result<serde_json::Value, ApiError> {
    let mut violations = Vec::new();
    let once = |violations: &mut Vec<String>, message: &str| {
        if !violations.iter().any(|v| v == message) {
            violations.push(message.to_string());
        }
    };
    let process_instance_key = rest_key(&json!(key), "processInstanceKey", &mut violations);
    let activate: Vec<serde_json::Value> = body["activateInstructions"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|a| {
            if a["elementId"].as_str().is_none() {
                once(&mut violations, "No elementId provided");
            }
            json!({
                "elementId": a["elementId"].as_str().unwrap_or_default(),
                "ancestorScopeKey": rest_key(&a["ancestorElementInstanceKey"], "ancestorElementInstanceKey", &mut violations),
                "variableInstructions": rest_variable_instructions(&a["variableInstructions"], &mut violations),
            })
        })
        .collect();
    let terminate: Vec<serde_json::Value> = body["terminateInstructions"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|t| {
            if t.get("elementInstanceKey").is_some() {
                json!({ "elementInstanceKey": rest_key(&t["elementInstanceKey"], "elementInstanceKey", &mut violations) })
            } else {
                let id = t["elementId"].as_str().unwrap_or_default();
                if id.trim().is_empty() {
                    once(&mut violations, "No elementId provided");
                }
                json!({ "elementId": id })
            }
        })
        .collect();
    let moves: Vec<serde_json::Value> = body["moveInstructions"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|m| {
            let source = &m["sourceElementInstruction"];
            let (source_id, source_key) = match source["sourceType"].as_str() {
                _ if source.is_null() => {
                    once(&mut violations, "No sourceElementInstruction provided");
                    (String::new(), -1)
                }
                Some("byKey") => (
                    String::new(),
                    rest_key(&source["sourceElementInstanceKey"], "sourceElementInstanceKey", &mut violations),
                ),
                _ => {
                    let id = source["sourceElementId"].as_str().unwrap_or_default().to_string();
                    if id.trim().is_empty() {
                        once(&mut violations, "No sourceElementId provided");
                    }
                    (id, -1)
                }
            };
            let target = m["targetElementId"].as_str().unwrap_or_default();
            if target.trim().is_empty() {
                once(&mut violations, "No targetElementId provided");
            }
            let ancestor = &m["ancestorScopeInstruction"];
            let scope_type = ancestor["ancestorScopeType"].as_str().unwrap_or("direct");
            let ancestor_key = if ancestor.is_null() || scope_type != "direct" {
                -1
            } else {
                rest_key(&ancestor["ancestorElementInstanceKey"], "ancestorElementInstanceKey", &mut violations)
            };
            json!({
                "sourceElementId": source_id,
                "sourceElementInstanceKey": source_key,
                "targetElementId": target,
                "ancestorScopeKey": ancestor_key,
                "inferAncestorScopeFromSourceHierarchy": scope_type == "inferred",
                "useSourceParentKeyAsAncestorScopeKey": scope_type == "sourceParent",
                "variableInstructions": rest_variable_instructions(&m["variableInstructions"], &mut violations),
            })
        })
        .collect();
    if !violations.is_empty() {
        let mut detail = violations.join(". ");
        if !detail.ends_with('.') {
            detail.push('.');
        }
        return Err(ApiError::InvalidRequest(detail));
    }
    Ok(json!({
        "processInstanceKey": process_instance_key.to_string(),
        "activateInstructions": activate,
        "terminateInstructions": terminate,
        "moveInstructions": moves,
    }))
}

/// Modify a process instance: 204, 404 for a process instance that is not active,
/// 400 for instructions Zeebe rejects.
pub async fn modify_process_instance(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<impl IntoResponse> {
    let payload = modification_payload(&key, &body)?;
    state
        .engine
        .send_command(
            "PROCESS_INSTANCE_MODIFICATION".to_string(),
            "MODIFY".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn resolve_incident_for_process_instance(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let repo = IncidentRepository::new(&state.pool);
    let incidents = repo
        .get_by_process_instance(key_i64)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let active_incidents: Vec<_> = incidents
        .into_iter()
        .filter(|i| i.state == "CREATED" || i.state == "ACTIVE")
        .collect();

    for incident in &active_incidents {
        let payload = serde_json::json!({
            "incidentKey": incident.key.to_string(),
        });
        state
            .engine
            .send_command(
                "INCIDENT".to_string(),
                "RESOLVE".to_string(),
                payload,
                "<default>".to_string(),
            )
            .await
            .map_err(ApiError::EngineError)?;
    }

    Ok(Json(json!({
        "resolvedIncidents": active_incidents.len()
    })))
}

pub async fn get_call_hierarchy(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ProcessInstanceRepository::new(pool);
    let pi = repo.get_by_key(key_i64).await.map_err(|_| ApiError::NotFound {
        resource: "process instance".to_string(),
        key: key.clone(),
    })?;

    // Walk up parent chain
    let parent_info = if let Some(parent_key) = pi.parent_process_instance_key {
        match repo.get_by_key(parent_key).await {
            Ok(parent) => Some(json!({
                "key": parent.key.to_string(),
                "bpmnProcessId": parent.bpmn_process_id,
            })),
            Err(_) => None,
        }
    } else {
        None
    };

    // Find children (instances whose parent_process_instance_key == key_i64)
    let children = repo
        .search(None, None, None, 100, None)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?
        .into_iter()
        .filter(|child| child.parent_process_instance_key == Some(key_i64))
        .map(|child| json!({
            "key": child.key.to_string(),
            "bpmnProcessId": child.bpmn_process_id,
        }))
        .collect::<Vec<_>>();

    Ok(Json(json!({
        "key": pi.key.to_string(),
        "bpmnProcessId": pi.bpmn_process_id,
        "parent": parent_info,
        "children": children,
    })))
}

pub async fn get_sequence_flows(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = ElementInstanceRepository::new(pool);
    let elements = repo
        .get_by_process_instance(key_i64)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let sequence: Vec<_> = elements
        .into_iter()
        .filter(|e| e.state == "COMPLETED" || e.state == "ACTIVE")
        .map(|e| json!({
            "elementInstanceKey": e.key.to_string(),
            "elementId": e.element_id,
            "elementType": e.element_type,
            "state": e.state,
        }))
        .collect();

    Ok(Json(json!({ "items": sequence })))
}

#[derive(Debug, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchIncidentsForInstanceRequest {
    pub filter: Option<InstanceIncidentFilter>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstanceIncidentFilter {
    pub state: Option<String>,
    pub error_type: Option<String>,
}

pub async fn search_process_instance_incidents(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(req): Json<SearchIncidentsForInstanceRequest>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let repo = IncidentRepository::new(&state.pool);
    let incidents = repo
        .search(
            filter.state.as_deref(),
            filter.error_type.as_deref(),
            Some(key_i64),
            None,
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = incidents.first().map(|i| i.key);
    let last_key = incidents.last().map(|i| i.key);
    let dtos: Vec<IncidentDto> = incidents.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}
