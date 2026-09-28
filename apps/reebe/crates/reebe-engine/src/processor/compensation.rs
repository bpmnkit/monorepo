//! Compensation, as Zeebe runs it.
//!
//! When an activity with a compensation boundary event completes, a *compensation
//! subscription* records it, with the handler an association links to that boundary
//! event and the flow scope the activity completed in. A multi-instance activity is
//! recorded once, when its body completes; an activity that completes several times
//! is recorded each time.
//!
//! A compensation intermediate throw or end event invokes, all at once, the handlers
//! of the activities that completed in its flow scope and in the completed
//! sub-processes inside it, most recently completed first; active or terminated
//! sub-processes are not compensated. With `activityRef`, only that activity of the
//! scope is compensated. A throw event inside an event sub-process compensates the
//! event sub-process and the scope around it. Each recorded completion is compensated
//! once.
//!
//! As in Zeebe, every handler runs in the throw event's flow scope (Zeebe activates the
//! handler with the throw event's record), and it starts without local variables of its
//! own beyond its input mappings: it sees the variables of that scope. The throw event
//! stays active until every handler it invoked has completed, then continues. A handler
//! that is terminated on its own (say, by a boundary event on it, which Zeebe's
//! validator rejects for tasks) does not release it: Zeebe's
//! `BpmnCompensationSubscriptionBehaviour` completes a handler's subscription, and then
//! the throw event, only from `completeCompensationHandler`, which the element
//! processors call when an element completes, never when it is terminated. The throw
//! event waits until its scope is terminated.

use std::cmp::Reverse;
use std::collections::HashMap;
use std::sync::Arc;
use reebe_bpmn::BpmnProcess;
use reebe_db::state::compensation::CompensationSubscription;
use reebe_db::state::element_instances::ElementInstance;
use crate::engine::EngineState;
use crate::error::EngineResult;
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, Writers};

/// An activity completed: record it if it has a compensation handler.
pub(crate) async fn activity_completed(
    state: &EngineState,
    process: &BpmnProcess,
    activity: &ElementInstance,
) -> EngineResult<()> {
    let Some(handler) = process.compensation_handler(&activity.element_id) else { return Ok(()) };
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    state.backend.upsert_compensation_subscription(&CompensationSubscription {
        key: key_gen.next_key().await?,
        process_instance_key: activity.process_instance_key,
        compensable_activity_id: activity.element_id.clone(),
        compensable_activity_instance_key: activity.key,
        compensable_activity_scope_key: activity.flow_scope_key.unwrap_or(activity.process_instance_key),
        compensation_handler_id: handler.to_string(),
        throw_event_instance_key: None,
        compensation_handler_instance_key: None,
        tenant_id: activity.tenant_id.clone(),
    }).await?;
    Ok(())
}

