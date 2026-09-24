//! Propagation of thrown BPMN errors and escalations to their catch events.
//!
//! One path serves every thrower: a job worker's `THROW_ERROR`, an error end
//! event, and an escalation end or intermediate throw event. As in Zeebe, the
//! catcher is looked up from the thrower outwards: a boundary event attached to
//! the element, then an event sub-process of its flow scope, then a boundary
//! event on that scope, and so on — through call activities into the calling
//! process. An interrupting catch terminates the scope it interrupts.
//!
//! An uncaught error raises an `UNHANDLED_ERROR_EVENT` incident on the thrower.
//! An uncaught escalation is not a failure: the thrower simply carries on.

use std::collections::HashMap;
use std::sync::Arc;
use reebe_bpmn::{BpmnProcess, EventDefinition, FlowElement};
use reebe_db::state::element_instances::ElementInstance;
use reebe_db::state::incidents::Incident;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{CommandToWrite, EventToWrite, Writers};

/// What was thrown.
pub(crate) enum Thrown {
    Error { code: String, message: Option<String> },
    Escalation { code: String },
}

impl Thrown {
    /// What an end or intermediate throw event with this definition throws, if anything.
    pub(crate) fn from_definition(def: Option<&EventDefinition>) -> Option<Thrown> {
        match def {
            Some(EventDefinition::Error(d)) => Some(Thrown::Error {
                code: d.error_code.clone().unwrap_or_default(),
                message: None,
            }),
            Some(EventDefinition::Escalation(d)) => Some(Thrown::Escalation {
                code: d.escalation_code.clone().unwrap_or_default(),
            }),
            _ => None,
        }
    }

    fn code(&self) -> &str {
        match self {
            Thrown::Error { code, .. } | Thrown::Escalation { code } => code,
        }
    }

    /// Whether a catch event definition catches this. A catch event without a
    /// code catches every error (or escalation).
    fn caught_by(&self, def: Option<&EventDefinition>) -> bool {
        let catch_code = match (self, def) {
            (Thrown::Error { .. }, Some(EventDefinition::Error(d))) => d.error_code.as_deref(),
            (Thrown::Escalation { .. }, Some(EventDefinition::Escalation(d))) => {
                d.escalation_code.as_deref()
            }
            _ => return false,
        };
        catch_code.map_or(true, |c| c.is_empty() || c == self.code())
    }

    fn variables(&self) -> serde_json::Value {
        match self {
            Thrown::Error { code, message } => {
                serde_json::json!({ "errorCode": code, "errorMessage": message })
            }
            Thrown::Escalation { code } => serde_json::json!({ "escalationCode": code }),
        }
    }
}

/// How a throw ended.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum ThrowOutcome {
    /// A catch event took it. `interrupted` says whether the thrower was terminated
    /// with the scope that caught it.
    Caught { interrupted: bool },
    /// Nothing caught it. For an error, an incident was raised on the thrower.
    Uncaught,
}

/// Throw `thrown` from `thrower` and hand it to the nearest matching catch event.
/// `job_key` links the incident of an uncaught error to the job that threw it.
pub(crate) async fn throw_event(
    state: &EngineState,
    writers: &mut Writers,
    thrower: &ElementInstance,
    thrown: &Thrown,
    job_key: Option<i64>,
) -> EngineResult<ThrowOutcome> {
    // Child process instances the throw has left on its way up, terminated if it is
    // caught in a calling process.
    let mut left_instances: Vec<i64> = Vec::new();
    let mut current = thrower.clone();

    loop {
        let process = load_process(state, current.process_definition_key, &current.bpmn_process_id).await?;

        if current.element_type != "PROCESS" {
            // 1. A boundary event attached to the current element.
            if let Some(be) = find_boundary(&process.elements, &current.element_id, thrown) {
                let interrupting = be.1 || matches!(thrown, Thrown::Error { .. });
                if interrupting {
                    for pi_key in &left_instances {
                        terminate_process_instance(state, writers, *pi_key).await?;
                    }
                    terminate_subtree(state, writers, &current).await?;
                }
                let scope_key = current.flow_scope_key.unwrap_or(current.process_instance_key);
                activate(writers, &current, &be.0, scope_key, thrown);
                return Ok(ThrowOutcome::Caught { interrupted: interrupting });
            }

            // 2. Move to the flow scope and look for an event sub-process in it.
            let scope_key = current.flow_scope_key.unwrap_or(current.process_instance_key);
            let scope = state.backend.get_element_instance_by_key(scope_key).await?;
            let scope_elements = if scope.element_type == "PROCESS" {
                Some(&process.elements)
            } else {
                match process.get_element_recursive(&scope.element_id) {
                    Some(FlowElement::SubProcess(sp)) => Some(&sp.elements),
                    _ => None,
                }
            };
            if let Some((esp_id, interrupting)) =
                scope_elements.and_then(|els| find_event_subprocess(els, thrown))
            {
                if interrupting {
                    for pi_key in &left_instances {
                        terminate_process_instance(state, writers, *pi_key).await?;
                    }
                    terminate_children(state, writers, &scope).await?;
                }
                activate(writers, &scope, &esp_id, scope.key, thrown);
                return Ok(ThrowOutcome::Caught { interrupted: interrupting });
            }
            current = scope;
            continue;
        }

        // 3. The process scope: continue in the calling process, if any.
        let pi = state.backend.get_process_instance_by_key(current.process_instance_key).await?;
        match pi.parent_element_instance_key {
            Some(call_ei_key) => {
                left_instances.push(pi.key);
                current = state.backend.get_element_instance_by_key(call_ei_key).await?;
            }
            None => break,
        }
    }

    if let Thrown::Error { code, message } = thrown {
        raise_unhandled_error_incident(state, writers, thrower, code, message.as_deref(), job_key)
            .await?;
    }
    Ok(ThrowOutcome::Uncaught)
}

