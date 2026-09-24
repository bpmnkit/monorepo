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
use crate::state::timers::Timer;
use crate::state::messages::{Message, MessageSubscription};
use crate::state::signal_subscriptions::SignalSubscription;
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
    async fn insert_records_batch(&self, records: &[DbRecord]) -> Result<()>;
    async fn fetch_commands_from(&self, partition_id: i16, from_position: i64, limit: i32) -> Result<Vec<DbRecord>>;

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

    // ---- Decision definitions (DMN) ----
    async fn insert_decision_xml(&self, decision_id: &str, dmn_xml: &str) -> Result<()>;
    async fn get_dmn_xml_by_decision_id(&self, decision_id: &str) -> Result<Option<String>>;

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
    /// Keys of the active process instances a call activity instance started.
    async fn get_child_process_instance_keys(&self, parent_element_instance_key: i64) -> Result<Vec<i64>>;
    async fn mark_timed_out_jobs(&self) -> Result<u64>;
    async fn count_active_jobs_by_type(&self) -> Result<Vec<(String, i64)>>;

    // ---- Incidents ----
    async fn insert_incident(&self, incident: &Incident) -> Result<()>;
    async fn get_incident_by_key(&self, key: i64) -> Result<Incident>;
    async fn resolve_incident(&self, key: i64) -> Result<()>;
    async fn count_active_incidents(&self) -> Result<i64>;

    // ---- Timers ----
    async fn insert_timer(&self, timer: &Timer) -> Result<()>;
    async fn get_timer_by_key(&self, key: i64) -> Result<Timer>;
    async fn update_timer_state(&self, key: i64, state: &str) -> Result<()>;
    async fn get_due_timers(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<Timer>>;

    // ---- Messages ----
    async fn insert_message(&self, msg: &Message) -> Result<()>;
    async fn get_messages_by_correlation(&self, name: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<Message>>;
    async fn expire_old_messages(&self) -> Result<u64>;

    // ---- Message subscriptions ----
    async fn insert_message_subscription(&self, sub: &MessageSubscription) -> Result<()>;
    async fn get_message_subscriptions_by_correlation(&self, message_name: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<MessageSubscription>>;
    async fn update_message_subscription_state(&self, key: i64, state: &str) -> Result<()>;

    // ---- Signal subscriptions ----
    async fn insert_signal_subscription(&self, sub: &SignalSubscription) -> Result<()>;
    async fn get_signal_subscriptions_by_name(&self, signal_name: &str, tenant_id: &str) -> Result<Vec<SignalSubscription>>;
    async fn delete_signal_subscription(&self, key: i64) -> Result<()>;

    // ---- Gateway tokens ----
    async fn increment_and_get_gateway_token(&self, process_instance_key: i64, element_id: &str) -> Result<i32>;
    async fn delete_gateway_token(&self, process_instance_key: i64, element_id: &str) -> Result<()>;

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
