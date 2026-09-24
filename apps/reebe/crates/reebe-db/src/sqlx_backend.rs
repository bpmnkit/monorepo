use std::sync::Arc;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;
use crate::{DbPool, Result};
use crate::records::{DbRecord, RecordRepository};
use crate::state::process_instances::{ProcessInstance, ProcessInstanceRepository};
use crate::state::element_instances::{ElementInstance, ElementInstanceRepository};
use crate::state::variables::{Variable, VariableRepository};
use crate::state::jobs::{Job, JobRepository};
use crate::state::incidents::{Incident, IncidentRepository};
use crate::state::timers::{Timer, TimerRepository};
use crate::state::messages::{Message, MessageSubscription, MessageRepository, MessageSubscriptionRepository};
use crate::state::signal_subscriptions::{SignalSubscription, SignalSubscriptionRepository};
use crate::state::gateway_tokens::GatewayTokenRepository;
use crate::state::deployments::{Deployment, ProcessDefinition, DeploymentRepository};
use crate::state::user_tasks::{UserTask, UserTaskRepository};
use crate::state::identity::{Tenant, User, TenantRepository, UserRepository};
use crate::backend::StateBackend;

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct SqlxBackend {
    pub pool: Arc<DbPool>,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl SqlxBackend {
    pub fn new(pool: DbPool) -> Self {
        Self { pool: Arc::new(pool) }
    }

    pub fn pool(&self) -> &DbPool {
        &self.pool
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
#[async_trait]
impl StateBackend for SqlxBackend {
    async fn next_key(&self, partition_id: i16) -> Result<i64> {
        crate::records::next_key(&self.pool, partition_id).await
    }

    async fn next_position(&self, partition_id: i16) -> Result<i64> {
        RecordRepository::new(&self.pool).next_position(partition_id).await
    }

    async fn next_position_batch(&self, partition_id: i16, count: usize) -> Result<i64> {
        RecordRepository::new(&self.pool).next_position_batch(partition_id, count).await
    }

    async fn next_position_and_key(&self, partition_id: i16) -> Result<(i64, i64)> {
        RecordRepository::new(&self.pool).next_position_and_key(partition_id).await
    }

    async fn try_acquire_partition_lock(&self, partition_id: i16) -> bool {
        #[cfg(feature = "postgres")]
        {
            match sqlx::query_scalar::<_, bool>("SELECT pg_try_advisory_lock($1::bigint)")
                .bind(partition_id as i64)
                .fetch_one(self.pool.as_ref())
                .await
            {
                Ok(acquired) => acquired,
                Err(e) => {
                    tracing::warn!("Advisory lock attempt failed for partition {}: {}", partition_id, e);
                    false
                }
            }
        }
        #[cfg(feature = "sqlite")]
        {
            let _ = partition_id;
            true
        }
    }

    async fn insert_record(&self, record: &DbRecord) -> Result<i64> {
        RecordRepository::new(&self.pool).insert(record).await
    }

    async fn insert_records_batch(&self, records: &[DbRecord]) -> Result<()> {
        RecordRepository::new(&self.pool).insert_batch(records).await
    }

    async fn fetch_commands_from(&self, partition_id: i16, from_position: i64, limit: i32) -> Result<Vec<DbRecord>> {
        RecordRepository::new(&self.pool).fetch_commands_from(partition_id, from_position, limit).await
    }

    async fn insert_process_instance(&self, pi: &ProcessInstance) -> Result<()> {
        ProcessInstanceRepository::new(&self.pool).insert(pi).await
    }

    async fn update_process_instance_state(&self, key: i64, state: &str, end_date: Option<DateTime<Utc>>) -> Result<()> {
        ProcessInstanceRepository::new(&self.pool).update_state(key, state, end_date).await
    }

    async fn get_process_instance_by_key(&self, key: i64) -> Result<ProcessInstance> {
        ProcessInstanceRepository::new(&self.pool).get_by_key(key).await
    }

    async fn count_active_process_instances(&self) -> Result<i64> {
        ProcessInstanceRepository::new(&self.pool).count_active().await
    }

    async fn insert_element_instance(&self, ei: &ElementInstance) -> Result<()> {
        ElementInstanceRepository::new(&self.pool).insert(ei).await
    }

    async fn update_element_instance_state(&self, key: i64, state: &str) -> Result<()> {
        ElementInstanceRepository::new(&self.pool).update_state(key, state).await
    }

    async fn get_element_instance_by_key(&self, key: i64) -> Result<ElementInstance> {
        ElementInstanceRepository::new(&self.pool).get_by_key(key).await
    }

    async fn get_element_instances_by_process_instance(&self, process_instance_key: i64) -> Result<Vec<ElementInstance>> {
        ElementInstanceRepository::new(&self.pool).get_by_process_instance(process_instance_key).await
    }

    async fn get_active_element_instance_count(&self, process_instance_key: i64) -> Result<i64> {
        ElementInstanceRepository::new(&self.pool).get_active_count(process_instance_key).await
    }

    async fn complete_process_element(&self, process_instance_key: i64) -> Result<()> {
        ElementInstanceRepository::new(&self.pool).complete_process_element(process_instance_key).await
    }

    async fn upsert_variable(&self, variable: &Variable) -> Result<()> {
        VariableRepository::new(&self.pool).upsert(variable).await
    }

    async fn get_variables_by_scope(&self, scope_key: i64) -> Result<Vec<Variable>> {
        VariableRepository::new(&self.pool).get_by_scope(scope_key).await
    }

    async fn insert_job(&self, job: &Job) -> Result<()> {
        JobRepository::new(&self.pool).insert(job).await
    }

    async fn get_job_by_key(&self, key: i64) -> Result<Job> {
        JobRepository::new(&self.pool).get_by_key(key).await
    }

    async fn complete_job(&self, key: i64, variables: Option<Value>) -> Result<()> {
        JobRepository::new(&self.pool).complete(key, variables).await
    }

    async fn fail_job(&self, key: i64, retries: i32, error_message: Option<&str>, error_code: Option<&str>, retry_back_off_ms: Option<i64>) -> Result<()> {
        JobRepository::new(&self.pool).fail(key, retries, error_message, error_code, retry_back_off_ms).await
    }

    async fn update_job_retries(&self, key: i64, retries: i32) -> Result<()> {
        JobRepository::new(&self.pool).update_retries(key, retries).await
    }

    async fn update_job_deadline(&self, key: i64, deadline: DateTime<Utc>) -> Result<()> {
        JobRepository::new(&self.pool).update_deadline(key, deadline).await
    }

    async fn cancel_jobs_by_process_instance(&self, process_instance_key: i64) -> Result<u64> {
        crate::state::jobs::cancel_jobs_by_process_instance(&self.pool, process_instance_key).await
    }

    async fn cancel_jobs_by_element_instance(&self, element_instance_key: i64) -> Result<u64> {
        crate::state::jobs::cancel_jobs_by_element_instance(&self.pool, element_instance_key).await
    }

    async fn mark_timed_out_jobs(&self) -> Result<u64> {
        JobRepository::new(&self.pool).mark_timed_out().await
    }

    async fn count_active_jobs_by_type(&self) -> Result<Vec<(String, i64)>> {
        JobRepository::new(&self.pool).count_active_by_type().await
    }

    async fn insert_incident(&self, incident: &Incident) -> Result<()> {
        IncidentRepository::new(&self.pool).insert(incident).await
    }

    async fn get_incident_by_key(&self, key: i64) -> Result<Incident> {
        IncidentRepository::new(&self.pool).get_by_key(key).await
    }

    async fn resolve_incident(&self, key: i64) -> Result<()> {
        IncidentRepository::new(&self.pool).resolve(key).await
    }

    async fn count_active_incidents(&self) -> Result<i64> {
        IncidentRepository::new(&self.pool).count_active().await
    }

    async fn insert_timer(&self, timer: &Timer) -> Result<()> {
        TimerRepository::new(&self.pool).insert(timer).await
    }

    async fn get_timer_by_key(&self, key: i64) -> Result<Timer> {
        TimerRepository::new(&self.pool).get_by_key(key).await
    }

    async fn update_timer_state(&self, key: i64, state: &str) -> Result<()> {
        TimerRepository::new(&self.pool).update_state(key, state).await
    }

    async fn get_due_timers(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<Timer>> {
        TimerRepository::new(&self.pool).get_due(now, limit).await
    }

    async fn insert_message(&self, msg: &Message) -> Result<()> {
        MessageRepository::new(&self.pool).insert(msg).await
    }

    async fn get_messages_by_correlation(&self, name: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<Message>> {
        MessageRepository::new(&self.pool).get_by_correlation(name, correlation_key, tenant_id).await
    }

    async fn expire_old_messages(&self) -> Result<u64> {
        MessageRepository::new(&self.pool).expire_old().await
    }

    async fn insert_message_subscription(&self, sub: &MessageSubscription) -> Result<()> {
        MessageSubscriptionRepository::new(&self.pool).insert(sub).await
    }

    async fn get_message_subscriptions_by_correlation(&self, message_name: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<MessageSubscription>> {
        MessageSubscriptionRepository::new(&self.pool).get_by_correlation(message_name, correlation_key, tenant_id).await
    }

    async fn update_message_subscription_state(&self, key: i64, state: &str) -> Result<()> {
        MessageSubscriptionRepository::new(&self.pool).update_state(key, state).await
    }

    async fn insert_signal_subscription(&self, sub: &SignalSubscription) -> Result<()> {
        SignalSubscriptionRepository::new(&self.pool).insert(sub).await
    }

    async fn get_signal_subscriptions_by_name(&self, signal_name: &str, tenant_id: &str) -> Result<Vec<SignalSubscription>> {
        SignalSubscriptionRepository::new(&self.pool).get_by_signal_name(signal_name, tenant_id).await
    }

    async fn delete_signal_subscription(&self, key: i64) -> Result<()> {
        SignalSubscriptionRepository::new(&self.pool).delete(key).await
    }

    async fn increment_and_get_gateway_token(&self, process_instance_key: i64, element_id: &str) -> Result<i32> {
        GatewayTokenRepository::new(&self.pool).increment_and_get(process_instance_key, element_id).await
    }

    async fn delete_gateway_token(&self, process_instance_key: i64, element_id: &str) -> Result<()> {
        GatewayTokenRepository::new(&self.pool).delete(process_instance_key, element_id).await
    }

    async fn insert_deployment(&self, deployment: &Deployment) -> Result<()> {
        DeploymentRepository::new(&self.pool).insert_deployment(deployment).await
    }

    async fn insert_process_definition(&self, pd: &ProcessDefinition) -> Result<()> {
        DeploymentRepository::new(&self.pool).insert_process_definition(pd).await
    }

    async fn get_process_definition_by_key(&self, key: i64) -> Result<ProcessDefinition> {
        DeploymentRepository::new(&self.pool).get_process_definition_by_key(key).await
    }

    async fn get_latest_process_definition(&self, bpmn_process_id: &str, tenant_id: &str) -> Result<ProcessDefinition> {
        DeploymentRepository::new(&self.pool).get_latest_process_definition(bpmn_process_id, tenant_id).await
    }

    async fn get_process_definition_by_id_and_version(&self, bpmn_process_id: &str, version: i32, tenant_id: &str) -> Result<ProcessDefinition> {
        DeploymentRepository::new(&self.pool).get_by_id_and_version(bpmn_process_id, version, tenant_id).await
    }

    async fn insert_user_task(&self, task: &UserTask) -> Result<()> {
        UserTaskRepository::new(&self.pool).insert(task).await
    }

    async fn get_user_task_by_key(&self, key: i64) -> Result<UserTask> {
        UserTaskRepository::new(&self.pool).get_by_key(key).await
    }

    async fn complete_user_task(&self, key: i64, variables: Option<Value>) -> Result<()> {
        UserTaskRepository::new(&self.pool).complete(key, variables).await
    }

    async fn assign_user_task(&self, key: i64, assignee: Option<&str>) -> Result<()> {
        UserTaskRepository::new(&self.pool).assign(key, assignee).await
    }

    async fn insert_tenant(&self, tenant: &Tenant) -> Result<()> {
        TenantRepository::new(&self.pool).insert(tenant).await
    }

    async fn insert_user(&self, user: &User) -> Result<()> {
        UserRepository::new(&self.pool).insert(user).await
    }

    async fn delete_user(&self, username: &str) -> Result<()> {
        UserRepository::new(&self.pool).delete(username).await
    }

    async fn insert_decision_xml(&self, decision_id: &str, dmn_xml: &str) -> Result<()> {
        use sqlx::Row;
        let existing: Option<i64> = sqlx::query(
            "SELECT key FROM decision_definitions WHERE decision_id = $1 ORDER BY version DESC LIMIT 1",
        )
        .bind(decision_id)
        .fetch_optional(&*self.pool)
        .await?
        .map(|r| r.get("key"));

        if existing.is_none() {
            sqlx::query(
                "INSERT INTO decision_definitions (decision_id, dmn_xml, version) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING",
            )
            .bind(decision_id)
            .bind(dmn_xml)
            .execute(&*self.pool)
            .await?;
        }
        Ok(())
    }

    async fn get_dmn_xml_by_decision_id(&self, decision_id: &str) -> Result<Option<String>> {
        use sqlx::Row;
        let row = sqlx::query(
            "SELECT dmn_xml FROM decision_definitions WHERE decision_id = $1 ORDER BY version DESC LIMIT 1",
        )
        .bind(decision_id)
        .fetch_optional(&*self.pool)
        .await?;
        Ok(row.map(|r| r.get("dmn_xml")))
    }
}
