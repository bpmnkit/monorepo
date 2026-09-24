use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::messages::Message;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::catch_event::{trigger, CatchRef, Triggered};
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

pub struct MessageProcessor;

#[async_trait]
impl RecordProcessor for MessageProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        (value_type == "MESSAGE" && matches!(intent, "PUBLISH" | "CORRELATE"))
            || (value_type == "MESSAGE_SUBSCRIPTION" && intent == "CORRELATE")
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        match (record.value_type.as_str(), record.intent.as_str()) {
            ("MESSAGE", "PUBLISH") => self.publish_message(record, state, writers).await,
            ("MESSAGE", "CORRELATE") | ("MESSAGE_SUBSCRIPTION", "CORRELATE") => {
                self.correlate_message(record, state, writers).await
            }
            _ => Ok(()),
        }
    }
}

impl MessageProcessor {
    async fn publish_message(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let msg_key = key_gen.next_key().await?;
        let name = payload["messageName"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let correlation_key = payload["correlationKey"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let ttl_ms = payload["timeToLive"]
            .as_i64()
            .unwrap_or(3600000); // 1 hour default
        let variables = payload.get("variables").cloned()
            .unwrap_or_else(|| serde_json::Value::Object(Default::default()));
        let expires_at = state.clock.now() + chrono::Duration::milliseconds(ttl_ms);

        let msg = Message {
            key: msg_key,
            name: name.clone(),
            correlation_key: correlation_key.clone(),
            time_to_live_ms: ttl_ms,
            expires_at,
            variables: variables.clone(),
            state: "PUBLISHED".to_string(),
            tenant_id: tenant_id.clone(),
            created_at: state.clock.now(),
        };
        state.backend.insert_message(&msg).await?;

        writers.events.push(EventToWrite {
            value_type: "MESSAGE".to_string(),
            intent: "PUBLISHED".to_string(),
            key: msg_key,
            payload: serde_json::json!({
                "messageKey": msg_key.to_string(),
                "messageName": name,
                "correlationKey": correlation_key,
                "tenantId": tenant_id,
            }),
        });

        // Check for waiting subscriptions
        let subs = state.backend
            .get_message_subscriptions_by_correlation(&name, &correlation_key, &tenant_id)
            .await
            .unwrap_or_default();

        for sub in subs.into_iter().filter(|s| s.state == "OPENED") {
            writers.commands.push(CommandToWrite {
                value_type: "MESSAGE_SUBSCRIPTION".to_string(),
                intent: "CORRELATE".to_string(),
                key: sub.key,
                payload: serde_json::json!({
                    "subscriptionKey": sub.key.to_string(),
                    "messageKey": msg_key.to_string(),
                    "messageName": name,
                    "correlationKey": correlation_key,
                    "processInstanceKey": sub.process_instance_key.to_string(),
                    "elementInstanceKey": sub.element_instance_key.to_string(),
                    "variables": variables,
                    "tenantId": tenant_id,
                }),
            });
        }

        super::start_event::message_published(state, writers, &msg).await?;

        writers.response = Some(serde_json::json!({
            "messageKey": msg_key.to_string(),
            "tenantId": tenant_id,
        }));

        Ok(())
    }

    async fn correlate_message(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let tenant_id = record.tenant_id.clone();

        let sub_key: i64 = payload["subscriptionKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["subscriptionKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing subscriptionKey".to_string()))?;

        let element_instance_key: i64 = payload["elementInstanceKey"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .or_else(|| payload["elementInstanceKey"].as_i64())
            .ok_or_else(|| EngineError::InvalidState("Missing elementInstanceKey".to_string()))?;

        let message_name = payload["messageName"].as_str().unwrap_or("");
        let variables = payload.get("variables").cloned().unwrap_or(serde_json::Value::Null);
        // The subscription's owner is the waiting catch event or receive task, an
        // activity with a message boundary event, or an event-based gateway.
        let outcome = trigger(
            state,
            writers,
            element_instance_key,
            CatchRef::Message(message_name),
            variables,
            record.position,
        )
        .await?;
        if outcome == Triggered::Ignored {
            return Ok(());
        }
        // A non-interrupting boundary event keeps its subscription open.
        if outcome == Triggered::Done {
            state.backend.update_message_subscription_state(sub_key, "CORRELATED").await?;
        }

        writers.events.push(EventToWrite {
            value_type: "MESSAGE_SUBSCRIPTION".to_string(),
            intent: "CORRELATED".to_string(),
            key: sub_key,
            payload: serde_json::json!({
                "subscriptionKey": sub_key.to_string(),
                "elementInstanceKey": element_instance_key.to_string(),
                "tenantId": tenant_id,
            }),
        });

        Ok(())
    }
}
