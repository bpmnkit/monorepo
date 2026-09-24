use async_trait::async_trait;
use reebe_db::records::DbRecord;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use super::catch_event::{reschedule_cycle, trigger, CatchRef, Triggered};
use super::{EventToWrite, RecordProcessor, Writers};

pub struct TimerProcessor;

#[async_trait]
impl RecordProcessor for TimerProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "TIMER" && intent == "TRIGGER"
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let timer_key: i64 = payload["timerKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["timerKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing timerKey".to_string()))?;

        let timer = state.backend.get_timer_by_key(timer_key).await?;
        state.backend.update_timer_state(timer_key, "TRIGGERED").await?;

        writers.events.push(EventToWrite {
            value_type: "TIMER".to_string(),
            intent: "TRIGGERED".to_string(),
            key: timer_key,
            payload: serde_json::json!({
                "timerKey": timer_key.to_string(),
                "elementId": timer.element_id,
                "tenantId": tenant_id,
            }),
        });

        // The timer's owner is its catch event, an activity with a timer boundary
        // event, or an event-based gateway.
        if let Some(owner_key) = timer.element_instance_key {
            let outcome = trigger(
                state,
                writers,
                owner_key,
                CatchRef::Element(&timer.element_id),
                serde_json::json!({}),
            )
            .await?;
            if outcome == Triggered::KeepWaiting {
                reschedule_cycle(state, &timer).await?;
            }
        }

        Ok(())
    }
}
