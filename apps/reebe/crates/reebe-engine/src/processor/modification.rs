//! Process instance modification (`PROCESS_INSTANCE_MODIFICATION` `MODIFY`), as
//! Zeebe's `ProcessInstanceModificationModifyProcessor` and `ElementActivationBehavior`
//! do it.
//!
//! A modification activates elements and terminates element instances of one active
//! process instance. Move instructions are turned into an activation and a
//! termination for each element instance they name. Every instruction is checked
//! before anything changes, with Zeebe's rejection messages; then the activations run,
//! then the terminations.
//!
//! An element is activated in an instance of each of its flow scopes (the sub-processes
//! around it): an active one is reused, and when there is none a new one is activated
//! without starting it (its boundary events and event sub-processes are armed, its
//! start events are not). When a flow scope has several active instances, the
//! instruction's ancestor element instance key chooses: the instance that is the
//! ancestor, or one around it, is reused; a new one is created below it. An element
//! inside a multi-instance activity cannot be activated when that would create an
//! instance of the multi-instance body or of its inner instances.
//!
//! A terminated element instance takes what runs inside it with it. Its flow scope is
//! terminated too once nothing is active in it any more, nothing is on its way to it,
//! and no activation of the modification needs it, and so on outwards up to the
//! process instance, which is then terminated. A process instance that a call
//! activity started cannot be terminated this way.

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use async_trait::async_trait;
use reebe_bpmn::{BpmnProcess, FlowElement, SequenceFlow, SubProcess};
use reebe_db::records::DbRecord;
use reebe_db::state::element_instances::ElementInstance;
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::catch_event::{arm_boundary_events, arm_event_subprocesses};
use super::{ad_hoc, multi_instance, scope};
use super::{CommandToWrite, EventToWrite, RecordProcessor, Writers};

pub struct ProcessInstanceModificationProcessor;

/// Element types Zeebe cannot activate by modification.
const UNSUPPORTED_TYPES: [&str; 3] = ["START_EVENT", "SEQUENCE_FLOW", "BOUNDARY_EVENT"];

/// Zeebe's `BpmnElementType` values, less `UNSPECIFIED` and the unsupported ones, in
/// its order: `SUPPORTED_ELEMENT_TYPES` as the rejection prints it.
const SUPPORTED_TYPES: &str = "[PROCESS, SUB_PROCESS, EVENT_SUB_PROCESS, AD_HOC_SUB_PROCESS, \
    AD_HOC_SUB_PROCESS_INNER_INSTANCE, INTERMEDIATE_CATCH_EVENT, INTERMEDIATE_THROW_EVENT, END_EVENT, \
    SERVICE_TASK, RECEIVE_TASK, USER_TASK, MANUAL_TASK, TASK, EXCLUSIVE_GATEWAY, PARALLEL_GATEWAY, \
    EVENT_BASED_GATEWAY, INCLUSIVE_GATEWAY, MULTI_INSTANCE_BODY, CALL_ACTIVITY, BUSINESS_RULE_TASK, \
    SCRIPT_TASK, SEND_TASK]";

struct VariableInstruction {
    /// The element whose scope gets the variables; empty for the process.
    scope_id: String,
    variables: serde_json::Map<String, serde_json::Value>,
}

struct Activate {
    element_id: String,
    /// The chosen ancestor element instance; `<= 0` for none.
    ancestor: i64,
    variables: Vec<VariableInstruction>,
}

struct Terminate {
    key: i64,
    element_id: String,
}

struct Move {
    source_id: String,
    source_key: i64,
    target_id: String,
    ancestor: i64,
    infer_ancestor: bool,
    source_parent_as_ancestor: bool,
    variables: Vec<VariableInstruction>,
}

fn key_of(value: &serde_json::Value) -> i64 {
    match value {
        serde_json::Value::String(text) => text.parse().unwrap_or(-1),
        other => other.as_i64().unwrap_or(-1),
    }
}

fn text_of(value: &serde_json::Value) -> String {
    value.as_str().unwrap_or_default().to_string()
}

fn variable_instructions(value: &serde_json::Value) -> Vec<VariableInstruction> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .map(|vi| VariableInstruction {
            scope_id: text_of(&vi["elementId"]),
            variables: vi["variables"].as_object().cloned().unwrap_or_default(),
        })
        .collect()
}

fn list<'a>(payload: &'a serde_json::Value, name: &str) -> impl Iterator<Item = &'a serde_json::Value> {
    payload[name].as_array().into_iter().flatten()
}

fn invalid(message: String) -> EngineError {
    EngineError::InvalidArgument(message)
}

/// The element or sequence flow with the id, and the sub-processes around it,
/// outermost first.
enum Located<'a> {
    Element(&'a FlowElement),
    Flow,
}

