//! Multi-instance activities, as Zeebe runs them.
//!
//! A multi-instance activity runs as a *body* (element type
//! `MULTI_INSTANCE_BODY`, same element id) that contains one *inner instance*
//! of the activity per item of the `inputCollection`, all at once (parallel) or
//! one after another (sequential). Boundary events attach to the body. Each
//! inner instance has local `loopCounter` (from 1) and `inputElement`
//! variables. When an inner instance completes, its `outputElement` is written
//! into the body-local `outputCollection` at its index and the
//! `completionCondition` is checked, with `numberOfInstances`,
//! `numberOfActiveInstances`, `numberOfCompletedInstances` and
//! `numberOfTerminatedInstances` in scope. When the body completes, the output
//! collection is propagated to the enclosing scope.
//!
//! Zeebe has no `loopCardinality`; `inputCollection = for i in 1..n return i`
//! does the same.

use std::sync::Arc;
use reebe_bpmn::{BpmnProcess, MultiInstanceLoopCharacteristics};
use reebe_db::state::element_instances::ElementInstance;
use crate::engine::EngineState;
use crate::error::EngineResult;
use crate::key_gen::KeyGenerator;
use super::catch_event::arm_boundary_events;
use super::scope;
use super::throw_event::terminate_subtree;
use super::{CommandToWrite, EventToWrite, Writers};

pub(crate) const BODY: &str = "MULTI_INSTANCE_BODY";

/// Body-local variable holding the evaluated input collection.
const ITEMS: &str = "__mi_items";

/// Where an element is being activated.
pub(crate) struct Activation<'a> {
    pub process_instance_key: i64,
    pub process_definition_key: i64,
    pub bpmn_process_id: &'a str,
    pub element_id: &'a str,
    pub flow_scope_key: i64,
    pub tenant_id: &'a str,
}

/// Activate the body of a multi-instance activity and start its first inner instance(s).
/// `retried` is the body that is still activating after an incident, which activates
/// again. Returns the body's key.
pub(crate) async fn activate_body(
    state: &EngineState,
    writers: &mut Writers,
    process: &BpmnProcess,
    mi: &MultiInstanceLoopCharacteristics,
    at: Activation<'_>,
    retried: Option<ElementInstance>,
) -> EngineResult<i64> {
    let body = match retried {
        Some(body) => body,
        None => {
            let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
            let body = ElementInstance {
                key: key_gen.next_key().await?,
                partition_id: state.partition_id,
                process_instance_key: at.process_instance_key,
                process_definition_key: at.process_definition_key,
                bpmn_process_id: at.bpmn_process_id.to_string(),
                element_id: at.element_id.to_string(),
                element_type: BODY.to_string(),
                state: "ACTIVATING".to_string(),
                flow_scope_key: Some(at.flow_scope_key),
                scope_key: None,
                incident_key: None,
                tenant_id: at.tenant_id.to_string(),
            };
            let body = ElementInstance { scope_key: Some(body.key), ..body };
            state.backend.insert_element_instance(&body).await?;
            writers.events.push(element_event(&body, "ELEMENT_ACTIVATING"));
            body
        }
    };

    let ctx = scope::feel_context(state, at.process_instance_key, body.key).await;
    let items = match reebe_feel::parse_and_evaluate(&mi.input_collection, &ctx).map(serde_json::Value::from) {
        Ok(serde_json::Value::Array(items)) => items,
        other => {
            let found = match other {
                Ok(v) => format!("'{v}'"),
                Err(e) => format!("an error ({e})"),
            };
            writers.commands.push(CommandToWrite {
                value_type: "INCIDENT".to_string(),
                intent: "CREATE".to_string(),
                key: 0,
                payload: serde_json::json!({
                    "errorType": "EXTRACT_VALUE_ERROR",
                    "errorMessage": format!(
                        "Expected the inputCollection '{}' of multi-instance '{}' to evaluate to an array, but found {found}",
                        mi.input_collection, at.element_id,
                    ),
                    "processInstanceKey": at.process_instance_key.to_string(),
                    "elementInstanceKey": body.key.to_string(),
                    "bpmnProcessId": at.bpmn_process_id,
                    "tenantId": at.tenant_id,
                }),
            });
            return Ok(body.key);
        }
    };

    state.backend.update_element_instance_state(body.key, "ACTIVATED").await?;
    writers.events.push(element_event(&body, "ELEMENT_ACTIVATED"));
    let body = ElementInstance { state: "ACTIVATED".to_string(), ..body };

    let n = items.len();
    scope::set_local(state, at.process_instance_key, body.key, ITEMS, serde_json::Value::Array(items), at.tenant_id).await?;
    if let Some(name) = &mi.output_collection {
        let empty = serde_json::Value::Array(vec![serde_json::Value::Null; n]);
        scope::set_local(state, at.process_instance_key, body.key, name, empty, at.tenant_id).await?;
    }
    arm_boundary_events(state, writers, process, &body).await?;

    if n == 0 {
        // An empty collection skips the activity.
        complete_body(writers, &body);
    } else {
        let first = if mi.is_sequential { 1 } else { n };
        for loop_counter in 1..=first {
            activate_inner(writers, &body, loop_counter as i64);
        }
    }
    Ok(body.key)
}

