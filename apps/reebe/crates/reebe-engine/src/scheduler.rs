use std::sync::Arc;
use std::time::Duration;
use reebe_db::StateBackend;
use crate::clock::Clock;
use crate::engine::EngineHandle;

pub struct Scheduler {
    backend: Arc<dyn StateBackend>,
    engine_handle: EngineHandle,
    clock: Arc<dyn Clock>,
}

impl Scheduler {
    /// `clock` decides when a timer is due; pass the engine's clock so that both agree.
    pub fn new(backend: Arc<dyn StateBackend>, engine_handle: EngineHandle, clock: Arc<dyn Clock>) -> Self {
        Self { backend, engine_handle, clock }
    }

    /// Run all background scheduler tasks.
    pub async fn run(&self) {
        let b1 = self.backend.clone();
        let b2 = self.backend.clone();
        let b3 = self.backend.clone();
        let b4 = self.backend.clone();
        let h1 = self.engine_handle.clone();
        let h2 = self.engine_handle.clone();

        tokio::join!(
            run_timer_scheduler(b1, h1, self.clock.clone()),
            run_job_timeout_checker(b2, h2),
            run_message_expiry_checker(b3),
            run_metrics_updater(b4),
        );
    }
}

async fn run_timer_scheduler(backend: Arc<dyn StateBackend>, engine_handle: EngineHandle, clock: Arc<dyn Clock>) {
    loop {
        tokio::time::sleep(Duration::from_millis(100)).await;

        match backend.get_due_timers(clock.now(), 100).await {
            Ok(timers) => {
                for timer in timers {
                    if let Err(e) = backend.update_timer_state(timer.key, "FIRED").await {
                        tracing::warn!("Could not mark timer {} as fired: {}", timer.key, e);
                        continue;
                    }

                    let result = engine_handle
                        .send_command(
                            "TIMER".to_string(),
                            "TRIGGER".to_string(),
                            serde_json::json!({ "timerKey": timer.key.to_string() }),
                            timer.tenant_id.clone(),
                        )
                        .await;

                    if let Err(e) = result {
                        tracing::error!("Timer trigger error for key {}: {}", timer.key, e);
                    }
                }
            }
            Err(e) => {
                tracing::error!("Timer scheduler fetch error: {}", e);
            }
        }
    }
}

async fn run_job_timeout_checker(backend: Arc<dyn StateBackend>, _engine_handle: EngineHandle) {
    loop {
        tokio::time::sleep(Duration::from_secs(1)).await;

        match backend.mark_timed_out_jobs().await {
            Ok(count) if count > 0 => {
                tracing::debug!("Marked {} jobs as timed out", count);
            }
            Ok(_) => {}
            Err(e) => {
                tracing::error!("Job timeout checker error: {}", e);
            }
        }
    }
}

async fn run_message_expiry_checker(backend: Arc<dyn StateBackend>) {
    loop {
        tokio::time::sleep(Duration::from_secs(5)).await;

        match backend.expire_old_messages().await {
            Ok(count) if count > 0 => {
                tracing::debug!("Expired {} messages", count);
            }
            Ok(_) => {}
            Err(e) => {
                tracing::error!("Message expiry checker error: {}", e);
            }
        }
    }
}

async fn run_metrics_updater(backend: Arc<dyn StateBackend>) {
    loop {
        tokio::time::sleep(Duration::from_secs(15)).await;

        match backend.count_active_process_instances().await {
            Ok(count) => metrics::gauge!("reebe_active_process_instances").set(count as f64),
            Err(e) => tracing::warn!("Metrics: failed to count active process instances: {}", e),
        }

        match backend.count_active_incidents().await {
            Ok(count) => metrics::gauge!("reebe_active_incidents").set(count as f64),
            Err(e) => tracing::warn!("Metrics: failed to count active incidents: {}", e),
        }

        match backend.count_active_jobs_by_type().await {
            Ok(rows) => {
                for (job_type, count) in rows {
                    metrics::gauge!("reebe_active_jobs", "type" => job_type).set(count as f64);
                }
            }
            Err(e) => tracing::warn!("Metrics: failed to count active jobs: {}", e),
        }
    }
}