fn locate<'a>(
    elements: &'a HashMap<String, FlowElement>,
    flows: &'a [SequenceFlow],
    id: &str,
    path: &mut Vec<&'a SubProcess>,
) -> Option<Located<'a>> {
    if let Some(el) = elements.get(id) {
        return Some(Located::Element(el));
    }
    if flows.iter().any(|f| f.id == id) {
        return Some(Located::Flow);
    }
    for el in elements.values() {
        if let FlowElement::SubProcess(sp) = el {
            path.push(sp);
            if let Some(found) = locate(&sp.elements, &sp.sequence_flows, id, path) {
                return Some(found);
            }
            path.pop();
        }
    }
    None
}

/// The element, its Zeebe element type and its flow scopes (outermost first), or `None`
/// when the process has no element or sequence flow with the id.
fn find<'a>(process: &'a BpmnProcess, id: &str) -> Option<(Option<&'a FlowElement>, &'static str, Vec<&'a SubProcess>)> {
    let mut path = Vec::new();
    let located = locate(&process.elements, &process.sequence_flows, id, &mut path)?;
    Some(match located {
        Located::Flow => (None, "SEQUENCE_FLOW", path),
        Located::Element(el) if el.multi_instance().is_some() => (Some(el), multi_instance::BODY, path),
        Located::Element(el) => (Some(el), el.bpmn_element_type(), path),
    })
}

/// Whether `scope_id` is a flow scope of the element `element_id`: a sub-process
/// around it, or the process.
fn is_flow_scope_of(process: &BpmnProcess, element_id: &str, scope_id: &str) -> bool {
    match find(process, element_id) {
        Some((_, _, path)) => scope_id == process.id || path.iter().any(|sp| sp.id == scope_id),
        None => false,
    }
}

/// A catch event (or receive task) that an event-based gateway leads to.
fn after_event_based_gateway(process: &BpmnProcess, element: &FlowElement) -> bool {
    if !matches!(element, FlowElement::IntermediateCatchEvent(_) | FlowElement::ReceiveTask(_)) {
        return false;
    }
    let mut path = Vec::new();
    locate(&process.elements, &process.sequence_flows, element.id(), &mut path);
    let (elements, flows) = match path.last() {
        Some(sp) => (&sp.elements, &sp.sequence_flows),
        None => (&process.elements, &process.sequence_flows),
    };
    flows
        .iter()
        .filter(|f| f.target_ref == element.id())
        .any(|f| matches!(elements.get(&f.source_ref), Some(FlowElement::EventBasedGateway(_))))
}

/// One level of the element instances an activated element is nested in.
#[derive(Clone)]
struct Level {
    element_id: String,
    element_type: &'static str,
}

fn sub_process_type(sp: &SubProcess) -> &'static str {
    if sp.triggered_by_event {
        "EVENT_SUB_PROCESS"
    } else if sp.ad_hoc {
        ad_hoc::AD_HOC
    } else {
        "SUB_PROCESS"
    }
}

/// The element instances an element is activated in, outermost first, below the
/// process: for each sub-process around it an instance of it (below its
/// multi-instance body, if it has one), and below an ad-hoc sub-process an inner
/// instance, unless the element is an event sub-process of it.
fn levels(path: &[&SubProcess], target: Option<&FlowElement>) -> Vec<Level> {
    let mut levels = Vec::new();
    for (i, sp) in path.iter().enumerate() {
        if sp.multi_instance.is_some() {
            levels.push(Level { element_id: sp.id.clone(), element_type: multi_instance::BODY });
        }
        levels.push(Level { element_id: sp.id.clone(), element_type: sub_process_type(sp) });
        let child_is_event_sub_process = match path.get(i + 1) {
            Some(next) => next.triggered_by_event,
            None => matches!(target, Some(FlowElement::SubProcess(t)) if t.triggered_by_event),
        };
        if sp.ad_hoc && !child_is_event_sub_process {
            levels.push(Level { element_id: sp.id.clone(), element_type: ad_hoc::INNER });
        }
    }
    levels
}

fn is_active(ei: &ElementInstance) -> bool {
    !matches!(ei.state.as_str(), "COMPLETED" | "TERMINATED")
}

/// The element instances of the process instance while the modification is planned:
/// the active ones, and the flow scope instances the activations will create (with
/// negative keys until they are created).
struct Snapshot {
    instances: Vec<ElementInstance>,
    next_virtual: i64,
}

impl Snapshot {
    fn get(&self, key: i64) -> Option<&ElementInstance> {
        self.instances.iter().find(|ei| ei.key == key)
    }

    fn children(&self, key: i64) -> impl Iterator<Item = &ElementInstance> {
        self.instances.iter().filter(move |ei| ei.flow_scope_key == Some(key))
    }

    /// Whether `ancestor` is a (direct or indirect) flow scope of `instance`.
    fn is_ancestor_of(&self, ancestor: i64, instance: &ElementInstance) -> bool {
        let mut current = instance.flow_scope_key;
        while let Some(key) = current {
            if key == ancestor {
                return true;
            }
            current = self.get(key).and_then(|ei| ei.flow_scope_key);
        }
        false
    }
}