async fn load_process(
    state: &EngineState,
    process_definition_key: i64,
    bpmn_process_id: &str,
) -> EngineResult<BpmnProcess> {
    let pd = state.backend.get_process_definition_by_key(process_definition_key).await?;
    reebe_bpmn::parse_bpmn(&pd.bpmn_xml)
        .map_err(|e| EngineError::BpmnParse(e.to_string()))?
        .into_iter()
        .find(|p| p.id == bpmn_process_id || p.id == pd.bpmn_process_id)
        .ok_or_else(|| EngineError::NotFound(format!("Process {bpmn_process_id}")))
}

/// The id of a catching boundary event attached to `attached_to`, and whether it
/// cancels the activity.
fn find_boundary(
    elements: &HashMap<String, FlowElement>,
    attached_to: &str,
    thrown: &Thrown,
) -> Option<(String, bool)> {
    for el in elements.values() {
        match el {
            FlowElement::BoundaryEvent(be)
                if be.attached_to_ref == attached_to && thrown.caught_by(be.event_definition.as_ref()) =>
            {
                return Some((be.id.clone(), be.cancel_activity));
            }
            FlowElement::SubProcess(sp) => {
                if let Some(found) = find_boundary(&sp.elements, attached_to, thrown) {
                    return Some(found);
                }
            }
            _ => {}
        }
    }
    None
}

/// The id of an event sub-process directly inside `elements` whose start event
/// catches `thrown`, and whether that start event interrupts.
fn find_event_subprocess(
    elements: &HashMap<String, FlowElement>,
    thrown: &Thrown,
) -> Option<(String, bool)> {
    elements.values().find_map(|el| match el {
        FlowElement::SubProcess(sp) if sp.triggered_by_event => {
            sp.start_events.iter().find_map(|id| match sp.elements.get(id) {
                Some(FlowElement::StartEvent(se)) if thrown.caught_by(se.event_definition.as_ref()) => {
                    Some((sp.id.clone(), se.interrupting))
                }
                _ => None,
            })
        }
        _ => None,
    })
}

fn activate(
    writers: &mut Writers,
    context: &ElementInstance,
    element_id: &str,
    flow_scope_key: i64,
    thrown: &Thrown,
) {
    writers.commands.push(CommandToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "ACTIVATE_ELEMENT".to_string(),
        key: context.process_instance_key,
        payload: serde_json::json!({
            "processInstanceKey": context.process_instance_key.to_string(),
            "processDefinitionKey": context.process_definition_key.to_string(),
            "bpmnProcessId": context.bpmn_process_id,
            "elementId": element_id,
            "flowScopeKey": flow_scope_key.to_string(),
            "variables": thrown.variables(),
            "tenantId": context.tenant_id,
        }),
    });
}

/// Whether the element instance a JOB or USER_TASK command names has been terminated.
pub(crate) async fn element_was_terminated(state: &EngineState, payload: &serde_json::Value) -> bool {
    let key = payload["elementInstanceKey"]
        .as_str()
        .and_then(|s| s.parse::<i64>().ok())
        .or_else(|| payload["elementInstanceKey"].as_i64());
    match key {
        Some(key) => state.backend
            .get_element_instance_by_key(key)
            .await
            .is_ok_and(|ei| ei.state == "TERMINATED"),
        None => false,
    }
}

fn is_active(ei: &ElementInstance) -> bool {
    !matches!(ei.state.as_str(), "COMPLETED" | "TERMINATED")
}

