//! Timer and message start events of a process (not those of event sub-processes).
//!
//! As in Zeebe, deploying a process schedules a timer for each timer start event
//! and opens a subscription for each message start event, and cancels those of
//! the previous version. A timer firing, or a published message whose name
//! matches, creates an instance of that version at that start event.
//!
//! A message with a correlation key does not start a process while an instance
//! of it that a message with the same key started is still active; it stays
//! buffered and starts one when that instance ends. A message starts a process
//! at most once.

use std::collections::HashSet;
use std::sync::Arc;
use reebe_bpmn::{BpmnProcess, EventDefinition, FlowElement};
use reebe_db::state::deployments::ProcessDefinition;
use reebe_db::state::messages::{Message, MessageStartCorrelation, MessageStartEventSubscription};
use reebe_db::state::timers::Timer;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::catch_event::timer_schedule;
use super::{CommandToWrite, Writers};

/// Schedule the timer start events and open the message start event subscriptions
/// of a newly deployed version, replacing those of `previous`.
pub(crate) async fn register(
    state: &EngineState,
    process: &BpmnProcess,
    pd: &ProcessDefinition,
    previous: Option<&ProcessDefinition>,
) -> EngineResult<()> {
    if let Some(previous) = previous {
        state.backend.cancel_start_timers(previous.key).await?;
    }
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    // A timer start event's expression is evaluated on deployment, without variables.
    let ctx = reebe_feel::FeelContext::from_json(serde_json::json!({}));
    let mut subscriptions = Vec::new();
    for id in &process.start_events {
        let Some(FlowElement::StartEvent(start)) = process.elements.get(id) else { continue };
        match &start.event_definition {
            Some(EventDefinition::Timer(def)) => {
                let schedule = timer_schedule(def, &ctx, state.clock.now());
                insert_start_timer(state, pd, id, schedule.due, schedule.repetitions).await?;
            }
            Some(EventDefinition::Message(def)) => subscriptions.push(MessageStartEventSubscription {
                key: key_gen.next_key().await?,
                message_name: def.message_name.clone(),
                bpmn_process_id: pd.bpmn_process_id.clone(),
                start_event_id: id.clone(),
                process_definition_key: pd.key,
                tenant_id: pd.tenant_id.clone(),
            }),
            _ => {}
        }
    }
    state.backend
        .replace_message_start_subscriptions(&pd.bpmn_process_id, &pd.tenant_id, &subscriptions)
        .await?;
    Ok(())
}

async fn insert_start_timer(
    state: &EngineState,
    pd: &ProcessDefinition,
    start_event_id: &str,
    due: chrono::DateTime<chrono::Utc>,
    repetitions: i32,
) -> EngineResult<()> {
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    state.backend.insert_timer(&Timer {
        key: key_gen.next_key().await?,
        process_instance_key: None,
        process_definition_key: Some(pd.key),
        element_instance_key: None,
        element_id: start_event_id.to_string(),
        due_date: due,
        repetitions,
        state: "ACTIVE".to_string(),
        tenant_id: pd.tenant_id.clone(),
    }).await?;
    Ok(())
}

/// A timer start event's timer fired: create an instance at the start event and,
/// for a cycle, schedule the next firing.
pub(crate) async fn start_timer_fired(
    state: &EngineState,
    writers: &mut Writers,
    timer: &Timer,
) -> EngineResult<()> {
    let Some(pd_key) = timer.process_definition_key else { return Ok(()) };
    let pd = state.backend.get_process_definition_by_key(pd_key).await?;
    // A newer version replaced this timer after the scheduler picked it up.
    let latest = state.backend.get_latest_process_definition(&pd.bpmn_process_id, &pd.tenant_id).await?;
    if latest.key != pd.key {
        return Ok(());
    }
    create_instance(writers, &pd, &timer.element_id, serde_json::json!({}), None);

    if timer.repetitions == 1 {
        return Ok(());
    }
    let process = reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
        .map_err(|e| EngineError::BpmnParse(e.to_string()))?
        .into_iter()
        .find(|p| p.id == pd.bpmn_process_id)
        .ok_or_else(|| EngineError::NotFound(format!("Process {}", pd.bpmn_process_id)))?;
    let Some(FlowElement::StartEvent(start)) = process.elements.get(&timer.element_id) else { return Ok(()) };
    let Some(EventDefinition::Timer(def)) = &start.event_definition else { return Ok(()) };
    let now = state.clock.now();
    let ctx = reebe_feel::FeelContext::from_json(serde_json::json!({}));
    // Zeebe computes the next due date from the time the timer triggered, so a timer
    // that fires late does not catch up with a burst of instances.
    let Some(next) = timer_schedule(def, &ctx, now).cycle.and_then(|c| c.next_after(now)) else { return Ok(()) };
    let remaining = if timer.repetitions < 0 { -1 } else { timer.repetitions - 1 };
    insert_start_timer(state, &pd, &timer.element_id, next, remaining).await
}