/// How an activation reaches an instance of one level of its flow scopes.
enum Step {
    Reuse { level: Level, key: i64 },
    Create { level: Level, key: i64, flow_scope_key: i64 },
}

struct PlannedActivation {
    element_id: String,
    steps: Vec<Step>,
    flow_scope_key: i64,
    variables: Vec<VariableInstruction>,
}

struct Context<'a> {
    process: &'a BpmnProcess,
    process_ei: &'a ElementInstance,
    bpmn_process_id: &'a str,
}

impl Context<'_> {
    fn multiple_flow_scope_instances(&self, flow_scope_id: &str) -> EngineError {
        invalid(format!(
            "Expected to modify instance of process '{}' but it contains one or more activate instructions \
             for an element that has a flow scope with more than one active instance: '{flow_scope_id}'. Can't decide \
             in which instance of the flow scope the element should be activated. Please specify an \
             ancestor element instance key for this activate instruction.",
            self.bpmn_process_id,
        ))
    }

    /// Zeebe's `findReusableSubprocessInstanceKey`: the instance of `level` below
    /// `flow_scope_key` to reuse, or `None` to create one.
    fn reusable(&self, snapshot: &Snapshot, level: &Level, flow_scope_key: i64, ancestor: i64) -> EngineResult<Option<i64>> {
        let instances: Vec<&ElementInstance> = snapshot
            .children(flow_scope_key)
            .filter(|ei| ei.element_id == level.element_id && ei.element_type == level.element_type)
            .collect();
        let selected = ancestor > 0;
        match instances.as_slice() {
            [] => Ok(None),
            [one] if selected && snapshot.is_ancestor_of(ancestor, one) => Ok(None),
            [one] => Ok(Some(one.key)),
            _ if !selected => Err(self.multiple_flow_scope_instances(&level.element_id)),
            _ if instances.iter().any(|ei| ei.key == ancestor) => Ok(Some(ancestor)),
            _ if instances.iter().any(|ei| snapshot.is_ancestor_of(ancestor, ei)) => Ok(None),
            _ => {
                let around = snapshot
                    .get(ancestor)
                    .and_then(|selected| instances.iter().find(|ei| snapshot.is_ancestor_of(ei.key, selected)));
                match around {
                    Some(ei) => Ok(Some(ei.key)),
                    None => Err(self.multiple_flow_scope_instances(&level.element_id)),
                }
            }
        }
    }

    /// Zeebe's `activateAncestralSubprocesses`: plan the instances of the flow scopes
    /// of the element, adding the ones to create to `snapshot`.
    fn plan(&self, snapshot: &mut Snapshot, activate: Activate) -> EngineResult<PlannedActivation> {
        let Some((target, _, path)) = find(self.process, &activate.element_id) else {
            return Err(EngineError::Internal(format!("Element {} disappeared", activate.element_id)));
        };
        let levels = levels(&path, target);
        let mut steps = Vec::new();
        let mut flow_scope_key = self.process_ei.key;
        for (i, level) in levels.iter().enumerate() {
            match self.reusable(snapshot, level, flow_scope_key, activate.ancestor)? {
                Some(key) => {
                    steps.push(Step::Reuse { level: level.clone(), key });
                    flow_scope_key = key;
                }
                None => {
                    let in_body = i > 0 && levels[i - 1].element_type == multi_instance::BODY;
                    if level.element_type == multi_instance::BODY || in_body {
                        return Err(invalid(format!(
                            "Expected to modify instance of process '{}' but it contains one or more activate \
                             instructions that would result in the activation of multi-instance element \
                             '{}', which is currently unsupported.",
                            self.bpmn_process_id, level.element_id,
                        )));
                    }
                    let key = snapshot.next_virtual;
                    snapshot.next_virtual -= 1;
                    snapshot.instances.push(ElementInstance {
                        key,
                        element_id: level.element_id.clone(),
                        element_type: level.element_type.to_string(),
                        state: "ACTIVATED".to_string(),
                        flow_scope_key: Some(flow_scope_key),
                        scope_key: Some(key),
                        incident_key: None,
                        ..self.process_ei.clone()
                    });
                    steps.push(Step::Create { level: level.clone(), key, flow_scope_key });
                    flow_scope_key = key;
                }
            }
        }
        Ok(PlannedActivation { element_id: activate.element_id, steps, flow_scope_key, variables: activate.variables })
    }
}

/// Zeebe's `determineAncestorScopeKey` for a move instruction whose source element
/// instance has the flow scope `source_parent`.
fn move_ancestor(ctx: &Context<'_>, snapshot: &Snapshot, instruction: &Move, source_parent: i64) -> i64 {
    if instruction.source_parent_as_ancestor {
        return source_parent;
    }
    if !instruction.infer_ancestor {
        return instruction.ancestor;
    }
    // Zeebe's `findProperAncestorScopeKeyForTarget`: the nearest instance around the
    // source of an element around the target.
    let Some((_, _, path)) = find(ctx.process, &instruction.target_id) else { return source_parent };
    let Some(direct) = path.last() else { return -1 };
    let parent = snapshot.get(source_parent);
    if parent.is_some_and(|p| p.element_id == direct.id) {
        return source_parent;
    }
    let scopes: HashSet<&str> = path.iter().map(|sp| sp.id.as_str()).collect();
    let mut current = parent.and_then(|p| p.flow_scope_key);
    while let Some(key) = current {
        let Some(ei) = snapshot.get(key) else { break };
        if scopes.contains(ei.element_id.as_str()) {
            return key;
        }
        current = ei.flow_scope_key;
    }
    -1
}

