//! Ad-hoc sub-processes, as Zeebe runs them.
//!
//! Every activation of an inner element runs in an *inner instance* (element type
//! `AD_HOC_SUB_PROCESS_INNER_INSTANCE`, with the ad-hoc sub-process's id) between the
//! ad-hoc sub-process and the element. The inner instance holds the variables the
//! activation was given, and the variables its elements write stay in it. The
//! element's outgoing sequence flows are followed inside the inner instance, which
//! completes when nothing inside it is active any more. Only the elements without an
//! incoming sequence flow can be activated.
//!
//! An ad-hoc sub-process is run in one of two ways:
//!
//! - **By Zeebe (BPMN implementation).** On activation, `activeElementsCollection`
//!   is evaluated to the ids of the elements to activate; an empty list or no
//!   expression activates nothing, and the sub-process stays active. After each inner
//!   instance completes, `completionCondition` is evaluated; when it holds, the
//!   sub-process completes, first terminating the remaining inner instances if
//!   `cancelRemainingInstances` (the default) or else once they have completed. Without
//!   a completion condition, it completes once every activated element has completed.
//! - **By a job worker** (a `zeebe:taskDefinition`, e.g. the AI Agent Sub-process
//!   connector). Its job completes with an `adHocSubProcess` job result:
//!   `activateElements` (element ids, each with variables for its inner instance),
//!   `isCompletionConditionFulfilled` and `isCancelRemainingInstances`. When an inner
//!   instance completes, the job is created again, one job at a time. A job completed
//!   without activating elements or fulfilling the completion condition completes the
//!   sub-process, as before job results were supported.
//!
//! When an inner instance completes, `outputElement` is evaluated in it and appended to
//! the local `outputCollection`, which is propagated to the enclosing scope when the
//! ad-hoc sub-process completes.

use std::sync::Arc;
use reebe_bpmn::{BpmnProcess, FlowElement, SubProcess};
use reebe_db::state::element_instances::ElementInstance;
use reebe_db::state::jobs::Job;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::scope;
use super::throw_event::terminate_subtree;
use super::{CommandToWrite, EventToWrite, Writers};

pub(crate) const AD_HOC: &str = "AD_HOC_SUB_PROCESS";
pub(crate) const INNER: &str = "AD_HOC_SUB_PROCESS_INNER_INSTANCE";

/// Local variable of every ad-hoc sub-process describing the elements it can activate.
pub(crate) const ELEMENTS_VARIABLE: &str = "adHocSubProcessElements";

/// Local variable of the ad-hoc sub-process: the completion condition was fulfilled
/// without cancelling, and it completes once its inner instances have.
const COMPLETION_PENDING: &str = "__adHocCompletionPending";

/// The ids of the elements an ad-hoc sub-process can activate: its direct children
/// without an incoming sequence flow, other than events and event sub-processes.
pub(crate) fn activatable(sp: &SubProcess) -> Vec<&str> {
    let mut ids: Vec<&str> = sp.elements
        .values()
        .filter(|el| match el {
            FlowElement::StartEvent(_) | FlowElement::EndEvent(_) | FlowElement::BoundaryEvent(_) => false,
            FlowElement::SubProcess(inner) if inner.triggered_by_event => false,
            _ => true,
        })
        .map(|el| el.id())
        .filter(|id| !sp.sequence_flows.iter().any(|f| f.target_ref == *id))
        .collect();
    ids.sort();
    ids
}