fn activate_inner(writers: &mut Writers, body: &ElementInstance, loop_counter: i64) {
    writers.commands.push(CommandToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "ACTIVATE_ELEMENT".to_string(),
        key: body.process_instance_key,
        payload: serde_json::json!({
            "processInstanceKey": body.process_instance_key.to_string(),
            "processDefinitionKey": body.process_definition_key.to_string(),
            "bpmnProcessId": body.bpmn_process_id,
            "elementId": body.element_id,
            "flowScopeKey": body.key.to_string(),
            "loopCounter": loop_counter,
            "tenantId": body.tenant_id,
        }),
    });
}

fn complete_body(writers: &mut Writers, body: &ElementInstance) {
    writers.commands.push(CommandToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "COMPLETE_ELEMENT".to_string(),
        key: body.key,
        payload: serde_json::json!({
            "elementInstanceKey": body.key.to_string(),
            "processInstanceKey": body.process_instance_key.to_string(),
            "processDefinitionKey": body.process_definition_key.to_string(),
            "elementId": body.element_id,
            "elementType": BODY,
            "bpmnProcessId": body.bpmn_process_id,
            "flowScopeKey": body.flow_scope_key.unwrap_or(body.process_instance_key).to_string(),
            "tenantId": body.tenant_id,
        }),
    });
}

/// Set the local variables of an inner instance before its input mappings run.
pub(crate) async fn init_inner(
    state: &EngineState,
    mi: &MultiInstanceLoopCharacteristics,
    inner: &ElementInstance,
    body_key: i64,
    loop_counter: i64,
) -> EngineResult<()> {
    let pi = inner.process_instance_key;
    let tenant = inner.tenant_id.as_str();
    scope::set_local(state, pi, inner.key, "loopCounter", serde_json::json!(loop_counter), tenant).await?;
    if let Some(name) = &mi.input_element {
        let item = state.backend
            .get_variables_by_scope(body_key)
            .await?
            .into_iter()
            .find(|v| v.name == ITEMS)
            .and_then(|v| v.value.as_array().and_then(|a| a.get((loop_counter - 1) as usize).cloned()))
            .unwrap_or(serde_json::Value::Null);
        scope::set_local(state, pi, inner.key, name, item, tenant).await?;
    }
    // An outputElement that names a variable makes that variable local to the
    // instance, so each instance's result stays its own.
    if let Some(name) = mi.output_element.as_deref().and_then(plain_variable) {
        if Some(name) != mi.input_element.as_deref() {
            scope::set_local(state, pi, inner.key, name, serde_json::Value::Null, tenant).await?;
        }
    }
    Ok(())
}

/// `=name` → `name`, when the expression only reads a variable.
fn plain_variable(expression: &str) -> Option<&str> {
    let name = expression.trim().strip_prefix('=')?.trim();
    let mut chars = name.chars();
    let first = chars.next()?;
    ((first.is_alphabetic() || first == '_') && chars.all(|c| c.is_alphanumeric() || c == '_'))
        .then_some(name)
}

/// An inner instance is completing: collect its output, then evaluate the completion
/// condition as if the inner instance had completed. As in Zeebe, where this is the
/// multi-instance body's `beforeExecutionPathCompleted`, a condition that does not
/// evaluate to a boolean is `Err` with the `EXTRACT_VALUE_ERROR` incident message, and
/// the inner instance stays completing until the incident is resolved.
pub(crate) async fn inner_completing(
    state: &EngineState,
    mi: &MultiInstanceLoopCharacteristics,
    inner: &ElementInstance,
    body: &ElementInstance,
) -> EngineResult<Result<bool, String>> {
    let pi = inner.process_instance_key;
    let loop_counter = loop_counter(state, inner).await;

    if let Some(collection) = &mi.output_collection {
        let ctx = scope::feel_context(state, pi, inner.key).await;
        let value = mi
            .output_element
            .as_deref()
            .and_then(|expr| reebe_feel::parse_and_evaluate(expr, &ctx).ok())
            .map(serde_json::Value::from)
            .unwrap_or(serde_json::Value::Null);
        let body_vars = state.backend.get_variables_by_scope(body.key).await?;
        let mut outputs = body_vars
            .iter()
            .find(|v| &v.name == collection)
            .and_then(|v| v.value.as_array().cloned())
            .unwrap_or_default();
        let index = (loop_counter - 1) as usize;
        if outputs.len() <= index {
            outputs.resize(index + 1, serde_json::Value::Null);
        }
        outputs[index] = value;
        scope::set_local(state, pi, body.key, collection, serde_json::Value::Array(outputs), &body.tenant_id).await?;
    }

    let Some(expr) = mi.completion_condition.as_deref().filter(|e| !e.trim().is_empty()) else {
        return Ok(Ok(false));
    };
    let items = item_count(state, body).await?;
    let siblings = siblings(state, body).await?;
    let completed = siblings.iter().filter(|e| e.state == "COMPLETED" || e.key == inner.key).count();
    let terminated = siblings.iter().filter(|e| e.state == "TERMINATED").count();
    let active = siblings
        .iter()
        .filter(|e| e.key != inner.key && !matches!(e.state.as_str(), "COMPLETED" | "TERMINATED"))
        .count();
    let mut vars = scope::visible_variables(state, pi, inner.key).await;
    let created = if mi.is_sequential { loop_counter } else { items };
    vars.insert("numberOfInstances".into(), serde_json::json!(created));
    vars.insert("numberOfActiveInstances".into(), serde_json::json!(active));
    vars.insert("numberOfCompletedInstances".into(), serde_json::json!(completed));
    vars.insert("numberOfTerminatedInstances".into(), serde_json::json!(terminated));
    let ctx = reebe_feel::FeelContext::from_json(serde_json::Value::Object(vars));
    Ok(super::bpmn_element::eval_boolean(expr, &ctx))
}