#[async_trait]
impl RecordProcessor for ProcessInstanceModificationProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "PROCESS_INSTANCE_MODIFICATION" && intent == "MODIFY"
    }

    async fn process(&self, record: &DbRecord, state: &EngineState, writers: &mut Writers) -> EngineResult<()> {
        let payload = &record.payload;
        let pik = key_of(&payload["processInstanceKey"]);
        let not_found = || EngineError::NotFound(format!(
            "Expected to modify process instance but no process instance found with key '{pik}'"
        ));
        let pi = match state.backend.get_process_instance_by_key(pik).await {
            Ok(pi) if pi.state == "ACTIVE" => pi,
            _ => return Err(not_found()),
        };
        let all = state.backend.get_element_instances_by_process_instance(pik).await?;
        let mut active: Vec<ElementInstance> = all.into_iter().filter(is_active).collect();
        active.sort_by_key(|ei| ei.key);
        let process_ei = active.iter().find(|ei| ei.element_type == "PROCESS").cloned().ok_or_else(not_found)?;
        let process = super::throw_event::load_process(state, pi.process_definition_key, &pi.bpmn_process_id).await?;
        let pid = pi.bpmn_process_id.as_str();
        let ctx = Context { process: &process, process_ei: &process_ei, bpmn_process_id: pid };
        // The process instance key names the process's element instance.
        let norm = |key: i64| if key == pik { process_ei.key } else { key };

        let mut activates: Vec<Activate> = list(payload, "activateInstructions")
            .map(|a| Activate {
                element_id: text_of(&a["elementId"]),
                ancestor: norm(key_of(&a["ancestorScopeKey"])),
                variables: variable_instructions(&a["variableInstructions"]),
            })
            .collect();
        let terminate_input: Vec<Terminate> = list(payload, "terminateInstructions")
            .map(|t| Terminate { key: norm(key_of(&t["elementInstanceKey"])), element_id: text_of(&t["elementId"]) })
            .collect();
        let moves: Vec<Move> = list(payload, "moveInstructions")
            .map(|m| Move {
                source_id: text_of(&m["sourceElementId"]),
                source_key: norm(key_of(&m["sourceElementInstanceKey"])),
                target_id: text_of(&m["targetElementId"]),
                ancestor: norm(key_of(&m["ancestorScopeKey"])),
                infer_ancestor: m["inferAncestorScopeFromSourceHierarchy"].as_bool() == Some(true),
                source_parent_as_ancestor: m["useSourceParentKeyAsAncestorScopeKey"].as_bool() == Some(true),
                variables: variable_instructions(&m["variableInstructions"]),
            })
            .collect();

        validate_command(pid, &terminate_input, &moves)?;

        let mut snapshot = Snapshot { instances: active, next_virtual: -1 };
        let mut terminates: Vec<Terminate> = Vec::new();

        // Move instructions by source element instance key.
        let by_key: Vec<&Move> = moves.iter().filter(|m| m.source_key > 0).collect();
        let mut missing = Vec::new();
        let mut foreign = Vec::new();
        let mut sources = HashMap::new();
        for m in &by_key {
            match state.backend.get_element_instance_by_key(m.source_key).await {
                Ok(ei) if is_active(&ei) => {
                    if ei.process_instance_key != pik && !foreign.contains(&m.source_key) {
                        foreign.push(m.source_key);
                    }
                    sources.insert(m.source_key, ei);
                }
                _ if !missing.contains(&m.source_key) => missing.push(m.source_key),
                _ => {}
            }
        }
        let keys = |keys: &[i64]| keys.iter().map(i64::to_string).collect::<Vec<_>>().join("', '");
        if !missing.is_empty() {
            return Err(invalid(format!(
                "Expected to modify instance of process '{pid}' but it contains one or more move instructions \
                 with a source element instance that could not be found: '{}'",
                keys(&missing),
            )));
        }
        if !foreign.is_empty() {
            return Err(invalid(format!(
                "Expected to modify instance of process '{pid}' but it contains one or more move instructions \
                 with a source element instance that does not belong to the modified process instance: '{}'",
                keys(&foreign),
            )));
        }
        for m in &by_key {
            let source = &sources[&m.source_key];
            let parent = source.flow_scope_key.unwrap_or(-1);
            activates.push(Activate {
                element_id: m.target_id.clone(),
                ancestor: move_ancestor(&ctx, &snapshot, m, parent),
                variables: copy_variables(&m.variables),
            });
            terminates.push(Terminate { key: m.source_key, element_id: source.element_id.clone() });
        }

        // Move instructions by source element id and terminate instructions: each
        // active element instance with the id, not inside one already terminated.
        let moves_by_id: HashMap<&str, &Move> =
            moves.iter().filter(|m| !m.source_id.trim().is_empty()).map(|m| (m.source_id.as_str(), m)).collect();
        let mut terminate_ids = HashSet::new();
        let mut terminate_keys = HashSet::new();
        for t in terminate_input {
            if t.key > 0 {
                terminate_keys.insert(t.key);
                terminates.push(t);
            } else {
                terminate_ids.insert(t.element_id);
            }
        }
        if !moves_by_id.is_empty() || !terminate_ids.is_empty() {
            let mut queue: VecDeque<ElementInstance> = snapshot.children(process_ei.key).cloned().collect();
            while let Some(ei) = queue.pop_front() {
                let mut terminated = false;
                if let Some(m) = moves_by_id.get(ei.element_id.as_str()) {
                    let parent = ei.flow_scope_key.unwrap_or(-1);
                    activates.push(Activate {
                        element_id: m.target_id.clone(),
                        ancestor: move_ancestor(&ctx, &snapshot, m, parent),
                        variables: copy_variables(&m.variables),
                    });
                    terminates.push(Terminate { key: ei.key, element_id: String::new() });
                    terminated = true;
                }
                if !terminated && terminate_ids.contains(&ei.element_id) {
                    terminates.push(Terminate { key: ei.key, element_id: String::new() });
                    terminated = true;
                }
                if !terminated && !terminate_keys.contains(&ei.key) {
                    queue.extend(snapshot.children(ei.key).cloned());
                }
            }
        }

        validate_instructions(&ctx, state, pik, &activates, &terminates).await?;

        // Plan the activations, then the terminations, before changing anything: a
        // rejection leaves the process instance as it was, as Zeebe's does.
        let mut planned = Vec::new();
        for activate in activates {
            planned.push(ctx.plan(&mut snapshot, activate)?);
        }
        // The flow scope instances the activations run in, the process's included.
        let required: HashSet<i64> = planned
            .iter()
            .flat_map(|p| p.steps.iter().map(|s| match s { Step::Reuse { key, .. } | Step::Create { key, .. } => *key }))
            .chain(planned.first().map(|_| process_ei.key))
            .collect();
        let doomed = plan_terminations(state, record.position, &ctx, &pi, &snapshot, &terminates, &required).await?;

        // Activate.
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let mut real_keys: HashMap<i64, i64> = HashMap::new();
        let real = |key: i64, real_keys: &HashMap<i64, i64>| real_keys.get(&key).copied().unwrap_or(key);
        for activation in &planned {
            set_variables(state, &pi, &activation.variables, pid, pik).await?;
            for step in &activation.steps {
                match step {
                    Step::Reuse { level, key } => {
                        if level.element_type != ad_hoc::INNER {
                            set_variables(state, &pi, &activation.variables, &level.element_id, *key).await?;
                        }
                    }
                    Step::Create { level, key, flow_scope_key } => {
                        let created = ElementInstance {
                            key: key_gen.next_key().await?,
                            element_id: level.element_id.clone(),
                            element_type: level.element_type.to_string(),
                            state: "ACTIVATED".to_string(),
                            flow_scope_key: Some(real(*flow_scope_key, &real_keys)),
                            incident_key: None,
                            ..process_ei.clone()
                        };
                        let created = ElementInstance { scope_key: Some(created.key), ..created };
                        real_keys.insert(*key, created.key);
                        state.backend.insert_element_instance(&created).await?;
                        writers.events.push(element_event(&created, "ELEMENT_ACTIVATING"));
                        if level.element_type != ad_hoc::INNER {
                            set_variables(state, &pi, &activation.variables, &level.element_id, created.key).await?;
                        }
                        writers.events.push(element_event(&created, "ELEMENT_ACTIVATED"));
                        if level.element_type != ad_hoc::INNER {
                            arm_boundary_events(state, writers, &process, &created).await?;
                            arm_event_subprocesses(state, writers, &process, &created).await?;
                        }
                    }
                }
            }
            let local: serde_json::Map<String, serde_json::Value> = activation
                .variables
                .iter()
                .filter(|vi| vi.scope_id == activation.element_id)
                .flat_map(|vi| vi.variables.clone())
                .collect();
            writers.commands.push(CommandToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: "ACTIVATE_ELEMENT".to_string(),
                key: pik,
                payload: serde_json::json!({
                    "processInstanceKey": pik.to_string(),
                    "processDefinitionKey": pi.process_definition_key.to_string(),
                    "bpmnProcessId": pid,
                    "elementId": activation.element_id,
                    "flowScopeKey": real(activation.flow_scope_key, &real_keys).to_string(),
                    "localVariables": local,
                    "tenantId": pi.tenant_id,
                }),
            });
        }

        // Terminate, each with what runs inside it, and resolve the incidents of what
        // was terminated.
        for key in &doomed {
            let Ok(ei) = state.backend.get_element_instance_by_key(*key).await else { continue };
            if !is_active(&ei) {
                continue;
            }
            super::throw_event::terminate_subtree(state, writers, &ei).await?;
            if ei.element_type == "PROCESS" {
                state.backend.update_process_instance_state(pik, "TERMINATED", Some(state.clock.now())).await?;
                super::start_event::instance_ended(state, writers, pik).await?;
            }
        }
        for incident in state.backend.get_incidents_by_process_instance(pik).await? {
            let ended = state.backend
                .get_element_instance_by_key(incident.element_instance_key)
                .await
                .is_ok_and(|ei| ei.state == "TERMINATED");
            if incident.state == "ACTIVE" && ended {
                state.backend.resolve_incident(incident.key).await?;
                writers.events.push(EventToWrite {
                    value_type: "INCIDENT".to_string(),
                    intent: "RESOLVED".to_string(),
                    key: incident.key,
                    payload: serde_json::json!({
                        "incidentKey": incident.key.to_string(),
                        "processInstanceKey": pik.to_string(),
                        "elementInstanceKey": incident.element_instance_key.to_string(),
                        "tenantId": pi.tenant_id,
                    }),
                });
            }
        }

        let mut modified = payload.clone();
        modified["processDefinitionKey"] = serde_json::json!(pi.process_definition_key.to_string());
        modified["bpmnProcessId"] = serde_json::json!(pid);
        modified["tenantId"] = serde_json::json!(pi.tenant_id);
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE_MODIFICATION".to_string(),
            intent: "MODIFIED".to_string(),
            key: pik,
            payload: modified,
        });
        writers.response = Some(serde_json::json!({ "processInstanceKey": pik.to_string() }));
        Ok(())
    }
}