/// Terminate `ei` and everything running inside it.
pub(crate) async fn terminate_subtree(
    state: &EngineState,
    writers: &mut Writers,
    ei: &ElementInstance,
) -> EngineResult<()> {
    terminate_children(state, writers, ei).await?;
    terminate_one(state, writers, ei).await
}

/// Terminate everything running inside `scope`, but not `scope` itself.
async fn terminate_children(
    state: &EngineState,
    writers: &mut Writers,
    scope: &ElementInstance,
) -> EngineResult<()> {
    let all = state.backend
        .get_element_instances_by_process_instance(scope.process_instance_key)
        .await?;
    let mut stack = vec![scope.key];
    let mut doomed = Vec::new();
    while let Some(scope_key) = stack.pop() {
        for child in all.iter().filter(|c| {
            c.key != scope_key && c.flow_scope_key == Some(scope_key) && is_active(c)
        }) {
            stack.push(child.key);
            doomed.push(child);
        }
    }
    // Innermost first, as Zeebe terminates a scope after its children.
    for child in doomed.into_iter().rev() {
        terminate_one(state, writers, child).await?;
    }
    Ok(())
}

async fn terminate_one(
    state: &EngineState,
    writers: &mut Writers,
    ei: &ElementInstance,
) -> EngineResult<()> {
    state.backend.update_element_instance_state(ei.key, "TERMINATED").await?;
    super::catch_event::close_waits(state, ei.key).await?;
    // A terminated call activity takes the process instance it called with it.
    if ei.element_type == "CALL_ACTIVITY" {
        for child in state.backend.get_child_process_instance_keys(ei.key).await? {
            Box::pin(terminate_process_instance(state, writers, child)).await?;
        }
    }
    writers.events.push(EventToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "ELEMENT_TERMINATED".to_string(),
        key: ei.key,
        payload: serde_json::json!({
            "elementInstanceKey": ei.key.to_string(),
            "processInstanceKey": ei.process_instance_key.to_string(),
            "elementId": ei.element_id,
            "elementType": ei.element_type,
            "bpmnProcessId": ei.bpmn_process_id,
            "tenantId": ei.tenant_id,
        }),
    });
    Ok(())
}

/// Terminate a called process instance whose error its caller caught.
async fn terminate_process_instance(
    state: &EngineState,
    writers: &mut Writers,
    process_instance_key: i64,
) -> EngineResult<()> {
    let root = state.backend
        .get_element_instances_by_process_instance(process_instance_key)
        .await?
        .into_iter()
        .find(|ei| ei.element_type == "PROCESS")
        .ok_or_else(|| EngineError::NotFound(format!("Process element of instance {process_instance_key}")))?;
    terminate_subtree(state, writers, &root).await?;
    state.backend
        .update_process_instance_state(process_instance_key, "TERMINATED", Some(state.clock.now()))
        .await?;
    Ok(())
}

async fn raise_unhandled_error_incident(
    state: &EngineState,
    writers: &mut Writers,
    thrower: &ElementInstance,
    code: &str,
    message: Option<&str>,
    job_key: Option<i64>,
) -> EngineResult<()> {
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    let incident_key = key_gen.next_key().await?;
    let error_message = format!(
        "Expected to throw an error event with the code '{code}'{}, but it was not caught. \
         No error events are available in the scope.",
        message.map(|m| format!(" with message '{m}'")).unwrap_or_default(),
    );
    state.backend.insert_incident(&Incident {
        key: incident_key,
        partition_id: state.partition_id,
        process_instance_key: thrower.process_instance_key,
        process_definition_key: thrower.process_definition_key,
        element_instance_key: thrower.key,
        element_id: thrower.element_id.clone(),
        error_type: "UNHANDLED_ERROR_EVENT".to_string(),
        error_message: Some(error_message.clone()),
        state: "ACTIVE".to_string(),
        job_key,
        created_at: state.clock.now(),
        resolved_at: None,
        tenant_id: thrower.tenant_id.clone(),
    }).await?;
    writers.events.push(EventToWrite {
        value_type: "INCIDENT".to_string(),
        intent: "CREATED".to_string(),
        key: incident_key,
        payload: serde_json::json!({
            "incidentKey": incident_key.to_string(),
            "jobKey": job_key.map(|k| k.to_string()),
            "processInstanceKey": thrower.process_instance_key.to_string(),
            "elementInstanceKey": thrower.key.to_string(),
            "elementId": thrower.element_id,
            "errorType": "UNHANDLED_ERROR_EVENT",
            "errorCode": code,
            "errorMessage": error_message,
            "tenantId": thrower.tenant_id,
        }),
    });
    Ok(())
}