/// The `adHocSubProcessElements` variable: each element the ad-hoc sub-process can
/// activate, in document order, with its name, documentation, `zeebe:properties` and
/// the `fromAi()` parameters of its input mappings. As in Zeebe, whose
/// `AdHocActivityMetadata` is `@JsonInclude(NON_EMPTY)`, a field that is null or empty
/// is left out, and a property with an empty value is `null`.
pub(crate) fn elements_variable(sp: &SubProcess) -> serde_json::Value {
    let allowed = activatable(sp);
    let mut ids: Vec<&str> = sp.element_order.iter().map(String::as_str).filter(|id| allowed.contains(id)).collect();
    if ids.len() != allowed.len() {
        ids = allowed;
    }
    let elements = ids.into_iter().filter_map(|id| sp.elements.get(id)).map(|el| {
        let details = sp.element_details.get(el.id()).cloned().unwrap_or_default();
        let properties: serde_json::Map<String, serde_json::Value> = details
            .properties
            .into_iter()
            .filter(|(name, _)| !name.is_empty())
            .map(|(name, value)| (name, if value.is_empty() { serde_json::Value::Null } else { value.into() }))
            .collect();
        let parameters: Vec<serde_json::Value> = super::bpmn_element::get_input_mappings(el)
            .iter()
            .flat_map(|mapping| reebe_feel::from_ai_parameters(&mapping.source))
            .collect();
        let mut element = serde_json::Map::new();
        element.insert("elementId".into(), el.id().into());
        if let Some(name) = el.name().filter(|name| !name.is_empty()) {
            element.insert("elementName".into(), name.into());
        }
        if let Some(documentation) = details.documentation.filter(|text| !text.is_empty()) {
            element.insert("documentation".into(), documentation.into());
        }
        if !properties.is_empty() {
            element.insert("properties".into(), properties.into());
        }
        if !parameters.is_empty() {
            element.insert("parameters".into(), parameters.into());
        }
        serde_json::Value::Object(element)
    });
    serde_json::Value::Array(elements.collect())
}

/// The element ids `activeElementsCollection` lists, evaluated in the ad-hoc
/// sub-process `ad_hoc_key`. `Err` is the incident message.
pub(crate) async fn active_elements(
    state: &EngineState,
    sp: &SubProcess,
    process_instance_key: i64,
    ad_hoc_key: i64,
) -> Result<Vec<String>, String> {
    let Some(expression) = &sp.active_elements_collection else { return Ok(Vec::new()) };
    let ctx = scope::feel_context(state, process_instance_key, ad_hoc_key).await;
    let value = reebe_feel::parse_and_evaluate(expression, &ctx)
        .map(serde_json::Value::from)
        .map_err(|e| format!("Failed to evaluate activeElementsCollection '{expression}': {e}"))?;
    let ids: Vec<String> = match &value {
        serde_json::Value::Null => return Ok(Vec::new()),
        serde_json::Value::Array(items) => items
            .iter()
            .map(|v| v.as_str().map(str::to_string))
            .collect::<Option<_>>()
            .ok_or_else(|| {
                format!("Expected activeElementsCollection '{expression}' to be a list of strings, but found '{value}'")
            })?,
        other => {
            return Err(format!(
                "Expected activeElementsCollection '{expression}' to be a list of strings, but found '{other}'"
            ))
        }
    };
    let allowed = activatable(sp);
    if let Some(unknown) = ids.iter().find(|id| !allowed.contains(&id.as_str())) {
        return Err(format!(
            "Expected to activate the element '{unknown}' of the ad-hoc sub-process '{}', but it is not an \
             element it can activate (activatable: {})",
            sp.id,
            allowed.join(", "),
        ));
    }
    Ok(ids)
}

/// Activate `element_id` in a new inner instance of `ad_hoc`, with `variables` local to it.
pub(crate) async fn activate_inner(
    state: &EngineState,
    writers: &mut Writers,
    ad_hoc: &ElementInstance,
    element_id: &str,
    variables: Option<&serde_json::Map<String, serde_json::Value>>,
) -> EngineResult<()> {
    let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
    let key = key_gen.next_key().await?;
    let inner = ElementInstance {
        key,
        element_type: INNER.to_string(),
        state: "ACTIVATED".to_string(),
        flow_scope_key: Some(ad_hoc.key),
        scope_key: Some(key),
        incident_key: None,
        ..ad_hoc.clone()
    };
    state.backend.insert_element_instance(&inner).await?;
    for intent in ["ELEMENT_ACTIVATING", "ELEMENT_ACTIVATED"] {
        writers.events.push(element_event(&inner, intent));
    }
    for (name, value) in variables.into_iter().flatten() {
        scope::set_local(state, inner.process_instance_key, key, name, value.clone(), &inner.tenant_id).await?;
    }
    writers.commands.push(CommandToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "ACTIVATE_ELEMENT".to_string(),
        key: inner.process_instance_key,
        payload: serde_json::json!({
            "processInstanceKey": inner.process_instance_key.to_string(),
            "processDefinitionKey": inner.process_definition_key.to_string(),
            "bpmnProcessId": inner.bpmn_process_id,
            "elementId": element_id,
            "flowScopeKey": key.to_string(),
            "tenantId": inner.tenant_id,
        }),
    });
    Ok(())
}

