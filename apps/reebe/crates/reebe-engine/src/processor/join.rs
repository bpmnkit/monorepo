//! Joining parallel and inclusive gateways.
//!
//! A token that reaches a gateway with several incoming sequence flows waits there,
//! counted per flow scope, gateway and incoming sequence flow, as Zeebe counts taken
//! sequence flows. A waiting token is active in its flow scope: the scope does not
//! complete while one waits.
//!
//! - A parallel join activates once every incoming flow has a token.
//! - An inclusive join activates once every incoming flow either has a token or can
//!   no longer be reached in the flow scope. A flow can be reached if a path of
//!   sequence flows leads to it from an active element instance of the scope, from
//!   an element a token is on its way to (a pending activation), or from another
//!   join of the scope with a waiting token. Boundary events of the elements on the
//!   way count as paths. A path does not lead through the join itself.
//!
//! One activation consumes one token of each incoming flow that has one. An
//! inclusive join is evaluated when a token reaches it, and again whenever an
//! element of its flow scope completes, since that may leave the untaken flows
//! out of reach. A path follows a link throw event to its link catch event.

use std::collections::HashSet;
use reebe_bpmn::{BpmnProcess, FlowElement, Gateway};
use reebe_db::state::gateway_tokens::JoinToken;
use crate::engine::EngineState;
use crate::error::EngineResult;
use super::catch_event::boundary_events;
use super::{CommandToWrite, Writers};

/// The gateway, if `element` is a joining gateway, and whether it is inclusive.
pub(crate) fn joining_gateway(element: &FlowElement) -> Option<(&Gateway, bool)> {
    match element {
        FlowElement::ParallelGateway(gw) if gw.incoming.len() > 1 => Some((gw, false)),
        FlowElement::InclusiveGateway(gw) if gw.incoming.len() > 1 => Some((gw, true)),
        _ => None,
    }
}

/// Where a joining gateway is evaluated.
pub(crate) struct JoinScope<'a> {
    pub process: &'a BpmnProcess,
    pub process_instance_key: i64,
    pub flow_scope_key: i64,
    /// The command being processed; later commands are still pending.
    pub position: i64,
}

async fn tokens_at(state: &EngineState, at: &JoinScope<'_>, gateway_id: &str) -> EngineResult<Vec<JoinToken>> {
    Ok(state.backend
        .get_join_tokens(at.process_instance_key)
        .await?
        .into_iter()
        .filter(|t| t.flow_scope_key == at.flow_scope_key && t.gateway_id == gateway_id)
        .collect())
}

/// A token arrived at the joining gateway `gw` on `arrived_on`, or (`None`) the
/// gateway is re-evaluated. Returns whether it activates now; if so, its tokens
/// have been consumed.
pub(crate) async fn arrive(
    state: &EngineState,
    writers: &Writers,
    at: &JoinScope<'_>,
    gw: &Gateway,
    inclusive: bool,
    arrived_on: Option<&str>,
) -> EngineResult<bool> {
    if let Some(flow) = arrived_on {
        state.backend.add_join_token(at.process_instance_key, at.flow_scope_key, &gw.id, flow).await?;
    }
    let tokens = tokens_at(state, at, &gw.id).await?;
    if !ready(state, writers, at, gw, inclusive, &tokens).await? {
        return Ok(false);
    }
    for token in &tokens {
        state.backend.take_join_token(at.flow_scope_key, &gw.id, &token.sequence_flow_id).await?;
    }
    Ok(true)
}

async fn ready(
    state: &EngineState,
    writers: &Writers,
    at: &JoinScope<'_>,
    gw: &Gateway,
    inclusive: bool,
    tokens: &[JoinToken],
) -> EngineResult<bool> {
    if tokens.is_empty() {
        return Ok(false);
    }
    let untaken: Vec<&str> = gw.incoming
        .iter()
        .map(String::as_str)
        .filter(|flow| !tokens.iter().any(|t| t.sequence_flow_id == *flow))
        .collect();
    if untaken.is_empty() {
        return Ok(true);
    }
    Ok(inclusive && !can_still_be_reached(state, writers, at, gw, &untaken).await?)
}

/// The sequence flow a token that reached `gw` came by. A command written before
/// tokens carried their flow names none: it takes the first flow without a token.
pub(crate) async fn arrived_on(
    state: &EngineState,
    at: &JoinScope<'_>,
    gw: &Gateway,
    payload: &serde_json::Value,
) -> EngineResult<Option<String>> {
    if payload["joinCheck"].as_bool() == Some(true) {
        return Ok(None);
    }
    if let Some(flow) = payload["sequenceFlowId"].as_str() {
        return Ok(Some(flow.to_string()));
    }
    let tokens = tokens_at(state, at, &gw.id).await?;
    Ok(gw.incoming
        .iter()
        .find(|flow| !tokens.iter().any(|t| &t.sequence_flow_id == *flow))
        .or(gw.incoming.first())
        .cloned())
}