fn copy_variables(variables: &[VariableInstruction]) -> Vec<VariableInstruction> {
    variables
        .iter()
        .map(|vi| VariableInstruction { scope_id: vi.scope_id.clone(), variables: vi.variables.clone() })
        .collect()
}

/// Zeebe's `executeVariableInstruction`: the variables of the instructions for
/// `element_id` (the process's for its id or an empty scope id), local to `scope_key`.
async fn set_variables(
    state: &EngineState,
    pi: &reebe_db::state::process_instances::ProcessInstance,
    instructions: &[VariableInstruction],
    element_id: &str,
    scope_key: i64,
) -> EngineResult<()> {
    let for_process = element_id == pi.bpmn_process_id;
    for vi in instructions.iter().filter(|vi| vi.scope_id == element_id || (vi.scope_id.is_empty() && for_process)) {
        for (name, value) in &vi.variables {
            scope::set_local(state, pi.key, scope_key, name, value.clone(), &pi.tenant_id).await?;
        }
    }
    Ok(())
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
            "flowScopeKey": ei.flow_scope_key.map(|k| k.to_string()),
            "tenantId": ei.tenant_id,
        }),
    }
}

/// Zeebe's `validateCommand`: the terminate and move instructions name what they need.
fn validate_command(pid: &str, terminates: &[Terminate], moves: &[Move]) -> EngineResult<()> {
    let pairs = |items: Vec<String>| items.join("', '");
    let none: Vec<String> = terminates
        .iter()
        .filter(|t| t.key <= 0 && t.element_id.trim().is_empty())
        .map(|t| format!("({}, {})", t.key, t.element_id))
        .collect();
    if !none.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more terminate instructions \
             with neither an element instance key nor element id: '{}'",
            pairs(none),
        )));
    }
    let both: Vec<String> = terminates
        .iter()
        .filter(|t| t.key > 0 && !t.element_id.trim().is_empty())
        .map(|t| format!("({}, {})", t.key, t.element_id))
        .collect();
    if !both.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more terminate instructions \
             with both element instance key and element id, but only one of them is allowed: '{}'",
            pairs(both),
        )));
    }
    let incomplete: Vec<String> = moves
        .iter()
        .filter(|m| (m.source_key <= 0 && m.source_id.trim().is_empty()) || m.target_id.trim().is_empty())
        .map(|m| {
            let source = if m.source_id.trim().is_empty() && m.source_key > 0 { m.source_key.to_string() } else { m.source_id.clone() };
            format!("({source}, {})", m.target_id)
        })
        .collect();
    if !incomplete.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more move instructions \
             with either or both the source or target element id missing: '{}'",
            pairs(incomplete),
        )));
    }
    let mut seen = HashSet::new();
    let mut duplicates = Vec::new();
    for m in moves.iter().filter(|m| !m.source_id.trim().is_empty()) {
        if !seen.insert(m.source_id.as_str()) && !duplicates.contains(&m.source_id) {
            duplicates.push(m.source_id.clone());
        }
    }
    if !duplicates.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains multiple move instructions \
             with identical source element ids: '{}'",
            pairs(duplicates),
        )));
    }
    let both: Vec<String> = moves
        .iter()
        .filter(|m| m.source_key > 0 && !m.source_id.trim().is_empty())
        .map(|m| format!("({}/{}, {})", m.source_id, m.source_key, m.target_id))
        .collect();
    if !both.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more move instructions \
             with both source element instance key and source element id, but only one of them is allowed: '{}'",
            pairs(both),
        )));
    }
    let ambiguous: Vec<String> = moves
        .iter()
        .filter(|m| [m.ancestor > 0, m.infer_ancestor, m.source_parent_as_ancestor].iter().filter(|b| **b).count() > 1)
        .map(|m| {
            let source = if m.source_id.trim().is_empty() { m.source_key.to_string() } else { m.source_id.clone() };
            format!("({source}, {})", m.target_id)
        })
        .collect();
    if !ambiguous.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more move instructions \
             with multiple ancestor scope options set. Only one of the following can be specified: \
             ancestorScopeKey, inferAncestorScopeFromSourceHierarchy, or useSourceParentKeyAsAncestorScopeKey: '{}'",
            pairs(ambiguous),
        )));
    }
    Ok(())
}

