use std::sync::Arc;
use std::time::Duration;
use dashmap::DashMap;
use reebe_db::records::DbRecord;
use reebe_db::StateBackend;
use crate::clock::Clock;
use crate::error::{EngineError, EngineResult};
use crate::process_def_cache::ProcessDefCache;

/// Read-only access to engine state during processing.
/// Available on all targets including WASM.
pub struct EngineState {
    pub backend: Arc<dyn StateBackend>,
    pub partition_id: i16,
    pub process_def_cache: ProcessDefCache,
    pub clock: Arc<dyn Clock>,
}

// ─── Server-only: command channel, engine loop, scheduler glue ────────────────

#[cfg(not(target_arch = "wasm32"))]
use tokio::sync::{mpsc, oneshot, Semaphore};

#[cfg(not(target_arch = "wasm32"))]
use crate::job_notifier::JobNotifier;

#[cfg(not(target_arch = "wasm32"))]
use crate::processor::{
    RecordProcessor, Writers,
    DeploymentProcessor, ProcessInstanceCreationProcessor, ProcessInstanceCancelProcessor,
    BpmnElementProcessor, JobProcessor, MessageProcessor, TimerProcessor, IncidentProcessor,
    UserTaskProcessor, SignalProcessor, IdentityProcessor, VariableDocumentProcessor,
        AdHocSubProcessInstructionProcessor, ProcessInstanceModificationProcessor, DecisionEvaluationProcessor,
};

#[cfg(not(target_arch = "wasm32"))]
pub struct PendingCommand {
    pub value_type: String,
    pub intent: String,
    pub key: i64,
    pub payload: serde_json::Value,
    pub tenant_id: String,
    pub response_tx: oneshot::Sender<EngineResult<serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub partition_count: u32,
    pub node_id: u32,
    pub max_batch_size: usize,
    pub timer_check_interval_ms: u64,
    pub job_timeout_check_interval_ms: u64,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            partition_count: 1,
            node_id: 0,
            max_batch_size: 100,
            timer_check_interval_ms: 100,
            job_timeout_check_interval_ms: 1000,
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub struct Engine {
    processors: Vec<Arc<dyn RecordProcessor>>,
    pub state: Arc<EngineState>,
    pub job_notifier: Arc<JobNotifier>,
    response_channels: Arc<DashMap<i64, oneshot::Sender<EngineResult<serde_json::Value>>>>,
    command_rx: tokio::sync::Mutex<mpsc::Receiver<PendingCommand>>,
    pub in_flight: Arc<Semaphore>,
    owned_partitions: std::sync::Arc<tokio::sync::RwLock<Vec<i16>>>,
}

#[cfg(not(target_arch = "wasm32"))]
#[derive(Clone)]
pub struct EngineHandle {
    pub command_tx: mpsc::Sender<PendingCommand>,
    pub job_notifier: Arc<JobNotifier>,
    pub in_flight: Arc<Semaphore>,
    pub owned_partitions: std::sync::Arc<tokio::sync::RwLock<Vec<i16>>>,
}

#[cfg(not(target_arch = "wasm32"))]
impl EngineHandle {
    pub async fn send_command(
        &self,
        value_type: String,
        intent: String,
        payload: serde_json::Value,
        tenant_id: String,
    ) -> EngineResult<serde_json::Value> {
        let _permit = tokio::time::timeout(
            Duration::from_secs(30),
            self.in_flight.acquire(),
        )
        .await
        .map_err(|_| EngineError::Internal("Engine is overloaded — backpressure limit reached".to_string()))?
        .map_err(|_| EngineError::Internal("Backpressure semaphore closed".to_string()))?;

        let (tx, rx) = oneshot::channel();
        let cmd = PendingCommand {
            value_type,
            intent,
            key: 0,
            payload,
            tenant_id,
            response_tx: tx,
        };
        self.command_tx
            .send(cmd)
            .await
            .map_err(|_| EngineError::Internal("Engine channel closed".to_string()))?;
        let result = rx.await
            .map_err(|_| EngineError::Internal("Response channel closed".to_string()))?;
        result
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl Engine {
    pub fn new(backend: Arc<dyn StateBackend>, partition_id: i16, clock: Arc<dyn Clock>) -> (Self, EngineHandle) {
        let job_notifier = Arc::new(JobNotifier::new());
        let (command_tx, command_rx) = mpsc::channel(1024);
        let in_flight = Arc::new(Semaphore::new(1024));

        let owned_partitions: std::sync::Arc<tokio::sync::RwLock<Vec<i16>>> =
            std::sync::Arc::new(tokio::sync::RwLock::new(Vec::new()));

        let engine_handle = EngineHandle {
            command_tx,
            job_notifier: job_notifier.clone(),
            in_flight: in_flight.clone(),
            owned_partitions: owned_partitions.clone(),
        };

        let state = Arc::new(EngineState {
            backend,
            partition_id,
            process_def_cache: crate::process_def_cache::ProcessDefCache::new(),
            clock,
        });
        let response_channels = Arc::new(DashMap::new());

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
            Arc::new(ProcessInstanceModificationProcessor),
            Arc::new(DecisionEvaluationProcessor),
        ];

        let engine = Self {
            processors,
            state,
            job_notifier,
            response_channels,
            command_rx: tokio::sync::Mutex::new(command_rx),
            in_flight,
            owned_partitions,
        };

        (engine, engine_handle)
    }

    pub async fn run(self: Arc<Self>) {
        // Acquire advisory lock for this partition on startup.
        if self.state.backend.try_acquire_partition_lock(self.state.partition_id).await {
            tracing::info!(
                "Acquired advisory lock for partition {}",
                self.state.partition_id
            );
            self.owned_partitions.write().await.push(self.state.partition_id);
        } else {
            tracing::warn!(
                "Could not acquire advisory lock for partition {} — another node may own it",
                self.state.partition_id
            );
        }

        // Heartbeat task: re-attempt lock if lost.
        let state_hb = self.state.clone();
        let owned_hb = self.owned_partitions.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;
                let pid = state_hb.partition_id;
                let already_owned = owned_hb.read().await.contains(&pid);
                if !already_owned {
                    if state_hb.backend.try_acquire_partition_lock(pid).await {
                        tracing::info!("Re-acquired advisory lock for partition {}", pid);
                        owned_hb.write().await.push(pid);
                    }
                }
                tracing::debug!(
                    "Partition heartbeat: owned = {:?}",
                    *owned_hb.read().await
                );
            }
        });

