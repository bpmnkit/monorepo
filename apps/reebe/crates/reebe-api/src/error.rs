use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use reebe_engine::EngineError;

/// RFC 7807 Problem Detail error response.
#[derive(Debug, Serialize)]
pub struct ProblemDetail {
    #[serde(rename = "type")]
    pub problem_type: String,
    pub title: String,
    pub status: u16,
    pub detail: String,
    pub instance: String,
}

impl ProblemDetail {
    pub fn not_found(detail: impl Into<String>, instance: impl Into<String>) -> Self {
        Self {
            problem_type: "about:blank".to_string(),
            title: "NOT_FOUND".to_string(),
            status: 404,
            detail: detail.into(),
            instance: instance.into(),
        }
    }

    pub fn invalid_argument(detail: impl Into<String>, instance: impl Into<String>) -> Self {
        Self {
            problem_type: "about:blank".to_string(),
            title: "INVALID_ARGUMENT".to_string(),
            status: 400,
            detail: detail.into(),
            instance: instance.into(),
        }
    }

    pub fn internal_error(detail: impl Into<String>, instance: impl Into<String>) -> Self {
        Self {
            problem_type: "about:blank".to_string(),
            title: "INTERNAL_ERROR".to_string(),
            status: 500,
            detail: detail.into(),
            instance: instance.into(),
        }
    }
}

#[derive(Debug)]
pub enum ApiError {
    NotFound { resource: String, key: String },
    InvalidRequest(String),
    Conflict(String),
    InternalError(String),
    EngineError(EngineError),
}

impl From<EngineError> for ApiError {
    fn from(e: EngineError) -> Self {
        match &e {
            EngineError::NotFound(msg) => ApiError::NotFound {
                resource: "resource".to_string(),
                key: msg.clone(),
            },
            EngineError::InvalidState(msg) | EngineError::InvalidArgument(msg) => ApiError::InvalidRequest(msg.clone()),
            _ => ApiError::EngineError(e),
        }
    }
}

impl From<reebe_db::DbError> for ApiError {
    fn from(e: reebe_db::DbError) -> Self {
        ApiError::InternalError(e.to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, detail) = match &self {
            ApiError::NotFound { resource, key } => (
                StatusCode::NOT_FOUND,
                ProblemDetail::not_found(
                    format!("{resource} '{key}' not found"),
                    "API/not-found",
                ),
            ),
            ApiError::InvalidRequest(msg) => (
                StatusCode::BAD_REQUEST,
                ProblemDetail::invalid_argument(msg.clone(), "API/invalid-request"),
            ),
            ApiError::Conflict(msg) => (
                StatusCode::CONFLICT,
                ProblemDetail {
                    problem_type: "about:blank".to_string(),
                    title: "CONFLICT".to_string(),
                    status: 409,
                    detail: msg.clone(),
                    instance: "API/conflict".to_string(),
                },
            ),
            ApiError::InternalError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                ProblemDetail::internal_error(msg.clone(), "API/internal"),
            ),
            ApiError::EngineError(e) => match e {
                EngineError::NotFound(msg) => (
                    StatusCode::NOT_FOUND,
                    ProblemDetail::not_found(msg.clone(), "API/not-found"),
                ),
                EngineError::InvalidState(msg) | EngineError::InvalidArgument(msg) | EngineError::BpmnParse(msg) => (
                    StatusCode::BAD_REQUEST,
                    ProblemDetail::invalid_argument(msg.clone(), "API/invalid-request"),
                ),
                _ => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ProblemDetail::internal_error(e.to_string(), "API/internal"),
                ),
            },
        };

        (status, Json(detail)).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
