use std::collections::BTreeMap;
use std::sync::Mutex;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;
use crate::Result;
use crate::error::DbError;
use crate::records::DbRecord;
use crate::state::process_instances::ProcessInstance;
use crate::state::element_instances::ElementInstance;
use crate::state::variables::Variable;
use crate::state::jobs::Job;
use crate::state::incidents::Incident;
use crate::state::timers::Timer;
use crate::state::messages::{Message, MessageStartCorrelation, MessageStartEventSubscription, MessageSubscription};
use crate::state::signal_subscriptions::SignalSubscription;
use crate::state::gateway_tokens::JoinToken;
use crate::state::compensation::CompensationSubscription;
use crate::state::deployments::{Deployment, ProcessDefinition};
use crate::state::user_tasks::UserTask;
use crate::state::identity::{Tenant, User};
use crate::backend::StateBackend;

struct PartitionCounters {
    next_key: i64,
    next_position: i64,
}

impl Default for PartitionCounters {
    fn default() -> Self {
        Self { next_key: 1, next_position: 1 }
    }
}

pub struct InMemoryStore {
    counters: std::collections::HashMap<i16, PartitionCounters>,
    records: Vec<DbRecord>,
    process_instances: BTreeMap<i64, ProcessInstance>,
    element_instances: BTreeMap<i64, ElementInstance>,
    variables: BTreeMap<(i64, String), Variable>,  // (scope_key, name)
    jobs: BTreeMap<i64, Job>,
    incidents: BTreeMap<i64, Incident>,
    timers: BTreeMap<i64, Timer>,
    messages: BTreeMap<i64, Message>,
    message_subscriptions: BTreeMap<i64, MessageSubscription>,
    signal_subscriptions: BTreeMap<i64, SignalSubscription>,
    join_tokens: Vec<JoinToken>,
    compensation_subscriptions: BTreeMap<i64, CompensationSubscription>,
    deployments: BTreeMap<i64, Deployment>,
    process_definitions: BTreeMap<i64, ProcessDefinition>,
    decision_xml_by_id: std::collections::HashMap<String, String>,
    user_tasks: BTreeMap<i64, UserTask>,
    tenants: BTreeMap<i64, Tenant>,
    users: BTreeMap<String, User>,
    processed_positions: std::collections::HashMap<i16, i64>,
    message_start_subscriptions: Vec<MessageStartEventSubscription>,
    message_start_correlations: Vec<MessageStartCorrelation>,
}

impl InMemoryStore {
    fn new() -> Self {
        Self {
            counters: std::collections::HashMap::new(),
            records: Vec::new(),
            process_instances: BTreeMap::new(),
            element_instances: BTreeMap::new(),
            variables: BTreeMap::new(),
            jobs: BTreeMap::new(),
            incidents: BTreeMap::new(),
            timers: BTreeMap::new(),
            messages: BTreeMap::new(),
            message_subscriptions: BTreeMap::new(),
            signal_subscriptions: BTreeMap::new(),
            join_tokens: Vec::new(),
            compensation_subscriptions: BTreeMap::new(),
            deployments: BTreeMap::new(),
            process_definitions: BTreeMap::new(),
            decision_xml_by_id: std::collections::HashMap::new(),
            user_tasks: BTreeMap::new(),
            tenants: BTreeMap::new(),
            users: BTreeMap::new(),
            processed_positions: std::collections::HashMap::new(),
            message_start_subscriptions: Vec::new(),
            message_start_correlations: Vec::new(),
        }
    }

    fn counters_for(&mut self, partition_id: i16) -> &mut PartitionCounters {
        self.counters.entry(partition_id).or_default()
    }

    fn next_raw_key(&mut self, partition_id: i16) -> i64 {
        let c = self.counters_for(partition_id);
        let k = c.next_key;
        c.next_key += 1;
        k
    }

    fn next_pos(&mut self, partition_id: i16) -> i64 {
        let c = self.counters_for(partition_id);
        let p = c.next_position;
        c.next_position += 1;
        p
    }