        let engine_clone = self.clone();

        // Command receiver task.
        tokio::spawn(async move {
            let mut rx = engine_clone.command_rx.lock().await;
            while let Some(cmd) = rx.recv().await {
                engine_clone.write_command_to_db(cmd).await;
            }
        });

        // Stream processor loop. It resumes after the last command processed before a
        // restart; replaying from the start would re-create jobs, timers and instances.
        let mut last_position = self.processed_position().await;
        let mut consecutive_errors: u32 = 0;

        loop {
            match self.state.backend.fetch_commands_from(self.state.partition_id, last_position + 1, 100).await {
                Ok(records) if !records.is_empty() => {
                    consecutive_errors = 0;
                    for record in &records {
                        last_position = record.position;
                        self.process_one(record).await;
                        if let Err(e) = self.state.backend
                            .set_processed_position(self.state.partition_id, record.position)
                            .await
                        {
                            tracing::error!(
                                "Could not store processed position {} of partition {}: {}",
                                record.position,
                                self.state.partition_id,
                                e
                            );
                        }
                    }
                    continue;
                }
                Ok(_) => {
                    tokio::time::sleep(Duration::from_millis(5)).await;
                }
                Err(e) => {
                    consecutive_errors += 1;
                    let backoff_ms =
                        std::cmp::min(100 * 2_u64.pow(consecutive_errors.min(6)), 30_000);
                    tracing::error!(
                        consecutive_errors,
                        backoff_ms,
                        "Engine processing loop error: {}",
                        e
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                }
            }
        }
    }

    /// The position of the last command processed on this partition, retried until the
    /// database answers: starting from 0 instead would replay the whole log.
    async fn processed_position(&self) -> i64 {
        let mut attempt: u32 = 0;
        loop {
            match self.state.backend.get_processed_position(self.state.partition_id).await {
                Ok(position) => {
                    tracing::info!(
                        "Partition {} resumes after position {}",
                        self.state.partition_id,
                        position
                    );
                    return position;
                }
                Err(e) => {
                    attempt += 1;
                    let backoff_ms = std::cmp::min(100 * 2_u64.pow(attempt.min(6)), 30_000);
                    tracing::error!(backoff_ms, "Could not read the processed position: {}", e);
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                }
            }
        }
    }