/// Start an instance of every process with a message start event for `message`.
pub(crate) async fn message_published(
    state: &EngineState,
    writers: &mut Writers,
    message: &Message,
) -> EngineResult<()> {
    let subscriptions = state.backend
        .get_message_start_subscriptions_by_name(&message.name, &message.tenant_id)
        .await?;
    // One instance per process, even if several of its start events take the message.
    let mut started = HashSet::new();
    for sub in &subscriptions {
        if !started.contains(&sub.bpmn_process_id) && correlate(state, writers, sub, message).await? {
            started.insert(sub.bpmn_process_id.clone());
        }
    }
    Ok(())
}

/// A process instance ended. If a message with a correlation key started it, a
/// message with that key buffered meanwhile starts the next instance.
pub(crate) async fn instance_ended(
    state: &EngineState,
    writers: &mut Writers,
    process_instance_key: i64,
) -> EngineResult<()> {
    let Some(ended) = state.backend.get_message_start_correlation_by_instance(process_instance_key).await? else {
        return Ok(());
    };
    let subscriptions = state.backend
        .get_message_start_subscriptions_by_process(&ended.bpmn_process_id, &ended.tenant_id)
        .await?;
    for sub in &subscriptions {
        let buffered = state.backend
            .get_messages_by_correlation(&sub.message_name, &ended.correlation_key, &ended.tenant_id)
            .await?;
        for message in &buffered {
            if correlate(state, writers, sub, message).await? {
                return Ok(());
            }
        }
    }
    Ok(())
}

/// Create an instance for `message` at the start event of `sub`, unless the
/// correlation key rules forbid it. Returns whether an instance was created.
async fn correlate(
    state: &EngineState,
    writers: &mut Writers,
    sub: &MessageStartEventSubscription,
    message: &Message,
) -> EngineResult<bool> {
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    let instance_key = key_gen.next_key().await?;
    if !message.correlation_key.is_empty() {
        let previous = state.backend
            .get_message_start_correlations(&sub.bpmn_process_id, &message.correlation_key, &message.tenant_id)
            .await?;
        if previous.iter().any(|c| c.message_key == message.key) {
            return Ok(false);
        }
        for c in &previous {
            if instance_is_active(state, c.process_instance_key).await {
                return Ok(false);
            }
        }
        // Recorded now, with the key the instance will get, so that a second message
        // processed before the instance exists sees it.
        state.backend.insert_message_start_correlation(&MessageStartCorrelation {
            process_instance_key: instance_key,
            message_key: message.key,
            bpmn_process_id: sub.bpmn_process_id.clone(),
            correlation_key: message.correlation_key.clone(),
            tenant_id: message.tenant_id.clone(),
        }).await?;
    }
    let pd = state.backend.get_process_definition_by_key(sub.process_definition_key).await?;
    create_instance(writers, &pd, &sub.start_event_id, message.variables.clone(), Some(instance_key));
    Ok(true)
}

/// An instance that has not been created yet (its creation command is still
/// waiting to be processed) counts as active.
async fn instance_is_active(state: &EngineState, process_instance_key: i64) -> bool {
    match state.backend.get_process_instance_by_key(process_instance_key).await {
        Ok(pi) => pi.state == "ACTIVE",
        Err(_) => true,
    }
}

fn create_instance(
    writers: &mut Writers,
    pd: &ProcessDefinition,
    start_event_id: &str,
    variables: serde_json::Value,
    instance_key: Option<i64>,
) {
    let mut payload = serde_json::json!({
        "processDefinitionKey": pd.key.to_string(),
        "startEventId": start_event_id,
        "variables": variables,
        "tenantId": pd.tenant_id,
    });
    if let Some(key) = instance_key {
        payload["processInstanceKey"] = serde_json::json!(key.to_string());
    }
    writers.commands.push(CommandToWrite {
        value_type: "PROCESS_INSTANCE_CREATION".to_string(),
        intent: "CREATE".to_string(),
        key: 0,
        payload,
    });
}