    fn next_pos_batch(&mut self, partition_id: i16, count: usize) -> i64 {
        let c = self.counters_for(partition_id);
        let first = c.next_position;
        c.next_position += count as i64;
        first
    }

    fn next_pos_and_key(&mut self, partition_id: i16) -> (i64, i64) {
        let c = self.counters_for(partition_id);
        let pos = c.next_position;
        let key = c.next_key;
        c.next_position += 1;
        c.next_key += 1;
        (pos, key)
    }
}

pub struct InMemoryBackend {
    store: Mutex<InMemoryStore>,
}

impl InMemoryBackend {
    pub fn new() -> Self {
        Self { store: Mutex::new(InMemoryStore::new()) }
    }

    /// List all process instances (for snapshot API).
    pub fn list_process_instances(&self) -> Vec<ProcessInstance> {
        self.store.lock().unwrap().process_instances.values().cloned().collect()
    }

    /// List all element instances (for snapshot API).
    pub fn list_element_instances(&self) -> Vec<ElementInstance> {
        self.store.lock().unwrap().element_instances.values().cloned().collect()
    }

    /// List all jobs (for snapshot API).
    pub fn list_jobs(&self) -> Vec<Job> {
        self.store.lock().unwrap().jobs.values().cloned().collect()
    }

    /// List all variables (for snapshot API).
    pub fn list_variables(&self) -> Vec<Variable> {
        self.store.lock().unwrap().variables.values().cloned().collect()
    }

    /// List all incidents (for snapshot API).
    pub fn list_incidents(&self) -> Vec<Incident> {
        self.store.lock().unwrap().incidents.values().cloned().collect()
    }

    /// List all records (event log, for snapshot API).
    pub fn list_records(&self) -> Vec<DbRecord> {
        self.store.lock().unwrap().records.clone()
    }

    /// List all timers (for snapshot API).
    pub fn list_timers(&self) -> Vec<Timer> {
        self.store.lock().unwrap().timers.values().cloned().collect()
    }

    /// List all process definitions (for snapshot API).
    pub fn list_process_definitions(&self) -> Vec<ProcessDefinition> {
        self.store.lock().unwrap().process_definitions.values().cloned().collect()
    }

    /// List all message subscriptions (for snapshot API).
    pub fn list_message_subscriptions(&self) -> Vec<MessageSubscription> {
        self.store.lock().unwrap().message_subscriptions.values().cloned().collect()
    }

    /// List all user tasks (for snapshot API).
    pub fn list_user_tasks(&self) -> Vec<UserTask> {
        self.store.lock().unwrap().user_tasks.values().cloned().collect()
    }

    /// List all signal subscriptions.
    pub fn list_signal_subscriptions(&self) -> Vec<SignalSubscription> {
        self.store.lock().unwrap().signal_subscriptions.values().cloned().collect()
    }
}

impl Default for InMemoryBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl StateBackend for InMemoryBackend {
    async fn next_key(&self, partition_id: i16) -> Result<i64> {
        Ok(self.store.lock().unwrap().next_raw_key(partition_id))
    }

    async fn next_position(&self, partition_id: i16) -> Result<i64> {
        Ok(self.store.lock().unwrap().next_pos(partition_id))
    }

    async fn next_position_batch(&self, partition_id: i16, count: usize) -> Result<i64> {
        Ok(self.store.lock().unwrap().next_pos_batch(partition_id, count))
    }

    async fn next_position_and_key(&self, partition_id: i16) -> Result<(i64, i64)> {
        Ok(self.store.lock().unwrap().next_pos_and_key(partition_id))
    }

    async fn try_acquire_partition_lock(&self, _partition_id: i16) -> bool {
        true
    }

    async fn insert_record(&self, record: &DbRecord) -> Result<i64> {
        let pos = record.position;
        self.store.lock().unwrap().records.push(record.clone());
        Ok(pos)
    }

    async fn append_command(&self, mut record: DbRecord, on_position: Box<dyn FnOnce(i64) + Send>) -> Result<i64> {
        let mut store = self.store.lock().unwrap();
        if record.record_key == 0 {
            let (position, key) = store.next_pos_and_key(record.partition_id);
            record.position = position;
            record.record_key = key;
        } else {
            record.position = store.next_pos(record.partition_id);
        }
        on_position(record.position);
        let position = record.position;
        store.records.push(record);
        Ok(position)
    }

