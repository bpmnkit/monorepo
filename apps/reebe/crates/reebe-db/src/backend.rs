use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;
use crate::Result;
use crate::records::DbRecord;
use crate::state::process_instances::ProcessInstance;
use crate::state::element_instances::ElementInstance;
use crate::state::variables::Variable;
use crate::state::jobs::Job;
use crate::state::incidents::Incident;
use crate::state::decisions::{DecisionDefinition, DecisionRequirements};
use crate::state::timers::Timer;
use crate::state::messages::{Message, MessageStartCorrelation, MessageStartEventSubscription, MessageSubscription};
use crate::state::signal_subscriptions::SignalSubscription;
use crate::state::gateway_tokens::JoinToken;
use crate::state::compensation::CompensationSubscription;
use crate::state::deployments::{Deployment, ProcessDefinition};
use crate::state::user_tasks::UserTask;
use crate::state::identity::{Tenant, User};

/// Abstraction over the storage backend used by the engine and processors.
///
/// Implemented by `SqlxBackend` (Postgres/SQLite) and `InMemoryBackend` (WASM).
#[async_trait]
pub trait StateBackend: Send + Sync {
    // ---- Key generation ----
    async fn next_key(&self, partition_id: i16) -> Result<i64>;
    async fn next_position(&self, partition_id: i16) -> Result<i64>;
    async fn next_position_batch(&self, partition_id: i16, count: usize) -> Result<i64>;
    async fn next_position_and_key(&self, partition_id: i16) -> Result<(i64, i64)>;

    // ---- Partition lock ----
    async fn try_acquire_partition_lock(&self, partition_id: i16) -> bool;

    // ---- Records (event log) ----
    async fn insert_record(&self, record: &DbRecord) -> Result<i64>;
    /// Append a command at the next position of its partition, with a new key unless
    /// `record.record_key` is set, and return the position. Reserving the position and
    /// writing the record is atomic, so no later record becomes visible before it: a
    /// processor that has read past a position never finds a command appear behind it.
    /// `on_position` runs with the position before the command becomes visible.
    async fn append_command(&self, record: DbRecord, on_position: Box<dyn FnOnce(i64) + Send>) -> Result<i64>;
    async fn insert_records_batch(&self, records: &[DbRecord]) -> Result<()>;
    async fn fetch_commands_from(&self, partition_id: i16, from_position: i64, limit: i32) -> Result<Vec<DbRecord>>;
    /// Whether a `PROCESS_INSTANCE` `ACTIVATE_ELEMENT` command after `after_position` is
    /// still waiting to be processed with `payload[field] == value`.
    async fn has_pending_activation(&self, partition_id: i16, after_position: i64, field: &str, value: &str) -> Result<bool>;
    /// The payloads of the `PROCESS_INSTANCE` `ACTIVATE_ELEMENT` commands after
    /// `after_position` that are still waiting to be processed in the flow scope
    /// `flow_scope_key` (the payload's `flowScopeKey`).
    async fn get_pending_activations(&self, partition_id: i16, after_position: i64, flow_scope_key: &str) -> Result<Vec<Value>>;

    // ---- Processed position ----
    /// The position of the last command processed on the partition; 0 if none.
    async fn get_processed_position(&self, partition_id: i16) -> Result<i64>;
    async fn set_processed_position(&self, partition_id: i16, position: i64) -> Result<()>;

    // ---- Process instances ----
    async fn insert_process_instance(&self, pi: &ProcessInstance) -> Result<()>;
    async fn update_process_instance_state(&self, key: i64, state: &str, end_date: Option<DateTime<Utc>>) -> Result<()>;
    async fn get_process_instance_by_key(&self, key: i64) -> Result<ProcessInstance>;
    async fn count_active_process_instances(&self) -> Result<i64>;

    // ---- Element instances ----
    async fn insert_element_instance(&self, ei: &ElementInstance) -> Result<()>;
    async fn update_element_instance_state(&self, key: i64, state: &str) -> Result<()>;
    async fn get_element_instance_by_key(&self, key: i64) -> Result<ElementInstance>;
    async fn get_element_instances_by_process_instance(&self, process_instance_key: i64) -> Result<Vec<ElementInstance>>;
    async fn get_active_element_instance_count(&self, process_instance_key: i64) -> Result<i64>;
    async fn complete_process_element(&self, process_instance_key: i64) -> Result<()>;

