pub mod deployment;
pub mod process_instance;
pub mod bpmn_element;
pub mod job;
pub mod message;
pub mod timer;
pub mod incident;
pub mod user_task;
pub mod signal;
pub mod identity;
pub mod variable;
pub(crate) mod throw_event;
pub(crate) mod catch_event;
pub(crate) mod scope;
pub(crate) mod multi_instance;
pub(crate) mod start_event;
pub(crate) mod cron;
pub(crate) mod join;
pub(crate) mod compensation;
pub(crate) mod ad_hoc;
pub mod modification;

pub use deployment::DeploymentProcessor;
pub use process_instance::{ProcessInstanceCreationProcessor, ProcessInstanceCancelProcessor};
pub use bpmn_element::BpmnElementProcessor;
pub use job::JobProcessor;
pub use message::MessageProcessor;
pub use timer::TimerProcessor;
pub use incident::IncidentProcessor;
pub use user_task::UserTaskProcessor;
pub use signal::SignalProcessor;
pub use identity::IdentityProcessor;
pub use variable::VariableDocumentProcessor;
pub use ad_hoc::AdHocSubProcessInstructionProcessor;
pub use modification::ProcessInstanceModificationProcessor;

use async_trait::async_trait;
use reebe_db::records::DbRecord;
use crate::engine::EngineState;
use crate::error::EngineResult;

/// Output writers collected during a single record processing step.
pub struct Writers {
    pub events: Vec<EventToWrite>,
    pub commands: Vec<CommandToWrite>,
    pub response: Option<serde_json::Value>,
    pub rejection: Option<String>,
}

impl Writers {
    pub fn new() -> Self {
        Self {
            events: Vec::new(),
            commands: Vec::new(),
            response: None,
            rejection: None,
        }
    }
}

impl Default for Writers {
    fn default() -> Self {
        Self::new()
    }
}

/// An event record to write to the log and state.
pub struct EventToWrite {
    pub value_type: String,
    pub intent: String,
    pub key: i64,
    pub payload: serde_json::Value,
}

/// A follow-up command to write to the log.
pub struct CommandToWrite {
    pub value_type: String,
    pub intent: String,
    pub key: i64,
    pub payload: serde_json::Value,
}

/// Trait that all record processors must implement.
#[async_trait]
pub trait RecordProcessor: Send + Sync {
    /// Returns true if this processor handles the given value_type and intent.
    fn accepts(&self, value_type: &str, intent: &str) -> bool;

    /// Process a command record and write results to writers.
    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()>;
}
