use std::time::Duration;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use reebe_db::state::jobs::JobRepository;
use crate::app::ApiState;
use crate::dto::jobs::{
    ActivateJobsRequest, ActivateJobsResponse, ActivatedJob,
    CompleteJobRequest, FailJobRequest, ThrowErrorRequest,
    SearchJobsRequest, JobDto,
};
use crate::error::{ApiError, ApiResult};
use crate::pagination::PageResponse;

pub async fn activate_jobs(
    State(state): State<ApiState>,
    Json(req): Json<ActivateJobsRequest>,
) -> ApiResult<impl IntoResponse> {
    let max_jobs = req.max_jobs_to_activate as i64;
    let timeout_ms = req.timeout;
    let request_timeout = req.request_timeout.unwrap_or(0);
    let worker = req.worker.as_deref().unwrap_or("default");

    // Try immediate activation
    let jobs = reebe_db::state::jobs::activate_jobs(
        &state.pool,
        &req.job_type,
        worker,
        max_jobs,
        timeout_ms,
    )
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    if !jobs.is_empty() || request_timeout == 0 {
        let activated: Vec<ActivatedJob> = jobs.into_iter().map(Into::into).collect();
        return Ok(Json(ActivateJobsResponse { jobs: activated }));
    }

    // Long polling: wait for notification or timeout
    let notifier = state.engine.job_notifier.get_or_create(&req.job_type);
    let _ = tokio::time::timeout(
        Duration::from_millis(request_timeout as u64),
        notifier.notified(),
    )
    .await;

    // Try again after notification
    let jobs = reebe_db::state::jobs::activate_jobs(
        &state.pool,
        &req.job_type,
        worker,
        max_jobs,
        timeout_ms,
    )
    .await
    .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let activated: Vec<ActivatedJob> = jobs.into_iter().map(Into::into).collect();
    Ok(Json(ActivateJobsResponse { jobs: activated }))
}

pub async fn get_job(
    State(state): State<ApiState>,
    Path(key): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let key_i64: i64 = key.parse().map_err(|_| {
        ApiError::InvalidRequest(format!("Invalid key: {key}"))
    })?;

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = JobRepository::new(pool);
    let job = repo.get_by_key(key_i64).await.map_err(|_| ApiError::NotFound {
        resource: "job".to_string(),
        key: key.clone(),
    })?;

    Ok(Json(JobDto::from(job)))
}

pub async fn search_jobs(
    State(state): State<ApiState>,
    Json(req): Json<SearchJobsRequest>,
) -> ApiResult<impl IntoResponse> {
    let page = req.page.unwrap_or_default();
    let page_size = page.page_size_or_default();
    let after_key = page.after_key();
    let filter = req.filter.unwrap_or_default();

    let process_instance_key: Option<i64> = filter
        .process_instance_key
        .as_deref()
        .and_then(|s| s.parse().ok());

    let pool = state.replica_pool.as_ref().unwrap_or(&state.pool);
    let repo = JobRepository::new(pool);
    let jobs = repo
        .search(
            filter.state.as_deref(),
            filter.job_type.as_deref(),
            process_instance_key,
            filter.tenant_id.as_deref(),
            page_size,
            after_key,
        )
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let first_key = jobs.first().map(|j| j.key);
    let last_key = jobs.last().map(|j| j.key);
    let dtos: Vec<JobDto> = jobs.into_iter().map(Into::into).collect();

    Ok(Json(PageResponse::new(dtos, first_key, last_key)))
}

pub async fn complete_job(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(req): Json<CompleteJobRequest>,
) -> ApiResult<impl IntoResponse> {
    // The `result` of an ad-hoc sub-process's job activates its inner elements.
    let payload = serde_json::json!({
        "jobKey": key,
        "variables": req.variables.unwrap_or_default(),
        "result": req.result,
    });

    state
        .engine
        .send_command(
            "JOB".to_string(),
            "COMPLETE".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn fail_job(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(req): Json<FailJobRequest>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "jobKey": key,
        "retries": req.retries,
        "errorMessage": req.error_message,
        "retryBackOff": req.retry_back_off.unwrap_or(0),
        "variables": req.variables.unwrap_or_default(),
    });

    state
        .engine
        .send_command(
            "JOB".to_string(),
            "FAIL".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn throw_error(
    State(state): State<ApiState>,
    Path(key): Path<String>,
    Json(req): Json<ThrowErrorRequest>,
) -> ApiResult<impl IntoResponse> {
    let payload = serde_json::json!({
        "jobKey": key,
        "errorCode": req.error_code,
        "errorMessage": req.error_message,
        "variables": req.variables.unwrap_or_default(),
    });

    state
        .engine
        .send_command(
            "JOB".to_string(),
            "THROW_ERROR".to_string(),
            payload,
            "<default>".to_string(),
        )
        .await
        .map_err(ApiError::EngineError)?;

    Ok(StatusCode::NO_CONTENT)
}