    /// Append an API command to the log. Its response channel is registered before the
    /// command becomes visible, so the processor cannot answer it before anyone listens.
    async fn write_command_to_db(&self, cmd: PendingCommand) {
        let record = DbRecord {
            partition_id: self.state.partition_id,
            position: 0,
            record_type: "COMMAND".to_string(),
            value_type: cmd.value_type,
            intent: cmd.intent,
            record_key: cmd.key,
            timestamp_ms: self.state.clock.now().timestamp_millis(),
            payload: cmd.payload,
            source_position: None,
            tenant_id: cmd.tenant_id,
        };
        let channels = self.response_channels.clone();
        let response_tx = cmd.response_tx;
        let reserved = Arc::new(std::sync::atomic::AtomicI64::new(0));
        let reserved_in = reserved.clone();
        let on_position = Box::new(move |position: i64| {
            reserved_in.store(position, std::sync::atomic::Ordering::SeqCst);
            channels.insert(position, response_tx);
        });
        if let Err(e) = self.state.backend.append_command(record, on_position).await {
            // If the channel was never registered, dropping it tells the caller.
            let position = reserved.load(std::sync::atomic::Ordering::SeqCst);
            if let Some((_, tx)) = self.response_channels.remove(&position) {
                let _ = tx.send(Err(e.into()));
            }
        }
    }

    pub async fn process_one(&self, record: &DbRecord) {
        for processor in &self.processors {
            if processor.accepts(&record.value_type, &record.intent) {
                let mut writers = Writers::new();
                match processor.process(record, &self.state, &mut writers).await {
                    Ok(()) => {
                        metrics::counter!("reebe_partition_records_total", "type" => "command").increment(1);
                        self.commit_results(record, writers).await;
                    }
                    Err(e) => {
                        tracing::error!(
                            "Processing error for record at position {}: {}",
                            record.position,
                            e
                        );
                        if let Some((_, tx)) = self.response_channels.remove(&record.position) {
                            let _ = tx.send(Err(e));
                        }
                    }
                }
                return;
            }
        }

        tracing::debug!(
            "No processor for {}.{} at position {}",
            record.value_type,
            record.intent,
            record.position
        );
        if let Some((_, tx)) = self.response_channels.remove(&record.position) {
            let _ = tx.send(Ok(serde_json::Value::Null));
        }
    }

    async fn commit_results(&self, record: &DbRecord, writers: Writers) {
        let total = writers.events.len() + writers.commands.len();
        if total == 0 {
            if let Some((_, tx)) = self.response_channels.remove(&record.position) {
                let response = writers
                    .response
                    .unwrap_or_else(|| serde_json::Value::Object(Default::default()));
                let _ = tx.send(Ok(response));
            }
            return;
        }

        let now_ms = self.state.clock.now().timestamp_millis();

        let first_pos = match self.state.backend.next_position_batch(self.state.partition_id, total).await {
            Ok(p) => p,
            Err(e) => {
                tracing::error!("Error reserving position batch: {}", e);
                if let Some((_, tx)) = self.response_channels.remove(&record.position) {
                    let _ = tx.send(Err(crate::error::EngineError::Internal(e.to_string())));
                }
                return;
            }
        };

        let mut db_records: Vec<DbRecord> = Vec::with_capacity(total);
        for (i, event) in writers.events.iter().enumerate() {
            db_records.push(DbRecord {
                partition_id: self.state.partition_id,
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
                partition_id: self.state.partition_id,
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

        if let Err(e) = self.state.backend.insert_records_batch(&db_records).await {
            tracing::error!("Error writing batch records: {}", e);
        }

        for event in &writers.events {
            metrics::counter!("reebe_partition_records_total", "type" => "event").increment(1);
            match (event.value_type.as_str(), event.intent.as_str()) {
                ("PROCESS_INSTANCE", "ELEMENT_COMPLETED") => {
                    metrics::counter!(
                        "reebe_process_instances_total",
                        "state" => "completed"
                    ).increment(1);
                }
                ("JOB", "CREATED") => {
                    metrics::counter!("reebe_jobs_created_total").increment(1);
                }
                ("JOB", "ACTIVATED") => {
                    metrics::counter!("reebe_jobs_activated_total").increment(1);
                }
                ("JOB", "COMPLETED") => {
                    metrics::counter!("reebe_jobs_completed_total").increment(1);
                }
                ("INCIDENT", "CREATED") => {
                    metrics::counter!("reebe_incidents_created_total").increment(1);
                }
                _ => {}
            }
        }

        if let Some((_, tx)) = self.response_channels.remove(&record.position) {
            let response = writers
                .response
                .unwrap_or_else(|| serde_json::Value::Object(Default::default()));
            let _ = tx.send(Ok(response));
        }
    }
}