/// The ad-hoc sub-process activated: start its output collection, then create its
/// job or activate the elements `activeElementsCollection` listed.
pub(crate) async fn activated(
    state: &EngineState,
    writers: &mut Writers,
    sp: &SubProcess,
    ad_hoc: &ElementInstance,
    elements: &[String],
) -> EngineResult<()> {
    scope::set_local(state, ad_hoc.process_instance_key, ad_hoc.key, ELEMENTS_VARIABLE, elements_variable(sp), &ad_hoc.tenant_id).await?;
    if let Some(collection) = &sp.output_collection {
        scope::set_local(state, ad_hoc.process_instance_key, ad_hoc.key, collection, serde_json::json!([]), &ad_hoc.tenant_id).await?;
    }
    if sp.task_definition.is_some() {
        create_job(writers, sp, ad_hoc);
    }
    for id in elements {
        activate_inner(state, writers, ad_hoc, id, None).await?;
    }
    Ok(())
}

fn create_job(writers: &mut Writers, sp: &SubProcess, ad_hoc: &ElementInstance) {
    let Some(td) = &sp.task_definition else { return };
    writers.commands.push(CommandToWrite {
        value_type: "JOB".to_string(),
        intent: "CREATE".to_string(),
        key: 0,
        payload: serde_json::json!({
            "jobType": td.job_type,
            "processInstanceKey": ad_hoc.process_instance_key.to_string(),
            "elementInstanceKey": ad_hoc.key.to_string(),
            "processDefinitionKey": ad_hoc.process_definition_key.to_string(),
            "bpmnProcessId": ad_hoc.bpmn_process_id,
            "elementId": ad_hoc.element_id,
            "retries": 3,
            "customHeaders": {},
            "tenantId": ad_hoc.tenant_id,
        }),
    });
}

/// An `adHocSubProcess` job result that the ad-hoc sub-process acts on.
pub(crate) struct JobResult {
    activate: Vec<(String, Option<serde_json::Map<String, serde_json::Value>>)>,
    completion_fulfilled: bool,
    cancel_remaining: bool,
}

/// Read the result a job of an ad-hoc sub-process completed with. `None` when it
/// neither activates elements nor fulfils the completion condition: the job then
/// completes the sub-process. An invalid result rejects the job completion.
pub(crate) fn job_result(
    process: &BpmnProcess,
    job: &Job,
    result: Option<&serde_json::Value>,
) -> EngineResult<Option<JobResult>> {
    let Some(result) = result.filter(|r| r.is_object()) else { return Ok(None) };
    let activate: Vec<(String, Option<serde_json::Map<String, serde_json::Value>>)> = result["activateElements"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|a| (
            a["elementId"].as_str().unwrap_or_default().to_string(),
            a["variables"].as_object().cloned(),
        ))
        .collect();
    let completion_fulfilled = result["isCompletionConditionFulfilled"].as_bool() == Some(true);
    if activate.is_empty() && !completion_fulfilled {
        return Ok(None);
    }
    let reject = |why: String| {
        EngineError::InvalidState(format!(
            "Expected to complete the job with key '{}' of the ad-hoc sub-process '{}', but {why}",
            job.key, job.element_id,
        ))
    };
    if completion_fulfilled && !activate.is_empty() {
        return Err(reject("the job result both activates elements and fulfils the completion condition".into()));
    }
    let Some(FlowElement::SubProcess(sp)) = process.get_element_recursive(&job.element_id) else {
        return Err(reject("its element is not an ad-hoc sub-process".into()));
    };
    let allowed = activatable(sp);
    if let Some((unknown, _)) = activate.iter().find(|(id, _)| !allowed.contains(&id.as_str())) {
        return Err(reject(format!(
            "'{unknown}' is not an element it can activate (activatable: {})",
            allowed.join(", "),
        )));
    }
    Ok(Some(JobResult {
        activate,
        completion_fulfilled,
        cancel_remaining: result["isCancelRemainingInstances"].as_bool() == Some(true),
    }))
}

