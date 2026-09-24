//! Waiting for timers, messages and signals, and what happens when one arrives.
//!
//! A wait belongs to an *owner* element instance and names the *catch element*
//! it triggers:
//!
//! - an intermediate catch event or receive task owns its own wait;
//! - an activity owns the waits of its boundary events, armed when it activates;
//! - an event-based gateway owns the waits of the catch events and receive tasks
//!   after it, armed when it activates.
//!
//! Timers carry the catch element id; a message subscription's catch element is
//! found from the message name, which Zeebe requires to be unique among the
//! events of one boundary set or gateway. When the owner completes or is
//! terminated, its waits are cancelled.

use std::sync::Arc;
use reebe_bpmn::{BpmnProcess, EventDefinition, FlowElement, TimerEventDefinition, TimerType};
use reebe_db::state::element_instances::ElementInstance;
use reebe_db::state::messages::MessageSubscription;
use reebe_db::state::signal_subscriptions::SignalSubscription;
use reebe_db::state::timers::Timer;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::scope;
use super::throw_event::terminate_subtree;
use super::{CommandToWrite, EventToWrite, Writers};

/// What an element waits for.
pub(crate) enum Wait<'a> {
    Timer(&'a TimerEventDefinition),
    Message { name: &'a str, correlation_key: Option<&'a str> },
    Signal(&'a str),
}

/// The wait of a catch event, receive task or boundary event, if it has one.
pub(crate) fn wait_of(element: &FlowElement) -> Option<Wait<'_>> {
    let def = match element {
        FlowElement::IntermediateCatchEvent(e) => e.event_definition.as_ref(),
        FlowElement::BoundaryEvent(e) => e.event_definition.as_ref(),
        FlowElement::ReceiveTask(rt) => {
            let name = rt.message_name.as_deref().or(rt.message_ref.as_deref()).unwrap_or("");
            return Some(Wait::Message { name, correlation_key: rt.correlation_key.as_deref() });
        }
        _ => None,
    };
    match def {
        Some(EventDefinition::Timer(t)) => Some(Wait::Timer(t)),
        Some(EventDefinition::Message(m)) => Some(Wait::Message {
            name: &m.message_name,
            correlation_key: m.correlation_key.as_deref(),
        }),
        Some(EventDefinition::Signal(s)) => Some(Wait::Signal(&s.signal_name)),
        _ => None,
    }
}

/// When a timer is due, and how it repeats.
pub(crate) struct Schedule {
    pub due: chrono::DateTime<chrono::Utc>,
    /// Remaining firings including this one; -1 repeats without end.
    pub repetitions: i32,
    /// The time between firings of a cycle.
    pub interval: Option<chrono::Duration>,
}

/// Evaluate a timer definition. A `=` expression is evaluated with FEEL; the
/// result, or a plain value, is read as an ISO 8601 duration, date-time or
/// repeating interval (`R3/PT10M`, `R/PT1H`, `R2/2026-01-01T00:00:00Z/P1D`).
pub(crate) fn timer_schedule(
    def: &TimerEventDefinition,
    ctx: &reebe_feel::FeelContext,
    now: chrono::DateTime<chrono::Utc>,
) -> Schedule {
    let once = |due| Schedule { due, repetitions: 1, interval: None };
    let text = match reebe_feel::parse_and_evaluate(def.expression.trim(), ctx) {
        Ok(reebe_feel::FeelValue::Duration(ms)) => return once(now + chrono::Duration::milliseconds(ms)),
        Ok(reebe_feel::FeelValue::DateTime(dt)) => return once(dt),
        Ok(reebe_feel::FeelValue::String(s)) => s,
        _ => {
            tracing::warn!(expression = %def.expression, "Timer expression did not evaluate; firing now");
            return once(now);
        }
    };
    let text = text.trim().trim_matches('"');

    if def.timer_type == TimerType::Cycle || text.starts_with('R') {
        let mut parts = text.split('/');
        let count = parts.next().unwrap_or("R").trim_start_matches('R');
        let repetitions = if count.is_empty() { -1 } else { count.parse().unwrap_or(1) };
        let rest: Vec<&str> = parts.collect();
        let (start, period) = match rest.as_slice() {
            [period] => (None, *period),
            [start, period] => (parse_date_time(start), *period),
            _ => (None, ""),
        };
        return match parse_duration(period, ctx) {
            Some(interval) => Schedule {
                due: start.unwrap_or(now + interval),
                repetitions,
                interval: Some(interval),
            },
            None => {
                tracing::warn!(expression = %text, "Could not parse timer cycle; firing now");
                once(now)
            }
        };
    }

    if let Some(dt) = parse_date_time(text) {
        return once(dt);
    }
    match parse_duration(text, ctx) {
        Some(d) => once(now + d),
        None => {
            tracing::warn!(expression = %text, "Could not parse timer expression; firing now");
            once(now)
        }
    }
}