/// Whether a token in the flow scope can still reach one of the `untaken` incoming
/// flows of `gw`.
async fn can_still_be_reached(
    state: &EngineState,
    writers: &Writers,
    at: &JoinScope<'_>,
    gw: &Gateway,
    untaken: &[&str],
) -> EngineResult<bool> {
    let mut sources: Vec<String> = state.backend
        .get_element_instances_by_process_instance(at.process_instance_key)
        .await?
        .into_iter()
        .filter(|ei| {
            ei.flow_scope_key == Some(at.flow_scope_key)
                && !matches!(ei.state.as_str(), "COMPLETED" | "TERMINATED")
                && ei.element_id != gw.id
        })
        .map(|ei| ei.element_id)
        .collect();
    sources.extend(
        state.backend
            .get_join_tokens(at.process_instance_key)
            .await?
            .into_iter()
            .filter(|t| t.flow_scope_key == at.flow_scope_key && t.gateway_id != gw.id)
            .map(|t| t.gateway_id),
    );

    let scope_text = at.flow_scope_key.to_string();
    let mut pending: Vec<serde_json::Value> = writers.commands
        .iter()
        .filter(|c| c.intent == "ACTIVATE_ELEMENT" && c.payload["flowScopeKey"].as_str() == Some(scope_text.as_str()))
        .map(|c| c.payload.clone())
        .collect();
    pending.extend(
        state.backend
            .get_pending_activations(state.partition_id, at.position, &scope_text)
            .await?,
    );
    for payload in &pending {
        let Some(target) = payload["elementId"].as_str() else { continue };
        if target == gw.id {
            // A token on its way to the join itself.
            if payload["sequenceFlowId"].as_str().is_some_and(|f| untaken.contains(&f)) {
                return Ok(true);
            }
            continue;
        }
        sources.push(target.to_string());
    }

    let mut seen = HashSet::new();
    while let Some(id) = sources.pop() {
        if !seen.insert(id.clone()) {
            continue;
        }
        for flow in at.process.outgoing_flows_recursive(&id) {
            if flow.target_ref == gw.id {
                if untaken.contains(&flow.id.as_str()) {
                    return Ok(true);
                }
            } else {
                sources.push(flow.target_ref.clone());
            }
        }
        // A link throw event continues at its link catch event.
        if let Some(catch) = at.process.link_catch_event(&id) {
            sources.push(catch.to_string());
        }
        let mut boundaries = Vec::new();
        boundary_events(&at.process.elements, &id, &mut boundaries);
        sources.extend(boundaries.into_iter().map(|be| be.id.clone()));
    }
    Ok(false)
}

/// An element of the flow scope completed: an inclusive join of the scope whose
/// untaken flows can no longer be reached activates.
pub(crate) async fn reevaluate_inclusive_joins(
    state: &EngineState,
    writers: &mut Writers,
    at: &JoinScope<'_>,
    context: &serde_json::Value,
) -> EngineResult<()> {
    let mut gateway_ids: Vec<String> = state.backend
        .get_join_tokens(at.process_instance_key)
        .await?
        .into_iter()
        .filter(|t| t.flow_scope_key == at.flow_scope_key)
        .map(|t| t.gateway_id)
        .collect();
    gateway_ids.sort();
    gateway_ids.dedup();
    for gateway_id in gateway_ids {
        let Some((gw, true)) = at.process.get_element_recursive(&gateway_id).and_then(joining_gateway) else {
            continue;
        };
        let tokens = tokens_at(state, at, &gateway_id).await?;
        if ready(state, writers, at, gw, true, &tokens).await? {
            let mut payload = context.clone();
            payload["elementId"] = serde_json::json!(gateway_id);
            payload["flowScopeKey"] = serde_json::json!(at.flow_scope_key.to_string());
            payload["joinCheck"] = serde_json::json!(true);
            writers.commands.push(CommandToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "ACTIVATE_ELEMENT".to_string(),
                key: at.process_instance_key,
                payload,
            });
        }
    }
    Ok(())
}

/// Whether the process has an inclusive join anywhere.
pub(crate) fn has_inclusive_join(process: &BpmnProcess) -> bool {
    fn any(elements: &std::collections::HashMap<String, FlowElement>) -> bool {
        elements.values().any(|el| match el {
            FlowElement::SubProcess(sp) => any(&sp.elements),
            el => matches!(joining_gateway(el), Some((_, true))),
        })
    }
    any(&process.elements)
}