/// The job of an ad-hoc sub-process completed with a result it acts on: keep the
/// job's variables, activate the elements, and complete if the condition is fulfilled.
pub(crate) async fn apply_job_result(
    state: &EngineState,
    writers: &mut Writers,
    sp: &SubProcess,
    ad_hoc: &ElementInstance,
    variables: Option<&serde_json::Map<String, serde_json::Value>>,
    result: JobResult,
) -> EngineResult<()> {
    if let Some(vars) = variables {
        // With output mappings, the job's variables stay in the sub-process and the
        // mappings pick what leaves it.
        if sp.output_mappings.is_empty() {
            scope::propagate(state, ad_hoc.process_instance_key, ad_hoc.key, vars, &ad_hoc.tenant_id).await?;
        } else {
            for (name, value) in vars {
                scope::set_local(state, ad_hoc.process_instance_key, ad_hoc.key, name, value.clone(), &ad_hoc.tenant_id).await?;
            }
        }
    }
    for (id, vars) in &result.activate {
        activate_inner(state, writers, ad_hoc, id, vars.as_ref()).await?;
    }
    if result.completion_fulfilled {
        fulfil(state, writers, ad_hoc, result.cancel_remaining).await?;
    }
    Ok(())
}

/// The completion condition holds: complete now, terminating what is still active if
/// `cancel`, or once nothing is active any more.
async fn fulfil(state: &EngineState, writers: &mut Writers, ad_hoc: &ElementInstance, cancel: bool) -> EngineResult<()> {
    let active = active_children(state, ad_hoc).await?;
    if cancel || active.is_empty() {
        for child in &active {
            terminate_subtree(state, writers, child).await?;
        }
        complete(writers, ad_hoc);
    } else {
        scope::set_local(state, ad_hoc.process_instance_key, ad_hoc.key, COMPLETION_PENDING, serde_json::json!(true), &ad_hoc.tenant_id).await?;
    }
    Ok(())
}

async fn active_children(state: &EngineState, ad_hoc: &ElementInstance) -> EngineResult<Vec<ElementInstance>> {
    Ok(state.backend
        .get_element_instances_by_process_instance(ad_hoc.process_instance_key)
        .await?
        .into_iter()
        .filter(|ei| ei.flow_scope_key == Some(ad_hoc.key) && !matches!(ei.state.as_str(), "COMPLETED" | "TERMINATED"))
        .collect())
}

async fn completion_pending(state: &EngineState, ad_hoc: &ElementInstance) -> EngineResult<bool> {
    Ok(state.backend
        .get_variables_by_scope(ad_hoc.key)
        .await?
        .iter()
        .any(|v| v.name == COMPLETION_PENDING && v.value == serde_json::json!(true)))
}

/// Everything inside the inner instance `inner` has ended: it completes, its output is
/// collected, and the ad-hoc sub-process decides what happens next. As in Zeebe's
/// `beforeExecutionPathCompleted`, the completion condition is evaluated while the inner
/// instance is completing: a result that is not a boolean raises an
/// `EXTRACT_VALUE_ERROR` incident on it, and resolving the incident calls this again.
pub(crate) async fn inner_completed(
    state: &EngineState,
    writers: &mut Writers,
    process: &BpmnProcess,
    inner: &ElementInstance,
) -> EngineResult<()> {
    let retry = inner.state == "COMPLETING";
    if inner.state != "ACTIVATED" && !retry {
        return Ok(());
    }
    let Some(ad_hoc_key) = inner.flow_scope_key else { return Ok(()) };
    let ad_hoc = state.backend.get_element_instance_by_key(ad_hoc_key).await?;
    let Some(FlowElement::SubProcess(sp)) = process.get_element_recursive(&ad_hoc.element_id) else { return Ok(()) };

    if !retry {
        state.backend.update_element_instance_state(inner.key, "COMPLETING").await?;
        writers.events.push(element_event(inner, "ELEMENT_COMPLETING"));
        if let (Some(collection), Some(output)) = (&sp.output_collection, &sp.output_element) {
            let ctx = scope::feel_context(state, inner.process_instance_key, inner.key).await;
            let value = reebe_feel::parse_and_evaluate(output, &ctx)
                .map(serde_json::Value::from)
                .unwrap_or(serde_json::Value::Null);
            let mut items = state.backend
                .get_variables_by_scope(ad_hoc.key)
                .await?
                .into_iter()
                .find(|v| &v.name == collection)
                .and_then(|v| v.value.as_array().cloned())
                .unwrap_or_default();
            items.push(value);
            scope::set_local(state, ad_hoc.process_instance_key, ad_hoc.key, collection, serde_json::Value::Array(items), &ad_hoc.tenant_id).await?;
        }
    }

    let fulfilled = match completion_condition(state, sp, &ad_hoc, inner.key).await? {
        Ok(fulfilled) => fulfilled,
        Err(message) => {
            writers.commands.push(CommandToWrite {
                value_type: "INCIDENT".to_string(),
                intent: "CREATE".to_string(),
                key: 0,
                payload: serde_json::json!({
                    "errorType": "EXTRACT_VALUE_ERROR",
                    "errorMessage": format!("Failed to evaluate completion condition. {message}"),
                    "processInstanceKey": inner.process_instance_key.to_string(),
                    "elementInstanceKey": inner.key.to_string(),
                    "bpmnProcessId": inner.bpmn_process_id,
                    "tenantId": inner.tenant_id,
                }),
            });
            return Ok(());
        }
    };
    state.backend.update_element_instance_state(inner.key, "COMPLETED").await?;
    writers.events.push(element_event(inner, "ELEMENT_COMPLETED"));
    flow_ended(state, writers, sp, &ad_hoc, fulfilled).await
}

