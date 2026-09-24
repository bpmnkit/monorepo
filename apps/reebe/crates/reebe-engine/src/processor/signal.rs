use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use crate::engine::EngineState;
use crate::error::EngineResult;
use crate::key_gen::KeyGenerator;
use super::catch_event::{trigger, CatchRef, Triggered};
use super::{EventToWrite, RecordProcessor, Writers};

pub struct SignalProcessor;

#[async_trait]
impl RecordProcessor for SignalProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "SIGNAL" && intent == "BROADCAST"
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let signal_key = key_gen.next_key().await?;
        let signal_name = payload["signalName"].as_str().unwrap_or("").to_string();
        let variables = payload.get("variables").cloned()
            .unwrap_or_else(|| serde_json::Value::Object(Default::default()));

        writers.events.push(EventToWrite {
            value_type: "SIGNAL".to_string(),
            intent: "BROADCASTED".to_string(),
            key: signal_key,
            payload: serde_json::json!({
                "signalKey": signal_key.to_string(),
                "signalName": signal_name,
                "variables": variables,
                "tenantId": tenant_id,
            }),
        });

        // Activate all waiting signal catch events
        let subscriptions = state.backend
            .get_signal_subscriptions_by_name(&signal_name, &tenant_id)
            .await
            .unwrap_or_default();

        for sub in subscriptions {
            // The subscription's owner is the waiting catch event, an activity with a
            // signal boundary event, or an event-based gateway.
            let outcome = trigger(
                state,
                writers,
                sub.element_instance_key,
                CatchRef::Element(&sub.element_id),
                variables.clone(),
            )
            .await?;
            // A non-interrupting boundary event keeps waiting; otherwise the
            // subscription is used up.
            if outcome != Triggered::KeepWaiting {
                let _ = state.backend.delete_signal_subscription(sub.key).await;
            }
        }

        writers.response = Some(serde_json::json!({
            "signalKey": signal_key.to_string(),
            "tenantId": tenant_id,
        }));

        Ok(())
    }
}