    async fn insert_records_batch(&self, records: &[DbRecord]) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        for r in records {
            store.records.push(r.clone());
        }
        Ok(())
    }

    async fn fetch_commands_from(&self, partition_id: i16, from_position: i64, limit: i32) -> Result<Vec<DbRecord>> {
        let store = self.store.lock().unwrap();
        let results: Vec<DbRecord> = store.records.iter()
            .filter(|r| r.partition_id == partition_id && r.position >= from_position && r.record_type == "COMMAND")
            .take(limit as usize)
            .cloned()
            .collect();
        Ok(results)
    }

    async fn has_pending_activation(&self, partition_id: i16, after_position: i64, field: &str, value: &str) -> Result<bool> {
        let store = self.store.lock().unwrap();
        Ok(store.records.iter().any(|r| {
            r.partition_id == partition_id
                && r.position > after_position
                && r.record_type == "COMMAND"
                && r.value_type == "PROCESS_INSTANCE"
                && r.intent == "ACTIVATE_ELEMENT"
                && r.payload[field].as_str() == Some(value)
        }))
    }

    async fn get_pending_activations(&self, partition_id: i16, after_position: i64, flow_scope_key: &str) -> Result<Vec<Value>> {
        let store = self.store.lock().unwrap();
        Ok(store.records.iter()
            .filter(|r| {
                r.partition_id == partition_id
                    && r.position > after_position
                    && r.record_type == "COMMAND"
                    && r.value_type == "PROCESS_INSTANCE"
                    && r.intent == "ACTIVATE_ELEMENT"
                    && r.payload["flowScopeKey"].as_str() == Some(flow_scope_key)
            })
            .map(|r| r.payload.clone())
            .collect())
    }

    async fn get_processed_position(&self, partition_id: i16) -> Result<i64> {
        Ok(self.store.lock().unwrap().processed_positions.get(&partition_id).copied().unwrap_or(0))
    }

    async fn set_processed_position(&self, partition_id: i16, position: i64) -> Result<()> {
        self.store.lock().unwrap().processed_positions.insert(partition_id, position);
        Ok(())
    }

    async fn insert_process_instance(&self, pi: &ProcessInstance) -> Result<()> {
        self.store.lock().unwrap().process_instances.insert(pi.key, pi.clone());
        Ok(())
    }

    async fn update_process_instance_state(&self, key: i64, state: &str, end_date: Option<DateTime<Utc>>) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(pi) = store.process_instances.get_mut(&key) {
            pi.state = state.to_string();
            pi.end_date = end_date;
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Process instance {key}")))
        }
    }

    async fn get_process_instance_by_key(&self, key: i64) -> Result<ProcessInstance> {
        self.store.lock().unwrap().process_instances.get(&key)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Process instance {key}")))
    }

    async fn count_active_process_instances(&self) -> Result<i64> {
        let store = self.store.lock().unwrap();
        let count = store.process_instances.values()
            .filter(|pi| !matches!(pi.state.as_str(), "COMPLETED" | "CANCELED" | "TERMINATED"))
            .count() as i64;
        Ok(count)
    }

    async fn insert_element_instance(&self, ei: &ElementInstance) -> Result<()> {
        self.store.lock().unwrap().element_instances.insert(ei.key, ei.clone());
        Ok(())
    }

    async fn update_element_instance_state(&self, key: i64, state: &str) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(ei) = store.element_instances.get_mut(&key) {
            ei.state = state.to_string();
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Element instance {key}")))
        }
    }

    async fn get_element_instance_by_key(&self, key: i64) -> Result<ElementInstance> {
        self.store.lock().unwrap().element_instances.get(&key)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Element instance {key}")))
    }

    async fn get_element_instances_by_process_instance(&self, process_instance_key: i64) -> Result<Vec<ElementInstance>> {
        let store = self.store.lock().unwrap();
        let results: Vec<ElementInstance> = store.element_instances.values()
            .filter(|ei| ei.process_instance_key == process_instance_key)
            .cloned()
            .collect();
        Ok(results)
    }

    async fn get_active_element_instance_count(&self, process_instance_key: i64) -> Result<i64> {
        let store = self.store.lock().unwrap();
        let count = store.element_instances.values()
            .filter(|ei| {
                ei.process_instance_key == process_instance_key
                    && !matches!(ei.state.as_str(), "COMPLETED" | "TERMINATED")
                    && ei.element_type != "PROCESS"
            })
            .count() as i64;
        Ok(count)
    }

    async fn complete_process_element(&self, process_instance_key: i64) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        for ei in store.element_instances.values_mut() {
            if ei.process_instance_key == process_instance_key && ei.element_type == "PROCESS" {
                ei.state = "COMPLETED".to_string();
            }
        }
        Ok(())
    }

    async fn upsert_variable(&self, variable: &Variable) -> Result<()> {
        self.store.lock().unwrap().variables.insert((variable.scope_key, variable.name.clone()), variable.clone());
        Ok(())
    }

    async fn get_variables_by_scope(&self, scope_key: i64) -> Result<Vec<Variable>> {
        let store = self.store.lock().unwrap();
        let results: Vec<Variable> = store.variables.values()
            .filter(|v| v.scope_key == scope_key)
            .cloned()
            .collect();
        Ok(results)
    }

    async fn insert_job(&self, job: &Job) -> Result<()> {
        self.store.lock().unwrap().jobs.insert(job.key, job.clone());
        Ok(())
    }

    async fn get_job_by_key(&self, key: i64) -> Result<Job> {
        self.store.lock().unwrap().jobs.get(&key)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Job {key}")))
    }

    async fn complete_job(&self, key: i64, variables: Option<Value>) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(job) = store.jobs.get_mut(&key) {
            job.state = "COMPLETED".to_string();
            if let Some(vars) = variables {
                job.variables = vars;
            }
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Job {key}")))
        }
    }

    async fn fail_job(&self, key: i64, retries: i32, error_message: Option<&str>, error_code: Option<&str>, retry_back_off_ms: Option<i64>) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(job) = store.jobs.get_mut(&key) {
            job.retries = retries;
            job.state = if retries <= 0 { "FAILED".to_string() } else { "ACTIVATABLE".to_string() };
            job.error_message = error_message.map(|s| s.to_string());
            job.error_code = error_code.map(|s| s.to_string());
            job.worker = None;
            job.deadline = None;
            job.retry_back_off_at = retry_back_off_ms
                .filter(|&ms| ms > 0)
                .map(|ms| Utc::now() + chrono::Duration::milliseconds(ms));
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Job {key}")))
        }
    }

    async fn update_job_retries(&self, key: i64, retries: i32) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(job) = store.jobs.get_mut(&key) {
            job.retries = retries;
            if job.state == "FAILED" && retries > 0 {
                job.state = "ACTIVATABLE".to_string();
            }
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Job {key}")))
        }
    }

    async fn update_job_deadline(&self, key: i64, deadline: DateTime<Utc>) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(job) = store.jobs.get_mut(&key) {
            job.deadline = Some(deadline);
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Job {key}")))
        }
    }

    async fn cancel_jobs_by_process_instance(&self, process_instance_key: i64) -> Result<u64> {
        let mut store = self.store.lock().unwrap();
        let mut count = 0u64;
        for job in store.jobs.values_mut() {
            if job.process_instance_key == process_instance_key
                && matches!(job.state.as_str(), "ACTIVATABLE" | "ACTIVATED")
            {
                job.state = "CANCELED".to_string();
                job.worker = None;
                job.deadline = None;
                count += 1;
            }
        }
        Ok(count)
    }

    async fn cancel_jobs_by_element_instance(&self, element_instance_key: i64) -> Result<u64> {
        let mut store = self.store.lock().unwrap();
        let mut count = 0u64;
        for job in store.jobs.values_mut() {
            if job.element_instance_key == element_instance_key
                && matches!(job.state.as_str(), "ACTIVATABLE" | "ACTIVATED")
            {
                job.state = "CANCELED".to_string();
                job.worker = None;
                job.deadline = None;
                count += 1;
            }
        }
        Ok(count)
    }

    async fn cancel_element_instance_waits(&self, element_instance_key: i64) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        for timer in store.timers.values_mut() {
            if timer.element_instance_key == Some(element_instance_key) && timer.state == "ACTIVE" {
                timer.state = "CANCELED".to_string();
            }
        }
        for task in store.user_tasks.values_mut() {
            if task.element_instance_key == element_instance_key && task.state == "CREATED" {
                task.state = "CANCELED".to_string();
            }
        }
        for sub in store.message_subscriptions.values_mut() {
            if sub.element_instance_key == element_instance_key
                && matches!(sub.state.as_str(), "OPENING" | "OPENED")
            {
                sub.state = "CLOSED".to_string();
            }
        }
        store.signal_subscriptions.retain(|_, s| s.element_instance_key != element_instance_key);
        Ok(())
    }

    async fn cancel_catch_waits(&self, element_instance_key: i64, element_ids: &[String], message_names: &[String]) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        for timer in store.timers.values_mut() {
            if timer.element_instance_key == Some(element_instance_key)
                && timer.state == "ACTIVE"
                && element_ids.contains(&timer.element_id)
            {
                timer.state = "CANCELED".to_string();
            }
        }
        for sub in store.message_subscriptions.values_mut() {
            if sub.element_instance_key == element_instance_key
                && matches!(sub.state.as_str(), "OPENING" | "OPENED")
                && message_names.contains(&sub.message_name)
            {
                sub.state = "CLOSED".to_string();
            }
        }
        store.signal_subscriptions.retain(|_, s| {
            s.element_instance_key != element_instance_key || !element_ids.contains(&s.element_id)
        });
        Ok(())
    }

    async fn get_child_process_instance_keys(&self, parent_element_instance_key: i64) -> Result<Vec<i64>> {
        let store = self.store.lock().unwrap();
        Ok(store.process_instances.values()
            .filter(|p| p.parent_element_instance_key == Some(parent_element_instance_key) && p.state == "ACTIVE")
            .map(|p| p.key)
            .collect())
    }

    async fn mark_timed_out_jobs(&self) -> Result<u64> {
        let now = Utc::now();
        let mut store = self.store.lock().unwrap();
        let mut count = 0u64;
        for job in store.jobs.values_mut() {
            if job.state == "ACTIVATED" {
                if let Some(deadline) = job.deadline {
                    if deadline < now {
                        job.state = "ACTIVATABLE".to_string();
                        job.worker = None;
                        job.deadline = None;
                        count += 1;
                    }
                }
            }
        }
        Ok(count)
    }

    async fn count_active_jobs_by_type(&self) -> Result<Vec<(String, i64)>> {
        let store = self.store.lock().unwrap();
        let mut counts: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
        for job in store.jobs.values() {
            if !matches!(job.state.as_str(), "COMPLETED" | "FAILED" | "CANCELED" | "ERROR") {
                *counts.entry(job.job_type.clone()).or_default() += 1;
            }
        }
        Ok(counts.into_iter().collect())
    }

    async fn insert_incident(&self, incident: &Incident) -> Result<()> {
        self.store.lock().unwrap().incidents.insert(incident.key, incident.clone());
        Ok(())
    }

    async fn get_incident_by_key(&self, key: i64) -> Result<Incident> {
        self.store.lock().unwrap().incidents.get(&key)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Incident {key}")))
    }

    async fn resolve_incident(&self, key: i64) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(incident) = store.incidents.get_mut(&key) {
            incident.state = "RESOLVED".to_string();
            incident.resolved_at = Some(Utc::now());
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Incident {key}")))
        }
    }

    async fn count_active_incidents(&self) -> Result<i64> {
        let store = self.store.lock().unwrap();
        let count = store.incidents.values().filter(|i| i.state == "ACTIVE").count() as i64;
        Ok(count)
    }

    async fn insert_timer(&self, timer: &Timer) -> Result<()> {
        self.store.lock().unwrap().timers.insert(timer.key, timer.clone());
        Ok(())
    }

    async fn get_timer_by_key(&self, key: i64) -> Result<Timer> {
        self.store.lock().unwrap().timers.get(&key)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Timer {key}")))
    }

    async fn update_timer_state(&self, key: i64, state: &str) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(timer) = store.timers.get_mut(&key) {
            timer.state = state.to_string();
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Timer {key}")))
        }
    }

    async fn get_due_timers(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<Timer>> {
        let store = self.store.lock().unwrap();
        let mut results: Vec<Timer> = store.timers.values()
            .filter(|t| t.state == "ACTIVE" && t.due_date <= now)
            .cloned()
            .collect();
        results.sort_by_key(|t| t.due_date);
        results.truncate(limit as usize);
        Ok(results)
    }

    async fn cancel_start_timers(&self, process_definition_key: i64) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        for timer in store.timers.values_mut() {
            if timer.process_definition_key == Some(process_definition_key)
                && timer.element_instance_key.is_none()
                && timer.state == "ACTIVE"
            {
                timer.state = "CANCELED".to_string();
            }
        }
        Ok(())
    }

    async fn insert_message(&self, msg: &Message) -> Result<()> {
        self.store.lock().unwrap().messages.insert(msg.key, msg.clone());
        Ok(())
    }

    async fn get_messages_by_correlation(&self, name: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<Message>> {
        let now = Utc::now();
        let store = self.store.lock().unwrap();
        let results: Vec<Message> = store.messages.values()
            .filter(|m| {
                m.name == name
                    && m.correlation_key == correlation_key
                    && m.tenant_id == tenant_id
                    && m.state == "PUBLISHED"
                    && m.expires_at > now
            })
            .cloned()
            .collect();
        Ok(results)
    }

    async fn expire_old_messages(&self) -> Result<u64> {
        let now = Utc::now();
        let mut store = self.store.lock().unwrap();
        let mut count = 0u64;
        for msg in store.messages.values_mut() {
            if msg.state == "PUBLISHED" && msg.expires_at <= now {
                msg.state = "EXPIRED".to_string();
                count += 1;
            }
        }
        Ok(count)
    }

    async fn insert_message_subscription(&self, sub: &MessageSubscription) -> Result<()> {
        self.store.lock().unwrap().message_subscriptions.insert(sub.key, sub.clone());
        Ok(())
    }

    async fn get_message_subscriptions_by_correlation(&self, message_name: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<MessageSubscription>> {
        let store = self.store.lock().unwrap();
        let results: Vec<MessageSubscription> = store.message_subscriptions.values()
            .filter(|s| {
                s.message_name == message_name
                    && s.correlation_key == correlation_key
                    && s.tenant_id == tenant_id
            })
            .cloned()
            .collect();
        Ok(results)
    }

    async fn update_message_subscription_state(&self, key: i64, state: &str) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(sub) = store.message_subscriptions.get_mut(&key) {
            sub.state = state.to_string();
            Ok(())
        } else {
            Err(DbError::NotFound(format!("Message subscription {key}")))
        }
    }

    async fn replace_message_start_subscriptions(&self, bpmn_process_id: &str, tenant_id: &str, subs: &[MessageStartEventSubscription]) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        store.message_start_subscriptions.retain(|s| s.bpmn_process_id != bpmn_process_id || s.tenant_id != tenant_id);
        store.message_start_subscriptions.extend(subs.iter().cloned());
        Ok(())
    }

    async fn get_message_start_subscriptions_by_name(&self, message_name: &str, tenant_id: &str) -> Result<Vec<MessageStartEventSubscription>> {
        let store = self.store.lock().unwrap();
        Ok(store.message_start_subscriptions.iter()
            .filter(|s| s.message_name == message_name && s.tenant_id == tenant_id)
            .cloned()
            .collect())
    }

    async fn get_message_start_subscriptions_by_process(&self, bpmn_process_id: &str, tenant_id: &str) -> Result<Vec<MessageStartEventSubscription>> {
        let store = self.store.lock().unwrap();
        Ok(store.message_start_subscriptions.iter()
            .filter(|s| s.bpmn_process_id == bpmn_process_id && s.tenant_id == tenant_id)
            .cloned()
            .collect())
    }

    async fn insert_message_start_correlation(&self, correlation: &MessageStartCorrelation) -> Result<()> {
        self.store.lock().unwrap().message_start_correlations.push(correlation.clone());
        Ok(())
    }

    async fn get_message_start_correlations(&self, bpmn_process_id: &str, correlation_key: &str, tenant_id: &str) -> Result<Vec<MessageStartCorrelation>> {
        let store = self.store.lock().unwrap();
        Ok(store.message_start_correlations.iter()
            .filter(|c| c.bpmn_process_id == bpmn_process_id && c.correlation_key == correlation_key && c.tenant_id == tenant_id)
            .cloned()
            .collect())
    }

    async fn get_message_start_correlation_by_instance(&self, process_instance_key: i64) -> Result<Option<MessageStartCorrelation>> {
        let store = self.store.lock().unwrap();
        Ok(store.message_start_correlations.iter()
            .find(|c| c.process_instance_key == process_instance_key)
            .cloned())
    }

    async fn insert_signal_subscription(&self, sub: &SignalSubscription) -> Result<()> {
        self.store.lock().unwrap().signal_subscriptions.insert(sub.key, sub.clone());
        Ok(())
    }

    async fn get_signal_subscriptions_by_name(&self, signal_name: &str, tenant_id: &str) -> Result<Vec<SignalSubscription>> {
        let store = self.store.lock().unwrap();
        let results: Vec<SignalSubscription> = store.signal_subscriptions.values()
            .filter(|s| s.signal_name == signal_name && s.tenant_id == tenant_id)
            .cloned()
            .collect();
        Ok(results)
    }

    async fn delete_signal_subscription(&self, key: i64) -> Result<()> {
        self.store.lock().unwrap().signal_subscriptions.remove(&key);
        Ok(())
    }

    async fn add_join_token(&self, process_instance_key: i64, flow_scope_key: i64, gateway_id: &str, sequence_flow_id: &str) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        match store.join_tokens.iter_mut().find(|t| {
            t.flow_scope_key == flow_scope_key && t.gateway_id == gateway_id && t.sequence_flow_id == sequence_flow_id
        }) {
            Some(token) => token.count += 1,
            None => store.join_tokens.push(JoinToken {
                process_instance_key,
                flow_scope_key,
                gateway_id: gateway_id.to_string(),
                sequence_flow_id: sequence_flow_id.to_string(),
                count: 1,
            }),
        }
        Ok(())
    }

    async fn take_join_token(&self, flow_scope_key: i64, gateway_id: &str, sequence_flow_id: &str) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        for token in store.join_tokens.iter_mut().filter(|t| {
            t.flow_scope_key == flow_scope_key && t.gateway_id == gateway_id && t.sequence_flow_id == sequence_flow_id
        }) {
            token.count -= 1;
        }
        store.join_tokens.retain(|t| t.count > 0);
        Ok(())
    }

    async fn get_join_tokens(&self, process_instance_key: i64) -> Result<Vec<JoinToken>> {
        let store = self.store.lock().unwrap();
        Ok(store.join_tokens.iter().filter(|t| t.process_instance_key == process_instance_key).cloned().collect())
    }

    async fn delete_join_tokens(&self, flow_scope_key: i64) -> Result<()> {
        self.store.lock().unwrap().join_tokens.retain(|t| t.flow_scope_key != flow_scope_key);
        Ok(())
    }

    async fn upsert_compensation_subscription(&self, sub: &CompensationSubscription) -> Result<()> {
        self.store.lock().unwrap().compensation_subscriptions.insert(sub.key, sub.clone());
        Ok(())
    }

    async fn get_compensation_subscriptions(&self, process_instance_key: i64) -> Result<Vec<CompensationSubscription>> {
        let store = self.store.lock().unwrap();
        Ok(store
            .compensation_subscriptions
            .values()
            .filter(|s| s.process_instance_key == process_instance_key)
            .cloned()
            .collect())
    }

    async fn delete_compensation_subscription(&self, key: i64) -> Result<()> {
        self.store.lock().unwrap().compensation_subscriptions.remove(&key);
        Ok(())
    }

    async fn insert_deployment(&self, deployment: &Deployment) -> Result<()> {
        self.store.lock().unwrap().deployments.insert(deployment.key, deployment.clone());
        Ok(())
    }

    async fn insert_process_definition(&self, pd: &ProcessDefinition) -> Result<()> {
        self.store.lock().unwrap().process_definitions.insert(pd.key, pd.clone());
        Ok(())
    }

    async fn get_process_definition_by_key(&self, key: i64) -> Result<ProcessDefinition> {
        self.store.lock().unwrap().process_definitions.get(&key)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Process definition {key}")))
    }

    async fn get_latest_process_definition(&self, bpmn_process_id: &str, tenant_id: &str) -> Result<ProcessDefinition> {
        let store = self.store.lock().unwrap();
        store.process_definitions.values()
            .filter(|pd| pd.bpmn_process_id == bpmn_process_id && pd.tenant_id == tenant_id)
            .max_by_key(|pd| pd.version)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("No process definition for {bpmn_process_id}")))
    }

    async fn get_process_definition_by_id_and_version(&self, bpmn_process_id: &str, version: i32, tenant_id: &str) -> Result<ProcessDefinition> {
        let store = self.store.lock().unwrap();
        store.process_definitions.values()
            .find(|pd| pd.bpmn_process_id == bpmn_process_id && pd.version == version && pd.tenant_id == tenant_id)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("Process definition {bpmn_process_id} v{version}")))
    }

    async fn insert_user_task(&self, task: &UserTask) -> Result<()> {
        self.store.lock().unwrap().user_tasks.insert(task.key, task.clone());
        Ok(())
    }

    async fn get_user_task_by_key(&self, key: i64) -> Result<UserTask> {
        self.store.lock().unwrap().user_tasks.get(&key)
            .cloned()
            .ok_or_else(|| DbError::NotFound(format!("UserTask {key}")))
    }

    async fn complete_user_task(&self, key: i64, variables: Option<Value>) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(task) = store.user_tasks.get_mut(&key) {
            task.state = "COMPLETED".to_string();
            task.completed_at = Some(Utc::now());
            if let Some(vars) = variables {
                task.variables = vars;
            }
            Ok(())
        } else {
            Err(DbError::NotFound(format!("UserTask {key}")))
        }
    }

    async fn assign_user_task(&self, key: i64, assignee: Option<&str>) -> Result<()> {
        let mut store = self.store.lock().unwrap();
        if let Some(task) = store.user_tasks.get_mut(&key) {
            task.assignee = assignee.map(|s| s.to_string());
            Ok(())
        } else {
            Err(DbError::NotFound(format!("UserTask {key}")))
        }
    }

    async fn insert_tenant(&self, tenant: &Tenant) -> Result<()> {
        self.store.lock().unwrap().tenants.insert(tenant.key, tenant.clone());
        Ok(())
    }

    async fn insert_user(&self, user: &User) -> Result<()> {
        self.store.lock().unwrap().users.insert(user.username.clone(), user.clone());
        Ok(())
    }

    async fn delete_user(&self, username: &str) -> Result<()> {
        self.store.lock().unwrap().users.remove(username);
        Ok(())
    }

    async fn insert_decision_xml(&self, _key: i64, _deployment_key: i64, _resource_name: &str, decision_id: &str, dmn_xml: &str) -> Result<()> {
        self.store.lock().unwrap().decision_xml_by_id.insert(decision_id.to_string(), dmn_xml.to_string());
        Ok(())
    }

    async fn get_dmn_xml_by_decision_id(&self, decision_id: &str) -> Result<Option<String>> {
        Ok(self.store.lock().unwrap().decision_xml_by_id.get(decision_id).cloned())
    }
}