/// The `completionCondition` of an ad-hoc sub-process run by Zeebe (not by a job
/// worker), evaluated in the inner instance `inner_key`: `Ok(None)` when it has none, or
/// when it does not decide anything (the sub-process is not active, or already
/// completing); `Err` with the incident message when it is not a boolean.
async fn completion_condition(
    state: &EngineState,
    sp: &SubProcess,
    ad_hoc: &ElementInstance,
    inner_key: i64,
) -> EngineResult<Result<Option<bool>, String>> {
    let Some(condition) = &sp.completion_condition else { return Ok(Ok(None)) };
    if sp.task_definition.is_some() || ad_hoc.state != "ACTIVATED" || completion_pending(state, ad_hoc).await? {
        return Ok(Ok(None));
    }
    let ctx = scope::feel_context(state, ad_hoc.process_instance_key, inner_key).await;
    Ok(super::bpmn_element::eval_boolean(condition, &ctx).map(Some))
}

/// A flow inside the ad-hoc sub-process ended: an inner instance, whose completion
/// condition result is `fulfilled`, or an event sub-process in it (`None`).
pub(crate) async fn flow_ended(
    state: &EngineState,
    writers: &mut Writers,
    sp: &SubProcess,
    ad_hoc: &ElementInstance,
    fulfilled: Option<bool>,
) -> EngineResult<()> {
    if ad_hoc.state != "ACTIVATED" {
        return Ok(());
    }
    let active = active_children(state, ad_hoc).await?;
    let pending = completion_pending(state, ad_hoc).await?;
    if pending {
        if active.is_empty() {
            complete(writers, ad_hoc);
        }
        return Ok(());
    }
    if sp.task_definition.is_some() {
        // The worker decides again; there is one job at a time.
        state.backend.cancel_jobs_by_element_instance(ad_hoc.key).await?;
        create_job(writers, sp, ad_hoc);
        return Ok(());
    }
    match (&sp.completion_condition, fulfilled) {
        (Some(_), Some(true)) => fulfil(state, writers, ad_hoc, sp.cancel_remaining_instances).await?,
        (Some(_), _) => {}
        (None, _) if active.is_empty() => complete(writers, ad_hoc),
        (None, _) => {}
    }
    Ok(())
}

/// An event sub-process inside the ad-hoc sub-process ended: whether the completion
/// condition holds. Unlike after an inner instance, a result that is not a boolean
/// counts as `false` here: the event sub-process has already completed, so there is
/// nothing left to hold an incident that could retry it.
pub(crate) async fn condition_after_event_sub_process(
    state: &EngineState,
    sp: &SubProcess,
    ad_hoc: &ElementInstance,
) -> EngineResult<Option<bool>> {
    Ok(completion_condition(state, sp, ad_hoc, ad_hoc.key).await?.unwrap_or(Some(false)))
}

/// The ad-hoc sub-process is completing: hand its output collection to the enclosing scope.
pub(crate) async fn completing(state: &EngineState, sp: &SubProcess, ad_hoc: &ElementInstance) -> EngineResult<()> {
    let Some(collection) = &sp.output_collection else { return Ok(()) };
    let Some(value) = state.backend
        .get_variables_by_scope(ad_hoc.key)
        .await?
        .into_iter()
        .find(|v| &v.name == collection)
        .map(|v| v.value)
    else {
        return Ok(());
    };
    let mut vars = serde_json::Map::new();
    vars.insert(collection.clone(), value);
    let parent = ad_hoc.flow_scope_key.unwrap_or(ad_hoc.process_instance_key);
    scope::propagate(state, ad_hoc.process_instance_key, parent, &vars, &ad_hoc.tenant_id).await
}