fn parse_date_time(text: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(text.trim()).ok().map(|d| d.with_timezone(&chrono::Utc))
}

fn parse_duration(text: &str, ctx: &reebe_feel::FeelContext) -> Option<chrono::Duration> {
    match reebe_feel::evaluate(&format!("duration(\"{}\")", text.trim()), ctx) {
        Ok(reebe_feel::FeelValue::Duration(ms)) => Some(chrono::Duration::milliseconds(ms)),
        _ => None,
    }
}

/// Resolve a subscription's correlation key. A `=` expression is evaluated with
/// FEEL; Zeebe accepts a string or a number.
pub(crate) fn correlation_key(expression: Option<&str>, ctx: &reebe_feel::FeelContext) -> String {
    let Some(expression) = expression else { return String::new() };
    if !reebe_feel::is_feel_expression(expression) {
        return expression.to_string();
    }
    match reebe_feel::parse_and_evaluate(expression, ctx).map(serde_json::Value::from) {
        Ok(serde_json::Value::String(s)) => s,
        Ok(serde_json::Value::Null) | Err(_) => {
            tracing::warn!(expression = %expression, "Correlation key did not evaluate to a value");
            String::new()
        }
        Ok(other) => other.to_string(),
    }
}

/// Open the wait of `catch_id` on behalf of `owner`.
pub(crate) async fn open_wait(
    state: &EngineState,
    writers: &mut Writers,
    owner: &ElementInstance,
    catch_id: &str,
    wait: Wait<'_>,
) -> EngineResult<()> {
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    let ctx = scope::feel_context(state, owner.process_instance_key, owner.key).await;
    match wait {
        Wait::Timer(def) => {
            let schedule = timer_schedule(def, &ctx, state.clock.now());
            insert_timer(state, owner, catch_id, schedule.due, schedule.repetitions).await?;
        }
        Wait::Message { name, correlation_key: key_expr } => {
            let key = correlation_key(key_expr, &ctx);
            let sub_key = key_gen.next_key().await?;
            state.backend.insert_message_subscription(&MessageSubscription {
                key: sub_key,
                message_name: name.to_string(),
                correlation_key: key.clone(),
                process_instance_key: owner.process_instance_key,
                element_instance_key: owner.key,
                state: "OPENED".to_string(),
                tenant_id: owner.tenant_id.clone(),
            }).await?;
            // A message published before the subscription opened correlates now.
            let buffered = state.backend
                .get_messages_by_correlation(name, &key, &owner.tenant_id)
                .await
                .unwrap_or_default();
            if let Some(msg) = buffered.into_iter().next() {
                writers.commands.push(CommandToWrite {
                    value_type: "MESSAGE_SUBSCRIPTION".to_string(),
                    intent: "CORRELATE".to_string(),
                    key: sub_key,
                    payload: serde_json::json!({
                        "subscriptionKey": sub_key.to_string(),
                        "messageKey": msg.key.to_string(),
                        "messageName": name,
                        "correlationKey": key,
                        "processInstanceKey": owner.process_instance_key.to_string(),
                        "elementInstanceKey": owner.key.to_string(),
                        "variables": msg.variables,
                        "tenantId": owner.tenant_id,
                    }),
                });
            }
        }
        Wait::Signal(name) => {
            state.backend.insert_signal_subscription(&SignalSubscription {
                key: key_gen.next_key().await?,
                signal_name: name.to_string(),
                process_instance_key: owner.process_instance_key,
                element_instance_key: owner.key,
                element_id: catch_id.to_string(),
                bpmn_process_id: owner.bpmn_process_id.clone(),
                process_definition_key: owner.process_definition_key,
                flow_scope_key: owner.flow_scope_key.unwrap_or(owner.process_instance_key),
                tenant_id: owner.tenant_id.clone(),
            }).await?;
        }
    }
    Ok(())
}

