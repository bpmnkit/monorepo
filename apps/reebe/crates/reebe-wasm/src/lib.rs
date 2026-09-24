use std::sync::Arc;
use base64::Engine as Base64Engine;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use reebe_db::{InMemoryBackend, StateBackend};
use reebe_db::records::DbRecord;
use reebe_engine::{
    Clock, EngineState, VirtualClock, JobNotifier,
    processor::{
        RecordProcessor, Writers,
        DeploymentProcessor, ProcessInstanceCreationProcessor, ProcessInstanceCancelProcessor,
        BpmnElementProcessor, JobProcessor, MessageProcessor, TimerProcessor, IncidentProcessor,
        UserTaskProcessor, SignalProcessor, IdentityProcessor, VariableDocumentProcessor,
        AdHocSubProcessInstructionProcessor,
    },
};

fn block<F: std::future::Future>(f: F) -> F::Output {
    futures::executor::block_on(f)
}

/// Serialize any `Serialize` type to a JsValue using the JSON-compatible mode
/// so that Rust maps/objects become plain JS objects (not JS Map instances).
/// JSON.stringify on a JS Map gives {}, which is incorrect.
fn to_js(val: &impl Serialize) -> JsValue {
    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    val.serialize(&serializer).unwrap_or(JsValue::NULL)
}