    // ---- Variables ----
    async fn upsert_variable(&self, variable: &Variable) -> Result<()>;
    async fn get_variables_by_scope(&self, scope_key: i64) -> Result<Vec<Variable>>;

    // ---- Decision requirements and decision definitions (DMN) ----
    async fn insert_decision_requirements(&self, drg: &DecisionRequirements) -> Result<()>;
    /// The latest version of the decision requirements graph `drg_id` of the tenant.
    async fn get_latest_decision_requirements(&self, drg_id: &str, tenant_id: &str) -> Result<Option<DecisionRequirements>>;
    async fn insert_decision_definition(&self, decision: &DecisionDefinition) -> Result<()>;
    /// The latest version of the decision `decision_id` of the tenant.
    async fn get_latest_decision_definition(&self, decision_id: &str, tenant_id: &str) -> Result<Option<DecisionDefinition>>;
    async fn get_decision_definition_by_key(&self, key: i64) -> Result<Option<DecisionDefinition>>;

    // ---- Jobs ----
    async fn insert_job(&self, job: &Job) -> Result<()>;
    async fn get_job_by_key(&self, key: i64) -> Result<Job>;
    async fn complete_job(&self, key: i64, variables: Option<Value>) -> Result<()>;
    async fn fail_job(&self, key: i64, retries: i32, error_message: Option<&str>, error_code: Option<&str>, retry_back_off_ms: Option<i64>) -> Result<()>;
    async fn update_job_retries(&self, key: i64, retries: i32) -> Result<()>;
    async fn update_job_deadline(&self, key: i64, deadline: DateTime<Utc>) -> Result<()>;
    async fn cancel_jobs_by_process_instance(&self, process_instance_key: i64) -> Result<u64>;
    async fn cancel_jobs_by_element_instance(&self, element_instance_key: i64) -> Result<u64>;
    /// Stop everything an element instance waits on besides its jobs: cancel its active
    /// timers and open user tasks, close its message subscriptions and delete its signal
    /// subscriptions. Called when the element instance completes or is terminated.
    async fn cancel_element_instance_waits(&self, element_instance_key: i64) -> Result<()>;
    /// Cancel some of an element instance's waits: its timers and signal subscriptions
    /// for the catch elements `element_ids`, and its message subscriptions for
    /// `message_names`.
    async fn cancel_catch_waits(&self, element_instance_key: i64, element_ids: &[String], message_names: &[String]) -> Result<()>;
    /// Keys of the active process instances a call activity instance started.
    async fn get_child_process_instance_keys(&self, parent_element_instance_key: i64) -> Result<Vec<i64>>;
    async fn mark_timed_out_jobs(&self) -> Result<u64>;
    async fn count_active_jobs_by_type(&self) -> Result<Vec<(String, i64)>>;

    // ---- Incidents ----
    async fn insert_incident(&self, incident: &Incident) -> Result<()>;
    async fn get_incident_by_key(&self, key: i64) -> Result<Incident>;
    async fn resolve_incident(&self, key: i64) -> Result<()>;
    /// The incidents of a process instance, active and resolved.
    async fn get_incidents_by_process_instance(&self, process_instance_key: i64) -> Result<Vec<Incident>>;
    async fn count_active_incidents(&self) -> Result<i64>;