fn complete(writers: &mut Writers, ad_hoc: &ElementInstance) {
    writers.commands.push(CommandToWrite {
        value_type: "PROCESS_INSTANCE".to_string(),
        intent: "COMPLETE_ELEMENT".to_string(),
        key: ad_hoc.key,
        payload: serde_json::json!({
            "elementInstanceKey": ad_hoc.key.to_string(),
            "processInstanceKey": ad_hoc.process_instance_key.to_string(),
            "processDefinitionKey": ad_hoc.process_definition_key.to_string(),
            "elementId": ad_hoc.element_id,
            "elementType": AD_HOC,
            "bpmnProcessId": ad_hoc.bpmn_process_id,
            "flowScopeKey": ad_hoc.flow_scope_key.unwrap_or(ad_hoc.process_instance_key).to_string(),
            "tenantId": ad_hoc.tenant_id,
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
            "processDefinitionKey": ei.process_definition_key.to_string(),
            "elementId": ei.element_id,
            "elementType": ei.element_type,
            "bpmnProcessId": ei.bpmn_process_id,
            "tenantId": ei.tenant_id,
        }),
    }
}

/// `AD_HOC_SUB_PROCESS_INSTRUCTION` `ACTIVATE`: activate elements of an active ad-hoc
/// sub-process from outside (the REST endpoint
/// `POST /element-instances/ad-hoc-activities/{key}/activation`), with Zeebe's
/// rejections. With `cancelRemainingInstances`, what still runs inside is terminated
/// first.
pub struct AdHocSubProcessInstructionProcessor;

#[async_trait::async_trait]
impl super::RecordProcessor for AdHocSubProcessInstructionProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "AD_HOC_SUB_PROCESS_INSTRUCTION" && intent == "ACTIVATE"
    }

    async fn process(
        &self,
        record: &reebe_db::records::DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;
        let key_text = match &payload["adHocSubProcessInstanceKey"] {
            serde_json::Value::String(key) => key.clone(),
            other => other.to_string(),
        };
        let not_found = || EngineError::NotFound(format!(
            "Expected to activate activities for ad-hoc sub-process but no ad-hoc sub-process instance found with key '{key_text}'."
        ));
        let key: i64 = key_text.parse().map_err(|_| not_found())?;
        let ad_hoc = state.backend.get_element_instance_by_key(key).await.map_err(|_| not_found())?;
        if ad_hoc.element_type != AD_HOC {
            return Err(not_found());
        }
        if ad_hoc.state != "ACTIVATED" {
            return Err(EngineError::InvalidState(format!(
                "Expected to activate activities for ad-hoc sub-process with key '{key}', but it is not active."
            )));
        }
        let process = super::throw_event::load_process(state, ad_hoc.process_definition_key, &ad_hoc.bpmn_process_id).await?;
        let Some(FlowElement::SubProcess(sp)) = process.get_element_recursive(&ad_hoc.element_id) else {
            return Err(not_found());
        };
        let elements: Vec<(String, Option<serde_json::Map<String, serde_json::Value>>)> = payload["elements"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|e| (e["elementId"].as_str().unwrap_or_default().to_string(), e["variables"].as_object().cloned()))
            .collect();
        let allowed = activatable(sp);
        let unknown: Vec<&str> = elements.iter().map(|(id, _)| id.as_str()).filter(|id| !allowed.contains(id)).collect();
        if !unknown.is_empty() {
            return Err(EngineError::NotFound(format!(
                "Expected to activate activities for ad-hoc sub-process with key '{key}', but the given elements [{}] do not exist.",
                unknown.join(", "),
            )));
        }

        if payload["cancelRemainingInstances"].as_bool() == Some(true) {
            for child in active_children(state, &ad_hoc).await? {
                terminate_subtree(state, writers, &child).await?;
            }
        }
        for (id, variables) in &elements {
            activate_inner(state, writers, &ad_hoc, id, variables.as_ref()).await?;
        }
        writers.events.push(EventToWrite {
            value_type: "AD_HOC_SUB_PROCESS_INSTRUCTION".to_string(),
            intent: "ACTIVATED".to_string(),
            key: ad_hoc.key,
            payload: payload.clone(),
        });
        writers.response = Some(serde_json::json!({ "adHocSubProcessInstanceKey": key.to_string() }));
        Ok(())
    }
}