/// An inner instance completed: start the next instance, or complete the body when all
/// are done or the completion condition held (`condition_met`, from [`inner_completing`]).
pub(crate) async fn inner_completed(
    state: &EngineState,
    writers: &mut Writers,
    mi: &MultiInstanceLoopCharacteristics,
    inner: &ElementInstance,
    body: &ElementInstance,
    condition_met: bool,
) -> EngineResult<()> {
    let loop_counter = loop_counter(state, inner).await;
    let items = item_count(state, body).await?;
    let siblings = siblings(state, body).await?;
    let active: Vec<&ElementInstance> = siblings
        .iter()
        .filter(|e| !matches!(e.state.as_str(), "COMPLETED" | "TERMINATED"))
        .collect();

    if condition_met {
        for sibling in active {
            terminate_subtree(state, writers, sibling).await?;
        }
        complete_body(writers, body);
    } else if mi.is_sequential && loop_counter < items {
        activate_inner(writers, body, loop_counter + 1);
    } else if active.is_empty() {
        complete_body(writers, body);
    }
    Ok(())
}

async fn loop_counter(state: &EngineState, inner: &ElementInstance) -> i64 {
    state.backend
        .get_variables_by_scope(inner.key)
        .await
        .unwrap_or_default()
        .into_iter()
        .find(|v| v.name == "loopCounter")
        .and_then(|v| v.value.as_i64())
        .unwrap_or(1)
}

async fn item_count(state: &EngineState, body: &ElementInstance) -> EngineResult<i64> {
    Ok(state.backend
        .get_variables_by_scope(body.key)
        .await?
        .into_iter()
        .find(|v| v.name == ITEMS)
        .and_then(|v| v.value.as_array().map(|a| a.len()))
        .unwrap_or(0) as i64)
}

/// The inner instances of the body.
async fn siblings(state: &EngineState, body: &ElementInstance) -> EngineResult<Vec<ElementInstance>> {
    Ok(state.backend
        .get_element_instances_by_process_instance(body.process_instance_key)
        .await?
        .into_iter()
        .filter(|e| e.flow_scope_key == Some(body.key) && e.element_id == body.element_id)
        .collect())
}

/// The body completed: hand its output collection to the enclosing scope.
pub(crate) async fn body_completed(
    state: &EngineState,
    mi: &MultiInstanceLoopCharacteristics,
    body: &ElementInstance,
) -> EngineResult<()> {
    let Some(collection) = &mi.output_collection else { return Ok(()) };
    let Some(value) = state.backend
        .get_variables_by_scope(body.key)
        .await?
        .into_iter()
        .find(|v| &v.name == collection)
        .map(|v| v.value)
    else {
        return Ok(());
    };
    let mut vars = serde_json::Map::new();
    vars.insert(collection.clone(), value);
    let parent = body.flow_scope_key.unwrap_or(body.process_instance_key);
    scope::propagate(state, body.process_instance_key, parent, &vars, &body.tenant_id).await
}

fn element_event(ei: &ElementInstance, intent: &str) -> EventToWrite {
    EventToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: intent.to_string(),
        key: ei.key,
        payload: serde_json::json!({
            "elementInstanceKey": ei.key.to_string(),
            "processInstanceKey": ei.process_instance_key.to_string(),
            "processDefinitionKey": ei.process_definition_key.to_string(),
            "elementId": ei.element_id,
            "elementType": ei.element_type,
            "bpmnProcessId": ei.bpmn_process_id,
            "tenantId": ei.tenant_id,
        }),
    }
}