pub(crate) async fn insert_timer(
    state: &EngineState,
    owner: &ElementInstance,
    catch_id: &str,
    due: chrono::DateTime<chrono::Utc>,
    repetitions: i32,
) -> EngineResult<()> {
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    state.backend.insert_timer(&Timer {
        key: key_gen.next_key().await?,
        process_instance_key: Some(owner.process_instance_key),
        process_definition_key: Some(owner.process_definition_key),
        element_instance_key: Some(owner.key),
        element_id: catch_id.to_string(),
        due_date: due,
        repetitions,
        state: "ACTIVE".to_string(),
        tenant_id: owner.tenant_id.clone(),
    }).await?;
    Ok(())
}

/// Boundary events attached to `activity_id`, wherever they are nested.
pub(crate) fn boundary_events<'a>(
    elements: &'a std::collections::HashMap<String, FlowElement>,
    activity_id: &str,
    out: &mut Vec<&'a reebe_bpmn::BoundaryEvent>,
) {
    for el in elements.values() {
        match el {
            FlowElement::BoundaryEvent(be) if be.attached_to_ref == activity_id => out.push(be),
            FlowElement::SubProcess(sp) => boundary_events(&sp.elements, activity_id, out),
            _ => {}
        }
    }
}

/// Arm the timer, message and signal boundary events of an activity that just activated.
pub(crate) async fn arm_boundary_events(
    state: &EngineState,
    writers: &mut Writers,
    process: &BpmnProcess,
    activity: &ElementInstance,
) -> EngineResult<()> {
    let mut boundaries = Vec::new();
    boundary_events(&process.elements, &activity.element_id, &mut boundaries);
    for be in boundaries {
        if let Some(wait) = wait_of(&FlowElement::BoundaryEvent(be.clone())) {
            open_wait(state, writers, activity, &be.id, wait).await?;
        }
    }
    Ok(())
}

/// Arm the events after an event-based gateway that just activated.
pub(crate) async fn arm_event_based_gateway(
    state: &EngineState,
    writers: &mut Writers,
    process: &BpmnProcess,
    gateway: &ElementInstance,
) -> EngineResult<()> {
    for flow in process.outgoing_flows_recursive(&gateway.element_id) {
        let target = process.get_element_recursive(&flow.target_ref);
        match target.and_then(wait_of) {
            Some(wait) => open_wait(state, writers, gateway, &flow.target_ref, wait).await?,
            None => tracing::warn!(
                gateway = %gateway.element_id, target = %flow.target_ref,
                "Event-based gateway target is not a timer, message or signal catch event or a receive task"
            ),
        }
    }
    Ok(())
}

/// Cancel the jobs, timers, user tasks and subscriptions of an element instance.
pub(crate) async fn close_waits(state: &EngineState, element_instance_key: i64) -> EngineResult<()> {
    state.backend.cancel_jobs_by_element_instance(element_instance_key).await?;
    state.backend.cancel_element_instance_waits(element_instance_key).await?;
    Ok(())
}

/// Which catch element a trigger is for.
pub(crate) enum CatchRef<'a> {
    /// A timer or signal names its catch element.
    Element(&'a str),
    /// A message subscription is matched by message name.
    Message(&'a str),
}

/// What became of a wait that triggered.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Triggered {
    /// The owner was no longer waiting; nothing happened.
    Ignored,
    /// The wait is used up.
    Done,
    /// A non-interrupting boundary event: the activity keeps running and the wait stays open.
    KeepWaiting,
}