    // ---- Timers ----
    async fn insert_timer(&self, timer: &Timer) -> Result<()>;
    async fn get_timer_by_key(&self, key: i64) -> Result<Timer>;
    async fn update_timer_state(&self, key: i64, state: &str) -> Result<()>;
    async fn get_due_timers(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<Timer>>;
    /// Cancel the active timer start event timers of a process definition.
    async fn cancel_start_timers(&self, process_definition_key: i64) -> Result<()>;

    // ---- Messages ----
    async fn insert_message(&self, msg: &Message) -> Result<()>;
    async fn get_messages_by_correlation(&self, name: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<Message>>;
    async fn expire_old_messages(&self) -> Result<u64>;

    // ---- Message subscriptions ----
    async fn insert_message_subscription(&self, sub: &MessageSubscription) -> Result<()>;
    async fn get_message_subscriptions_by_correlation(&self, message_name: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<MessageSubscription>>;
    async fn update_message_subscription_state(&self, key: i64, state: &str) -> Result<()>;

    // ---- Message start events ----
    /// Replace the message start event subscriptions of a process with those of its new version.
    async fn replace_message_start_subscriptions(&self, bpmn_process_id: &str, tenant_id: &str, subs: &[MessageStartEventSubscription]) -> Result<()>;
    async fn get_message_start_subscriptions_by_name(&self, message_name: &str, tenant_id: &str) -> Result<Vec<MessageStartEventSubscription>>;
    async fn get_message_start_subscriptions_by_process(&self, bpmn_process_id: &str, tenant_id: &str) -> Result<Vec<MessageStartEventSubscription>>;
    async fn insert_message_start_correlation(&self, correlation: &MessageStartCorrelation) -> Result<()>;
    async fn get_message_start_correlations(&self, bpmn_process_id: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<MessageStartCorrelation>>;
    async fn get_message_start_correlation_by_instance(&self, process_instance_key: i64) -> Result<Option<MessageStartCorrelation>>;

    // ---- Signal subscriptions ----
    async fn insert_signal_subscription(&self, sub: &SignalSubscription) -> Result<()>;
    async fn get_signal_subscriptions_by_name(&self, signal_name: &str, tenant_id: &str) -> Result<Vec<SignalSubscription>>;
    async fn delete_signal_subscription(&self, key: i64) -> Result<()>;

    // ---- Tokens waiting at joining gateways ----
    async fn add_join_token(&self, process_instance_key: i64, flow_scope_key: i64, gateway_id: &str, sequence_flow_id: &str) -> Result<()>;
    /// Consume one token that waits on `sequence_flow_id`.
    async fn take_join_token(&self, flow_scope_key: i64, gateway_id: &str, sequence_flow_id: &str) -> Result<()>;
    async fn get_join_tokens(&self, process_instance_key: i64) -> Result<Vec<JoinToken>>;
    /// Drop the tokens waiting in a flow scope that ended.
    async fn delete_join_tokens(&self, flow_scope_key: i64) -> Result<()>;

    // ---- Compensation subscriptions ----
    /// Insert a compensation subscription, or update its throw event and handler instance.
    async fn upsert_compensation_subscription(&self, sub: &CompensationSubscription) -> Result<()>;
    /// The compensation subscriptions of a process instance, oldest first.
    async fn get_compensation_subscriptions(&self, process_instance_key: i64) -> Result<Vec<CompensationSubscription>>;
    async fn delete_compensation_subscription(&self, key: i64) -> Result<()>;

    // ---- Deployments ----
    async fn insert_deployment(&self, deployment: &Deployment) -> Result<()>;
    async fn insert_process_definition(&self, pd: &ProcessDefinition) -> Result<()>;
    async fn get_process_definition_by_key(&self, key: i64) -> Result<ProcessDefinition>;
    async fn get_latest_process_definition(&self, bpmn_process_id: &str, tenant_id: &str) -> Result<ProcessDefinition>;
    async fn get_process_definition_by_id_and_version(&self, bpmn_process_id: &str, version: i32, tenant_id: &str) -> Result<ProcessDefinition>;

    // ---- User tasks ----
    async fn insert_user_task(&self, task: &UserTask) -> Result<()>;
    async fn get_user_task_by_key(&self, key: i64) -> Result<UserTask>;
    async fn complete_user_task(&self, key: i64, variables: Option<Value>) -> Result<()>;
    async fn assign_user_task(&self, key: i64, assignee: Option<&str>) -> Result<()>;

    // ---- Identity ----
    async fn insert_tenant(&self, tenant: &Tenant) -> Result<()>;
    async fn insert_user(&self, user: &User) -> Result<()>;
    async fn delete_user(&self, username: &str) -> Result<()>;
}