/// Same as `to_js` but propagates serialization errors as a JS Err.
fn to_js_result(val: &impl Serialize) -> Result<JsValue, JsValue> {
    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    val.serialize(&serializer)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct EngineSnapshot {
    #[serde(rename = "processInstances")]
    pub process_instances: Vec<reebe_db::state::process_instances::ProcessInstance>,
    #[serde(rename = "elementInstances")]
    pub element_instances: Vec<reebe_db::state::element_instances::ElementInstance>,
    pub jobs: Vec<reebe_db::state::jobs::Job>,
    pub variables: Vec<reebe_db::state::variables::Variable>,
    pub incidents: Vec<reebe_db::state::incidents::Incident>,
    #[serde(rename = "eventLog")]
    pub event_log: Vec<DbRecord>,
    pub timers: Vec<reebe_db::state::timers::Timer>,
    #[serde(rename = "userTasks")]
    pub user_tasks: Vec<reebe_db::state::user_tasks::UserTask>,
    #[serde(rename = "messageSubscriptions")]
    pub message_subscriptions: Vec<reebe_db::state::messages::MessageSubscription>,
}

#[wasm_bindgen]
pub struct WasmEngine {
    backend: Arc<InMemoryBackend>,
    clock: Arc<VirtualClock>,
    state: Arc<EngineState>,
    processors: Vec<Arc<dyn RecordProcessor>>,
    partition_id: i16,
}

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let backend = Arc::new(InMemoryBackend::new());
        let clock = Arc::new(VirtualClock::new(chrono::Utc::now()));
        let state = Arc::new(EngineState {
            backend: backend.clone() as Arc<dyn StateBackend>,
            partition_id: 0,
            process_def_cache: reebe_engine::process_def_cache::ProcessDefCache::new(),
            clock: clock.clone(),
        });
        let job_notifier = Arc::new(JobNotifier::new());
        let processors: Vec<Arc<dyn RecordProcessor>> = vec![
            Arc::new(DeploymentProcessor),
            Arc::new(ProcessInstanceCreationProcessor),
            Arc::new(ProcessInstanceCancelProcessor),
            Arc::new(BpmnElementProcessor),
            Arc::new(JobProcessor { job_notifier: job_notifier.clone() }),
            Arc::new(MessageProcessor),
            Arc::new(TimerProcessor),
            Arc::new(IncidentProcessor),
            Arc::new(UserTaskProcessor),
            Arc::new(SignalProcessor),
            Arc::new(IdentityProcessor),
            Arc::new(VariableDocumentProcessor),
            Arc::new(AdHocSubProcessInstructionProcessor),
        ];
        Self { backend, clock, state, processors, partition_id: 0 }
    }

    /// Deploy a BPMN XML string. Returns a JSON object with deployment info.
    pub fn deploy(&mut self, bpmn_xml: &str) -> Result<JsValue, JsValue> {
        let encoded = base64::engine::general_purpose::STANDARD.encode(bpmn_xml.as_bytes());
        let result = self.submit_and_drain(
            "DEPLOYMENT", "CREATE",
            serde_json::json!({
                "resources": [{ "name": "process.bpmn", "content": encoded }]
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Create a process instance. `variables` is a JSON string.
    pub fn create_process_instance(&mut self, bpmn_process_id: &str, variables: &str) -> Result<JsValue, JsValue> {
        let vars: serde_json::Value = serde_json::from_str(variables)
            .unwrap_or(serde_json::Value::Object(Default::default()));
        let result = self.submit_and_drain(
            "PROCESS_INSTANCE_CREATION", "CREATE",
            serde_json::json!({
                "bpmnProcessId": bpmn_process_id,
                "version": -1,
                "variables": vars,
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Cancel a process instance by its key.
    pub fn cancel_process_instance(&mut self, process_instance_key: f64) -> Result<JsValue, JsValue> {
        let key = process_instance_key as i64;
        let result = self.submit_and_drain(
            "PROCESS_INSTANCE", "CANCEL",
            serde_json::json!({ "processInstanceKey": key.to_string() }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Activate a job. Returns the job activation info.
    pub fn activate_job(&mut self, key: f64, worker: &str, timeout_ms: f64) -> Result<JsValue, JsValue> {
        let job_key = key as i64;
        let result = self.submit_and_drain(
            "JOB", "ACTIVATE",
            serde_json::json!({
                "jobKey": job_key.to_string(),
                "worker": worker,
                "timeout": timeout_ms as i64,
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Complete a job. `variables` is a JSON string.
    pub fn complete_job(&mut self, key: f64, variables: &str) -> Result<JsValue, JsValue> {
        let job_key = key as i64;
        let vars: serde_json::Value = serde_json::from_str(variables)
            .unwrap_or(serde_json::Value::Object(Default::default()));
        let result = self.submit_and_drain(
            "JOB", "COMPLETE",
            serde_json::json!({
                "jobKey": job_key.to_string(),
                "variables": vars,
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Complete a native (`zeebe:userTask`) user task. `variables` is a JSON string.
    pub fn complete_user_task(&mut self, key: f64, variables: &str) -> Result<JsValue, JsValue> {
        let task_key = key as i64;
        let vars: serde_json::Value = serde_json::from_str(variables)
            .unwrap_or(serde_json::Value::Object(Default::default()));
        let result = self.submit_and_drain(
            "USER_TASK", "COMPLETE",
            serde_json::json!({
                "userTaskKey": task_key.to_string(),
                "variables": vars,
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Fail a job.
    pub fn fail_job(&mut self, key: f64, retries: i32, error_message: &str) -> Result<JsValue, JsValue> {
        let job_key = key as i64;
        let result = self.submit_and_drain(
            "JOB", "FAIL",
            serde_json::json!({
                "jobKey": job_key.to_string(),
                "retries": retries,
                "errorMessage": error_message,
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Throw a BPMN error from a job.
    pub fn throw_error(&mut self, key: f64, error_code: &str, error_message: &str) -> Result<JsValue, JsValue> {
        let job_key = key as i64;
        let result = self.submit_and_drain(
            "JOB", "THROW_ERROR",
            serde_json::json!({
                "jobKey": job_key.to_string(),
                "errorCode": error_code,
                "errorMessage": error_message,
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Publish a message. `variables` is a JSON string.
    pub fn publish_message(&mut self, name: &str, correlation_key: &str, variables: &str) -> Result<JsValue, JsValue> {
        let vars: serde_json::Value = serde_json::from_str(variables)
            .unwrap_or(serde_json::Value::Object(Default::default()));
        let result = self.submit_and_drain(
            "MESSAGE", "PUBLISH",
            serde_json::json!({
                "messageName": name,
                "correlationKey": correlation_key,
                "variables": vars,
                "timeToLive": 3600000,
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Broadcast a signal. `variables` is a JSON string.
    pub fn broadcast_signal(&mut self, signal_name: &str, variables: &str) -> Result<JsValue, JsValue> {
        let vars: serde_json::Value = serde_json::from_str(variables)
            .unwrap_or(serde_json::Value::Object(Default::default()));
        let result = self.submit_and_drain(
            "SIGNAL", "BROADCAST",
            serde_json::json!({
                "signalName": signal_name,
                "variables": vars,
            }),
            "<default>",
        ).map_err(|e| JsValue::from_str(&e))?;
        to_js_result(&result)
    }

    /// Advance the virtual clock by `ms` milliseconds, then process due timers.
    pub fn advance_clock(&mut self, ms: f64) -> Result<JsValue, JsValue> {
        self.clock.advance(chrono::Duration::milliseconds(ms as i64));
        self.tick()
    }

    /// Process all due timers at the current virtual clock time.
    pub fn tick(&mut self) -> Result<JsValue, JsValue> {
        // Sync to real wall-clock time before firing due timers
        let real_now = chrono::Utc::now();
        if real_now > self.clock.now() {
            self.clock.set(real_now);
        }
        let now = self.clock.now();
        let timers = block(self.backend.get_due_timers(now, 100))
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        for timer in timers {
            block(self.backend.update_timer_state(timer.key, "FIRED"))
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            self.submit_and_drain(
                "TIMER", "TRIGGER",
                serde_json::json!({ "timerKey": timer.key.to_string() }),
                &timer.tenant_id,
            ).ok();
        }
        Ok(JsValue::NULL)
    }

    /// Get a snapshot of current engine state as a JS object.
    pub fn snapshot(&self) -> JsValue {
        let snap = EngineSnapshot {
            process_instances: self.backend.list_process_instances(),
            element_instances: self.backend.list_element_instances(),
            jobs: self.backend.list_jobs(),
            variables: self.backend.list_variables(),
            incidents: self.backend.list_incidents(),
            event_log: self.backend.list_records(),
            timers: self.backend.list_timers(),
            user_tasks: self.backend.list_user_tasks(),
            message_subscriptions: self.backend.list_message_subscriptions(),
        };
        to_js(&snap)
    }

    /// Get jobs that are in ACTIVATABLE state for a given job type.
    pub fn get_activatable_jobs(&self, job_type: &str) -> JsValue {
        let jobs: Vec<_> = self.backend.list_jobs()
            .into_iter()
            .filter(|j| j.state == "ACTIVATABLE" && j.job_type == job_type)
            .collect();
        to_js(&jobs)
    }

    /// Get all jobs regardless of state.
    pub fn get_all_jobs(&self) -> JsValue {
        let jobs = self.backend.list_jobs();
        to_js(&jobs)
    }

    /// Get the event log (all partition_records entries).
    pub fn get_event_log(&self) -> JsValue {
        let records = self.backend.list_records();
        to_js(&records)
    }
}

impl WasmEngine {
    /// Submit a command and synchronously drain all follow-up commands until
    /// the engine reaches a waiting state (no more pending commands).
    fn submit_and_drain(
        &self,
        value_type: &str,
        intent: &str,
        payload: serde_json::Value,
        tenant_id: &str,
    ) -> Result<serde_json::Value, String> {
        // Sync virtual clock to real wall-clock time (only advance — preserves advance_clock behavior)
        let real_now = chrono::Utc::now();
        if real_now > self.clock.now() {
            self.clock.set(real_now);
        }

        // Reserve position + key for the initial command
        let (position, key) = block(self.backend.next_position_and_key(self.partition_id))
            .map_err(|e| e.to_string())?;

        let record = DbRecord {
            partition_id: self.partition_id,
            position,
            record_type: "COMMAND".to_string(),
            value_type: value_type.to_string(),
            intent: intent.to_string(),
            record_key: key,
            timestamp_ms: self.clock.now().timestamp_millis(),
            payload,
            source_position: None,
            tenant_id: tenant_id.to_string(),
        };

        block(self.backend.insert_record(&record)).map_err(|e| e.to_string())?;

        // Drain: keep processing commands until none remain
        let mut last_position = position - 1;
        let mut first_response: Option<serde_json::Value> = None;

        loop {
            let records = block(self.backend.fetch_commands_from(self.partition_id, last_position + 1, 100))
                .map_err(|e| e.to_string())?;

            if records.is_empty() {
                break;
            }

            for rec in &records {
                last_position = rec.position;
                let response = self.process_one_sync(rec)?;
                // Capture response from the first (initial) command
                if rec.position == position {
                    first_response = response;
                }
            }
        }

        Ok(first_response.unwrap_or_else(|| serde_json::Value::Object(Default::default())))
    }

    /// Process a single record synchronously using block_on.
    fn process_one_sync(&self, record: &DbRecord) -> Result<Option<serde_json::Value>, String> {
        for processor in &self.processors {
            if processor.accepts(&record.value_type, &record.intent) {
                let mut writers = Writers::new();
                block(processor.process(record, &self.state, &mut writers))
                    .map_err(|e| e.to_string())?;

                let response = writers.response.clone();

                // Commit: write events + follow-up commands with reserved positions
                let total = writers.events.len() + writers.commands.len();
                if total > 0 {
                    let now_ms = self.clock.now().timestamp_millis();
                    let first_pos = block(self.backend.next_position_batch(self.partition_id, total))
                        .map_err(|e| e.to_string())?;

                    let mut db_records = Vec::with_capacity(total);

                    for (i, event) in writers.events.iter().enumerate() {
                        db_records.push(DbRecord {
                            partition_id: self.partition_id,
                            position: first_pos + i as i64,
                            record_type: "EVENT".to_string(),
                            value_type: event.value_type.clone(),
                            intent: event.intent.clone(),
                            record_key: event.key,
                            timestamp_ms: now_ms,
                            payload: event.payload.clone(),
                            source_position: Some(record.position),
                            tenant_id: record.tenant_id.clone(),
                        });
                    }

                    let cmd_offset = writers.events.len();
                    for (i, cmd) in writers.commands.iter().enumerate() {
                        db_records.push(DbRecord {
                            partition_id: self.partition_id,
                            position: first_pos + (cmd_offset + i) as i64,
                            record_type: "COMMAND".to_string(),
                            value_type: cmd.value_type.clone(),
                            intent: cmd.intent.clone(),
                            record_key: cmd.key,
                            timestamp_ms: now_ms,
                            payload: cmd.payload.clone(),
                            source_position: Some(record.position),
                            tenant_id: record.tenant_id.clone(),
                        });
                    }

                    block(self.backend.insert_records_batch(&db_records))
                        .map_err(|e| e.to_string())?;
                }

                return Ok(response);
            }
        }

        // No processor matched — not an error
        Ok(None)
    }
}