/// A timer fired, a message correlated or a signal arrived for `owner_key`.
pub(crate) async fn trigger(
    state: &EngineState,
    writers: &mut Writers,
    owner_key: i64,
    catch: CatchRef<'_>,
    variables: serde_json::Value,
) -> EngineResult<Triggered> {
    let Ok(owner) = state.backend.get_element_instance_by_key(owner_key).await else {
        return Ok(Triggered::Ignored);
    };
    if owner.state != "ACTIVATED" {
        return Ok(Triggered::Ignored);
    }
    let pd = state.backend.get_process_definition_by_key(owner.process_definition_key).await?;
    let process = reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
        .map_err(|e| EngineError::BpmnParse(e.to_string()))?
        .into_iter()
        .find(|p| p.id == owner.bpmn_process_id || p.id == pd.bpmn_process_id)
        .ok_or_else(|| EngineError::NotFound(format!("Process {}", owner.bpmn_process_id)))?;

    let catch_id = match catch {
        CatchRef::Element(id) => Some(id.to_string()),
        CatchRef::Message(name) => message_catch_element(&process, &owner, name),
    };
    let Some(catch_id) = catch_id else {
        tracing::warn!(owner = %owner.element_id, "No catch element for the trigger");
        return Ok(Triggered::Ignored);
    };
    let flow_scope_key = owner.flow_scope_key.unwrap_or(owner.process_instance_key);

    // The owner is the catch element: it completes.
    if catch_id == owner.element_id {
        writers.commands.push(CommandToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "COMPLETE_ELEMENT".to_string(),
            key: owner.key,
            payload: serde_json::json!({
                "elementInstanceKey": owner.key.to_string(),
                "processInstanceKey": owner.process_instance_key.to_string(),
                "processDefinitionKey": owner.process_definition_key.to_string(),
                "elementId": owner.element_id,
                "elementType": owner.element_type,
                "bpmnProcessId": owner.bpmn_process_id,
                "flowScopeKey": flow_scope_key.to_string(),
                "variables": variables,
                "tenantId": owner.tenant_id,
            }),
        });
        return Ok(Triggered::Done);
    }

    // An event-based gateway: the first event wins, the others are cancelled.
    if owner.element_type == "EVENT_BASED_GATEWAY" {
        close_waits(state, owner.key).await?;
        state.backend.update_element_instance_state(owner.key, "COMPLETED").await?;
        for intent in ["ELEMENT_COMPLETING", "ELEMENT_COMPLETED"] {
            writers.events.push(element_event(&owner, intent));
        }
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        if let Some(flow) = process
            .outgoing_flows_recursive(&owner.element_id)
            .into_iter()
            .find(|f| f.target_ref == catch_id)
        {
            let flow_key = key_gen.next_key().await?;
            writers.events.push(EventToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "SEQUENCE_FLOW_TAKEN".to_string(),
                key: flow_key,
                payload: serde_json::json!({
                    "flowKey": flow_key.to_string(),
                    "elementId": flow.id,
                    "processInstanceKey": owner.process_instance_key.to_string(),
                    "processDefinitionKey": owner.process_definition_key.to_string(),
                    "bpmnProcessId": owner.bpmn_process_id,
                    "sourceElementId": owner.element_id,
                    "targetElementId": catch_id,
                    "tenantId": owner.tenant_id,
                }),
            });
        }
        activate_triggered(writers, &owner, &catch_id, flow_scope_key, variables);
        return Ok(Triggered::Done);
    }

    // A boundary event of the owner activity.
    let mut boundaries = Vec::new();
    boundary_events(&process.elements, &owner.element_id, &mut boundaries);
    let Some(be) = boundaries.into_iter().find(|be| be.id == catch_id) else {
        tracing::warn!(owner = %owner.element_id, catch = %catch_id, "Trigger for an unknown boundary event");
        return Ok(Triggered::Ignored);
    };
    let interrupting = be.cancel_activity;
    if interrupting {
        terminate_subtree(state, writers, &owner).await?;
    }
    activate_triggered(writers, &owner, &catch_id, flow_scope_key, variables);
    Ok(if interrupting { Triggered::Done } else { Triggered::KeepWaiting })
}