fn distinct(items: impl Iterator<Item = String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for item in items {
        if !out.contains(&item) {
            out.push(item);
        }
    }
    out
}

/// Zeebe's `validateInstructions`, in its order.
async fn validate_instructions(
    ctx: &Context<'_>,
    state: &EngineState,
    pik: i64,
    activates: &[Activate],
    terminates: &[Terminate],
) -> EngineResult<()> {
    let pid = ctx.bpmn_process_id;
    let process = ctx.process;
    let unknown = distinct(activates.iter().map(|a| a.element_id.clone()).filter(|id| find(process, id).is_none()));
    if !unknown.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more activate instructions \
             with an element that could not be found: '{}'",
            unknown.join("', '"),
        )));
    }
    let unsupported = |ids: Vec<String>, reason: String| {
        invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more activate instructions \
             for elements that are unsupported: '{}'. {reason}.",
            ids.join("', '"),
        ))
    };
    let ids = distinct(activates.iter().map(|a| a.element_id.clone()));
    let after_gateway: Vec<String> = ids
        .iter()
        .filter(|id| find(process, id).is_some_and(|(el, _, _)| el.is_some_and(|el| after_event_based_gateway(process, el))))
        .cloned()
        .collect();
    if !after_gateway.is_empty() {
        return Err(unsupported(
            after_gateway,
            "The activation of events belonging to an event-based gateway is not supported".to_string(),
        ));
    }
    let typed: Vec<(String, &'static str)> = ids
        .iter()
        .filter_map(|id| find(process, id).map(|(_, t, _)| (id.clone(), t)))
        .filter(|(_, t)| UNSUPPORTED_TYPES.contains(t))
        .collect();
    if !typed.is_empty() {
        let types = distinct(typed.iter().map(|(_, t)| t.to_string()));
        return Err(unsupported(
            typed.into_iter().map(|(id, _)| id).collect(),
            format!(
                "The activation of elements with type '{}' is not supported. Supported element types are: {SUPPORTED_TYPES}",
                types.join("', '"),
            ),
        ));
    }

    let mut missing = Vec::new();
    let mut terminated = Vec::new();
    for t in terminates {
        match state.backend.get_element_instance_by_key(t.key).await {
            Ok(ei) if is_active(&ei) => terminated.push(ei),
            _ if !missing.contains(&t.key) => missing.push(t.key),
            _ => {}
        }
    }
    if !missing.is_empty() {
        let shown: Vec<String> = missing.iter().map(|k| if *k == ctx.process_ei.key { pik } else { *k }.to_string()).collect();
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more terminate instructions \
             with an element instance that could not be found: '{}'",
            shown.join("', '"),
        )));
    }

    let unknown_scopes = distinct(
        activates
            .iter()
            .flat_map(|a| a.variables.iter().map(|vi| vi.scope_id.clone()))
            .filter(|id| !id.is_empty() && id != &process.id && find(process, id).is_none()),
    );
    if !unknown_scopes.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more variable instructions \
             with a scope element id that could not be found: '{}'",
            unknown_scopes.join("', '"),
        )));
    }
    let outside = activates.iter().any(|a| {
        a.variables.iter().any(|vi| {
            !vi.scope_id.is_empty() && vi.scope_id != a.element_id && !is_flow_scope_of(process, &a.element_id, &vi.scope_id)
        })
    });
    if outside {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more variable instructions \
             with a scope element that doesn't belong to the activating element's flow scope. \
             These variables should be set before or after the modification."
        )));
    }

    // Ancestor element instances: active, of this process instance, and around the element.
    let shown = |key: i64| if key == ctx.process_ei.key { pik } else { key };
    let mut ancestors: HashMap<i64, Option<ElementInstance>> = HashMap::new();
    for a in activates.iter().filter(|a| a.ancestor > 0) {
        if !ancestors.contains_key(&a.ancestor) {
            ancestors.insert(a.ancestor, state.backend.get_element_instance_by_key(a.ancestor).await.ok());
        }
    }
    let inactive = distinct(
        activates
            .iter()
            .filter(|a| a.ancestor > 0)
            .filter(|a| !ancestors[&a.ancestor].as_ref().is_some_and(|ei| ei.state == "ACTIVATED"))
            .map(|a| shown(a.ancestor).to_string()),
    );
    if !inactive.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more activate instructions \
             with an ancestor scope key that does not exist, or is not in an active state: '{}'",
            inactive.join("', '"),
        )));
    }
    let foreign = distinct(
        ancestors
            .values()
            .flatten()
            .filter(|ei| ei.process_instance_key != pik)
            .map(|ei| ei.key.to_string()),
    );
    if !foreign.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more activate \
             instructions with an ancestor scope key that does not belong to the modified process \
             instance: '{}'",
            foreign.join("', '"),
        )));
    }
    let not_around: String = activates
        .iter()
        .filter(|a| a.ancestor > 0)
        .filter_map(|a| ancestors[&a.ancestor].as_ref().map(|ei| (a, ei)))
        .filter(|(a, ei)| !is_flow_scope_of(process, &a.element_id, &ei.element_id))
        .map(|(a, ei)| {
            format!(
                "\n- instance '{}' of element '{}' is not an ancestor of element '{}'",
                shown(a.ancestor), ei.element_id, a.element_id,
            )
        })
        .collect();
    if !not_around.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more activate instructions \
             with an ancestor scope key that is not an ancestor of the element to activate:{not_around}"
        )));
    }

    // No activation in a flow scope instance that is being terminated.
    let mut conflicts = Vec::new();
    let mut seen = HashSet::new();
    for ei in terminated.iter().filter(|ei| seen.insert(ei.key)) {
        for a in activates {
            let conflict = if a.ancestor > 0 {
                a.ancestor == ei.key
            } else {
                is_flow_scope_of(process, &a.element_id, &ei.element_id)
            };
            if conflict {
                conflicts.push(format!(
                    "element '{}' requires flow scope instance '{}' which is being terminated",
                    a.element_id, shown(ei.key),
                ));
            }
        }
    }
    if !conflicts.is_empty() {
        return Err(invalid(format!(
            "Expected to modify instance of process '{pid}' but it contains one or more activate instructions \
             for elements whose required flow scope instance is also being terminated: {}. \
             Please provide a valid ancestor scope key for the activation or avoid terminating the required flow scope.",
            conflicts.join(", "),
        )));
    }
    Ok(())
}

