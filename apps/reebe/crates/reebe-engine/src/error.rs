use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("Database error: {0}")]
    Db(#[from] reebe_db::DbError),
    #[error("BPMN parse error: {0}")]
    BpmnParse(String),
    #[error("Expression evaluation error: {0}")]
    Expression(String),
    #[error("Not found: {0}")]
    NotFound(String),
    /// A command Zeebe rejects as `INVALID_ARGUMENT`.
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
    #[error("Invalid state: {0}")]
    InvalidState(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

pub type EngineResult<T> = Result<T, EngineError>;