/// A compensation throw event activated: invoke the handlers it compensates.
/// Returns whether it invoked any; if so, it waits for them to complete.
pub(crate) async fn throw(
    state: &EngineState,
    writers: &mut Writers,
    thrower: &ElementInstance,
    activity_ref: Option<&str>,
) -> EngineResult<bool> {
    let pi = thrower.process_instance_key;
    let instances: HashMap<i64, ElementInstance> = state.backend
        .get_element_instances_by_process_instance(pi)
        .await?
        .into_iter()
        .map(|ei| (ei.key, ei))
        .collect();
    let scope_key = thrower.flow_scope_key.unwrap_or(pi);
    let mut scope_keys = vec![scope_key];
    if let Some(esp) = instances.get(&scope_key).filter(|ei| ei.element_type == "EVENT_SUB_PROCESS") {
        scope_keys.push(esp.flow_scope_key.unwrap_or(pi));
    }
    // The subscription's scope is a compensated scope, or a completed sub-process
    // inside one.
    let within = |mut key: i64| loop {
        if scope_keys.contains(&key) {
            return true;
        }
        match instances.get(&key) {
            Some(ei) if ei.state == "COMPLETED" && ei.element_type != "PROCESS" => {
                key = ei.flow_scope_key.unwrap_or(pi);
            }
            _ => return false,
        }
    };
    let mut invoked: Vec<CompensationSubscription> = state.backend
        .get_compensation_subscriptions(pi)
        .await?
        .into_iter()
        .filter(|s| s.throw_event_instance_key.is_none())
        .filter(|s| match activity_ref {
            Some(activity) => s.compensable_activity_id == activity && scope_keys.contains(&s.compensable_activity_scope_key),
            None => within(s.compensable_activity_scope_key),
        })
        .collect();
    invoked.sort_by_key(|s| Reverse(s.key));

    for sub in &invoked {
        state.backend.upsert_compensation_subscription(&CompensationSubscription {
            throw_event_instance_key: Some(thrower.key),
            ..sub.clone()
        }).await?;
        writers.commands.push(CommandToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ACTIVATE_ELEMENT".to_string(),
            key: pi,
            payload: serde_json::json!({
                "processInstanceKey": pi.to_string(),
                "processDefinitionKey": thrower.process_definition_key.to_string(),
                "bpmnProcessId": thrower.bpmn_process_id,
                "elementId": sub.compensation_handler_id,
                "flowScopeKey": scope_key.to_string(),
                "compensationSubscriptionKey": sub.key.to_string(),
                "tenantId": thrower.tenant_id,
            }),
        });
    }
    Ok(!invoked.is_empty())
}

/// A compensation handler is activating as `handler_key`: link it to its subscription.
pub(crate) async fn handler_activating(
    state: &EngineState,
    payload: &serde_json::Value,
    process_instance_key: i64,
    handler_key: i64,
) -> EngineResult<()> {
    let Some(sub_key) = payload["compensationSubscriptionKey"].as_str().and_then(|k| k.parse::<i64>().ok()) else {
        return Ok(());
    };
    let Some(sub) = state.backend
        .get_compensation_subscriptions(process_instance_key)
        .await?
        .into_iter()
        .find(|s| s.key == sub_key)
    else {
        return Ok(());
    };
    state.backend.upsert_compensation_subscription(&CompensationSubscription {
        compensation_handler_instance_key: Some(handler_key),
        ..sub
    }).await?;
    Ok(())
}

/// An element instance completed: if it is a compensation handler,
/// and the last one its throw event waits for, the throw event completes.
pub(crate) async fn handler_completed(
    state: &EngineState,
    writers: &mut Writers,
    handler: &ElementInstance,
) -> EngineResult<()> {
    let subs = state.backend.get_compensation_subscriptions(handler.process_instance_key).await?;
    let Some(sub) = subs.iter().find(|s| s.compensation_handler_instance_key == Some(handler.key)) else {
        return Ok(());
    };
    state.backend.delete_compensation_subscription(sub.key).await?;
    let Some(throw_key) = sub.throw_event_instance_key else { return Ok(()) };
    if subs.iter().any(|s| s.key != sub.key && s.throw_event_instance_key == Some(throw_key)) {
        return Ok(());
    }
    let Ok(thrower) = state.backend.get_element_instance_by_key(throw_key).await else { return Ok(()) };
    if thrower.state != "ACTIVATED" {
        return Ok(());
    }
    writers.commands.push(CommandToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "COMPLETE_ELEMENT".to_string(),
        key: thrower.key,
        payload: serde_json::json!({
            "elementInstanceKey": thrower.key.to_string(),
            "processInstanceKey": thrower.process_instance_key.to_string(),
            "processDefinitionKey": thrower.process_definition_key.to_string(),
            "elementId": thrower.element_id,
            "elementType": thrower.element_type,
            "bpmnProcessId": thrower.bpmn_process_id,
            "flowScopeKey": thrower.flow_scope_key.unwrap_or(thrower.process_instance_key).to_string(),
            "tenantId": thrower.tenant_id,
        }),
    });
    Ok(())
}