/// The element instances to terminate, in order: each one a terminate instruction
/// names (with what runs inside it), then its flow scopes that are left with nothing
/// to do, as Zeebe's `terminateFlowScopes` does. Rejects terminating a process
/// instance that a call activity started.
async fn plan_terminations(
    state: &EngineState,
    position: i64,
    ctx: &Context<'_>,
    pi: &reebe_db::state::process_instances::ProcessInstance,
    snapshot: &Snapshot,
    terminates: &[Terminate],
    required: &HashSet<i64>,
) -> EngineResult<Vec<i64>> {
    let mut gone: HashSet<i64> = HashSet::new();
    let mut doomed = Vec::new();
    let subtree = |key: i64, gone: &mut HashSet<i64>| {
        let mut stack = vec![key];
        while let Some(k) = stack.pop() {
            if gone.insert(k) {
                stack.extend(snapshot.children(k).map(|c| c.key));
            }
        }
    };
    let join_tokens = state.backend.get_join_tokens(pi.key).await?;
    for t in terminates {
        if gone.contains(&t.key) {
            continue;
        }
        let Some(ei) = snapshot.get(t.key) else {
            // An element instance of another process instance: Zeebe terminates it.
            doomed.push(t.key);
            continue;
        };
        subtree(ei.key, &mut gone);
        doomed.push(ei.key);
        let mut current = ei.flow_scope_key;
        while let Some(scope_key) = current {
            let Some(scope) = snapshot.get(scope_key) else { break };
            if gone.contains(&scope_key) || required.contains(&scope_key) {
                break;
            }
            let busy = snapshot.children(scope_key).any(|c| !gone.contains(&c.key))
                || join_tokens.iter().any(|j| j.flow_scope_key == scope_key)
                || state.backend
                    .has_pending_activation(state.partition_id, position, "flowScopeKey", &scope_key.to_string())
                    .await?;
            if busy {
                break;
            }
            if scope.element_type == "PROCESS" && pi.parent_process_instance_key.is_some() {
                return Err(invalid(format!(
                    "Expected to modify instance of process '{}' but the given instructions would terminate \
                     the instance. The instance was created by a call activity in the parent process. \
                     To terminate this instance please modify the parent process instead.",
                    ctx.bpmn_process_id,
                )));
            }
            gone.insert(scope_key);
            doomed.push(scope_key);
            current = scope.flow_scope_key;
        }
    }
    Ok(doomed)
}
