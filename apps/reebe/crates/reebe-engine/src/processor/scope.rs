//! Variable scopes.
//!
//! Every element instance can hold local variables (its input mappings, a
//! multi-instance `inputElement` and `loopCounter`); the process instance holds
//! the rest. An expression sees its own scope and every enclosing one, the inner
//! scope winning. A variable set from inside a scope updates the nearest scope
//! that already has it and otherwise lands on the process instance, as Zeebe
//! propagates variables.

use std::sync::Arc;
use reebe_db::state::variables::Variable;
use crate::engine::EngineState;
use crate::error::EngineResult;
use crate::key_gen::KeyGenerator;

/// Scope keys from `scope_key` outwards: the element instances that enclose it
/// (itself included), then the process instance.
pub(crate) async fn scope_chain(state: &EngineState, process_instance_key: i64, scope_key: i64) -> Vec<i64> {
    let mut chain = Vec::new();
    let mut key = scope_key;
    while key != process_instance_key {
        let Ok(ei) = state.backend.get_element_instance_by_key(key).await else { break };
        if ei.element_type == "PROCESS" {
            break;
        }
        chain.push(key);
        match ei.flow_scope_key {
            Some(parent) => key = parent,
            None => break,
        }
    }
    chain.push(process_instance_key);
    chain
}

/// The variables visible in `scope_key`, as a JSON object.
pub(crate) async fn visible_variables(
    state: &EngineState,
    process_instance_key: i64,
    scope_key: i64,
) -> serde_json::Map<String, serde_json::Value> {
    let chain = scope_chain(state, process_instance_key, scope_key).await;
    let mut map = serde_json::Map::new();
    for key in chain.iter().rev() {
        for v in state.backend.get_variables_by_scope(*key).await.unwrap_or_default() {
            map.insert(v.name, v.value);
        }
    }
    map
}

/// A FEEL context of the variables visible in `scope_key`.
pub(crate) async fn feel_context(
    state: &EngineState,
    process_instance_key: i64,
    scope_key: i64,
) -> reebe_feel::FeelContext {
    let map = visible_variables(state, process_instance_key, scope_key).await;
    reebe_feel::FeelContext::from_json(serde_json::Value::Object(map))
}

/// Set a variable local to `scope_key`.
pub(crate) async fn set_local(
    state: &EngineState,
    process_instance_key: i64,
    scope_key: i64,
    name: &str,
    value: serde_json::Value,
    tenant_id: &str,
) -> EngineResult<()> {
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    state.backend.upsert_variable(&Variable {
        key: key_gen.next_key().await?,
        partition_id: state.partition_id,
        name: name.to_string(),
        value,
        scope_key,
        process_instance_key,
        tenant_id: tenant_id.to_string(),
        is_preview: false,
    }).await?;
    Ok(())
}

/// Set `variables` from `scope_key`: each goes to the nearest scope that already
/// has a variable of that name, or to the process instance.
pub(crate) async fn propagate(
    state: &EngineState,
    process_instance_key: i64,
    scope_key: i64,
    variables: &serde_json::Map<String, serde_json::Value>,
    tenant_id: &str,
) -> EngineResult<()> {
    if variables.is_empty() {
        return Ok(());
    }
    let chain = scope_chain(state, process_instance_key, scope_key).await;
    let mut names_by_scope = Vec::with_capacity(chain.len());
    for key in &chain {
        let names: std::collections::HashSet<String> = state.backend
            .get_variables_by_scope(*key)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|v| v.name)
            .collect();
        names_by_scope.push((*key, names));
    }
    for (name, value) in variables {
        let target = names_by_scope
            .iter()
            .find(|(_, names)| names.contains(name))
            .map(|(key, _)| *key)
            .unwrap_or(process_instance_key);
        set_local(state, process_instance_key, target, name, value.clone(), tenant_id).await?;
    }
    Ok(())
}