/// The catch element a message for `owner` is meant for.
fn message_catch_element(process: &BpmnProcess, owner: &ElementInstance, name: &str) -> Option<String> {
    let matches = |el: &FlowElement| matches!(wait_of(el), Some(Wait::Message { name: n, .. }) if n == name);
    if owner.element_type == "EVENT_BASED_GATEWAY" {
        return process
            .outgoing_flows_recursive(&owner.element_id)
            .into_iter()
            .map(|f| f.target_ref.clone())
            .find(|id| process.get_element_recursive(id).is_some_and(&matches));
    }
    let mut boundaries = Vec::new();
    boundary_events(&process.elements, &owner.element_id, &mut boundaries);
    boundaries
        .into_iter()
        .find(|be| matches(&FlowElement::BoundaryEvent((*be).clone())))
        .map(|be| be.id.clone())
        .or_else(|| {
            // A catch event or receive task waiting for the message itself.
            process
                .get_element_recursive(&owner.element_id)
                .is_some_and(&matches)
                .then(|| owner.element_id.clone())
        })
}

/// Activate a triggered catch element; it completes at once, with the event's variables.
fn activate_triggered(
    writers: &mut Writers,
    owner: &ElementInstance,
    catch_id: &str,
    flow_scope_key: i64,
    variables: serde_json::Value,
) {
    writers.commands.push(CommandToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "ACTIVATE_ELEMENT".to_string(),
        key: owner.process_instance_key,
        payload: serde_json::json!({
            "processInstanceKey": owner.process_instance_key.to_string(),
            "processDefinitionKey": owner.process_definition_key.to_string(),
            "bpmnProcessId": owner.bpmn_process_id,
            "elementId": catch_id,
            "flowScopeKey": flow_scope_key.to_string(),
            "eventTriggered": true,
            "eventVariables": variables,
            "tenantId": owner.tenant_id,
        }),
    });
}

fn element_event(ei: &ElementInstance, intent: &str) -> EventToWrite {
    EventToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: intent.to_string(),
        key: ei.key,
        payload: serde_json::json!({
            "elementInstanceKey": ei.key.to_string(),
            "processInstanceKey": ei.process_instance_key.to_string(),
            "elementId": ei.element_id,
            "elementType": ei.element_type,
            "bpmnProcessId": ei.bpmn_process_id,
            "tenantId": ei.tenant_id,
        }),
    }
}

/// After a non-interrupting cycle timer on a boundary event fires, schedule its next firing.
pub(crate) async fn reschedule_cycle(
    state: &EngineState,
    timer: &Timer,
) -> EngineResult<()> {
    if timer.repetitions == 1 {
        return Ok(());
    }
    let Some(owner_key) = timer.element_instance_key else { return Ok(()) };
    let Ok(owner) = state.backend.get_element_instance_by_key(owner_key).await else { return Ok(()) };
    if owner.state != "ACTIVATED" {
        return Ok(());
    }
    let pd = state.backend.get_process_definition_by_key(owner.process_definition_key).await?;
    let Some(process) = reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
        .ok()
        .and_then(|ps| ps.into_iter().find(|p| p.id == owner.bpmn_process_id || p.id == pd.bpmn_process_id))
    else {
        return Ok(());
    };
    let Some(FlowElement::BoundaryEvent(be)) = process.get_element_recursive(&timer.element_id) else {
        return Ok(());
    };
    let Some(EventDefinition::Timer(def)) = &be.event_definition else { return Ok(()) };
    let ctx = scope::feel_context(state, owner.process_instance_key, owner.key).await;
    let Some(interval) = timer_schedule(def, &ctx, state.clock.now()).interval else { return Ok(()) };
    let remaining = if timer.repetitions < 0 { -1 } else { timer.repetitions - 1 };
    insert_timer(state, &owner, &timer.element_id, timer.due_date + interval, remaining).await
}
