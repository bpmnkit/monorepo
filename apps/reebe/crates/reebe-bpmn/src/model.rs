use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A complete parsed BPMN process definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BpmnProcess {
    pub id: String,
    pub name: Option<String>,
    pub is_executable: bool,
    pub elements: HashMap<String, FlowElement>,
    pub sequence_flows: Vec<SequenceFlow>,
    /// IDs of start events
    pub start_events: Vec<String>,
    /// IDs of end events
    pub end_events: Vec<String>,
    /// Associations directly in the process, such as the one linking a compensation
    /// boundary event to its handler.
    #[serde(default)]
    pub associations: Vec<Association>,
    /// Elements Zeebe does not execute (e.g. a complex gateway), which fail deployment.
    #[serde(default)]
    pub unsupported_elements: Vec<UnsupportedElement>,
}

impl BpmnProcess {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            is_executable: true,
            elements: HashMap::new(),
            sequence_flows: Vec::new(),
            start_events: Vec::new(),
            end_events: Vec::new(),
            associations: Vec::new(),
            unsupported_elements: Vec::new(),
        }
    }

    pub fn get_element(&self, id: &str) -> Option<&FlowElement> {
        self.elements.get(id)
    }

    /// Like `get_element`, but also searches recursively inside embedded subprocesses.
    pub fn get_element_recursive(&self, id: &str) -> Option<&FlowElement> {
        if let Some(e) = self.elements.get(id) {
            return Some(e);
        }
        for e in self.elements.values() {
            if let FlowElement::SubProcess(sp) = e {
                if let Some(found) = sp.find_element(id) {
                    return Some(found);
                }
            }
        }
        None
    }

    pub fn outgoing_flows(&self, element_id: &str) -> Vec<&SequenceFlow> {
        self.sequence_flows.iter().filter(|f| f.source_ref == element_id).collect()
    }

    /// Like `outgoing_flows`, but also searches inside embedded subprocesses.
    pub fn outgoing_flows_recursive(&self, element_id: &str) -> Vec<&SequenceFlow> {
        fn search<'a>(
            flows: &'a [SequenceFlow],
            elements: &'a HashMap<String, FlowElement>,
            element_id: &str,
        ) -> Vec<&'a SequenceFlow> {
            let here: Vec<&SequenceFlow> = flows.iter().filter(|f| f.source_ref == element_id).collect();
            if !here.is_empty() {
                return here;
            }
            for e in elements.values() {
                if let FlowElement::SubProcess(sp) = e {
                    let inner = search(&sp.sequence_flows, &sp.elements, element_id);
                    if !inner.is_empty() {
                        return inner;
                    }
                }
            }
            vec![]
        }
        search(&self.sequence_flows, &self.elements, element_id)
    }

    pub fn incoming_flows(&self, element_id: &str) -> Vec<&SequenceFlow> {
        self.sequence_flows.iter().filter(|f| f.target_ref == element_id).collect()
    }

    /// The elements and associations of the scope (the process, or a sub-process at
    /// any depth) that directly contains `element_id`.
    pub fn scope_of(&self, element_id: &str) -> Option<(&HashMap<String, FlowElement>, &[Association])> {
        fn search<'a>(
            elements: &'a HashMap<String, FlowElement>,
            associations: &'a [Association],
            id: &str,
        ) -> Option<(&'a HashMap<String, FlowElement>, &'a [Association])> {
            if elements.contains_key(id) {
                return Some((elements, associations));
            }
            elements.values().find_map(|e| match e {
                FlowElement::SubProcess(sp) => search(&sp.elements, &sp.associations, id),
                _ => None,
            })
        }
        search(&self.elements, &self.associations, element_id)
    }

    /// The link catch event a link throw event continues at: the catch event with
    /// the same link name in the throw event's scope.
    pub fn link_catch_event(&self, throw_id: &str) -> Option<&str> {
        let (elements, _) = self.scope_of(throw_id)?;
        let name = match elements.get(throw_id)? {
            FlowElement::IntermediateThrowEvent(e) => match &e.event_definition {
                Some(EventDefinition::Link(name)) => name,
                _ => return None,
            },
            _ => return None,
        };
        elements.values().find_map(|e| match e {
            FlowElement::IntermediateCatchEvent(c)
                if matches!(&c.event_definition, Some(EventDefinition::Link(n)) if n == name) =>
            {
                Some(c.id.as_str())
            }
            _ => None,
        })
    }

    /// The compensation handler of `activity_id`: the activity that an association
    /// links to the compensation boundary event attached to it.
    pub fn compensation_handler(&self, activity_id: &str) -> Option<&str> {
        let (elements, _) = self.scope_of(activity_id)?;
        let boundary = elements.values().find_map(|e| match e {
            FlowElement::BoundaryEvent(be)
                if be.attached_to_ref == activity_id
                    && matches!(be.event_definition, Some(EventDefinition::Compensation(_))) =>
            {
                Some(be.id.as_str())
            }
            _ => None,
        })?;
        // Modelers put an association in the scope of either end, so look everywhere.
        fn all<'a>(elements: &'a HashMap<String, FlowElement>, out: &mut Vec<&'a Association>) {
            for e in elements.values() {
                if let FlowElement::SubProcess(sp) = e {
                    out.extend(sp.associations.iter());
                    all(&sp.elements, out);
                }
            }
        }
        let mut associations: Vec<&Association> = self.associations.iter().collect();
        all(&self.elements, &mut associations);
        associations.into_iter().find_map(|a| {
            if a.source_ref == boundary {
                Some(a.target_ref.as_str())
            } else if a.target_ref == boundary {
                Some(a.source_ref.as_str())
            } else {
                None
            }
        })
    }
}

/// A BPMN association between two elements.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Association {
    pub id: String,
    pub source_ref: String,
    pub target_ref: String,
}

/// An element that Zeebe does not execute and rejects at deployment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnsupportedElement {
    pub id: String,
    /// The BPMN element name, e.g. `complexGateway`.
    pub element_type: String,
}

/// All BPMN flow element types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FlowElement {
    StartEvent(StartEvent),
    EndEvent(EndEvent),
    ServiceTask(ServiceTask),
    UserTask(UserTask),
    ReceiveTask(ReceiveTask),
    ScriptTask(ScriptTask),
    SendTask(SendTask),
    BusinessRuleTask(BusinessRuleTask),
    CallActivity(CallActivity),
    SubProcess(SubProcess),
    ParallelGateway(Gateway),
    ExclusiveGateway(Gateway),
    InclusiveGateway(Gateway),
    EventBasedGateway(Gateway),
    IntermediateCatchEvent(IntermediateCatchEvent),
    IntermediateThrowEvent(IntermediateThrowEvent),
    BoundaryEvent(BoundaryEvent),
}

impl FlowElement {
    pub fn id(&self) -> &str {
        match self {
            FlowElement::StartEvent(e) => &e.id,
            FlowElement::EndEvent(e) => &e.id,
            FlowElement::ServiceTask(e) => &e.id,
            FlowElement::UserTask(e) => &e.id,
            FlowElement::ReceiveTask(e) => &e.id,
            FlowElement::ScriptTask(e) => &e.id,
            FlowElement::SendTask(e) => &e.id,
            FlowElement::BusinessRuleTask(e) => &e.id,
            FlowElement::CallActivity(e) => &e.id,
            FlowElement::SubProcess(e) => &e.id,
            FlowElement::ParallelGateway(e) => &e.id,
            FlowElement::ExclusiveGateway(e) => &e.id,
            FlowElement::InclusiveGateway(e) => &e.id,
            FlowElement::EventBasedGateway(e) => &e.id,
            FlowElement::IntermediateCatchEvent(e) => &e.id,
            FlowElement::IntermediateThrowEvent(e) => &e.id,
            FlowElement::BoundaryEvent(e) => &e.id,
        }
    }

    pub fn name(&self) -> Option<&str> {
        match self {
            FlowElement::StartEvent(e) => e.name.as_deref(),
            FlowElement::EndEvent(e) => e.name.as_deref(),
            FlowElement::ServiceTask(e) => e.name.as_deref(),
            FlowElement::UserTask(e) => e.name.as_deref(),
            FlowElement::ReceiveTask(e) => e.name.as_deref(),
            FlowElement::ScriptTask(e) => e.name.as_deref(),
            FlowElement::SendTask(e) => e.name.as_deref(),
            FlowElement::BusinessRuleTask(e) => e.name.as_deref(),
            FlowElement::CallActivity(e) => e.name.as_deref(),
            FlowElement::SubProcess(e) => e.name.as_deref(),
            FlowElement::ParallelGateway(e) => e.name.as_deref(),
            FlowElement::ExclusiveGateway(e) => e.name.as_deref(),
            FlowElement::InclusiveGateway(e) => e.name.as_deref(),
            FlowElement::EventBasedGateway(e) => e.name.as_deref(),
            FlowElement::IntermediateCatchEvent(e) => e.name.as_deref(),
            FlowElement::IntermediateThrowEvent(e) => e.name.as_deref(),
            FlowElement::BoundaryEvent(e) => e.name.as_deref(),
        }
    }

    pub fn outgoing(&self) -> &[String] {
        match self {
            FlowElement::StartEvent(e) => &e.outgoing,
            FlowElement::EndEvent(e) => &e.incoming, // EndEvent has no outgoing
            FlowElement::ServiceTask(e) => &e.outgoing,
            FlowElement::UserTask(e) => &e.outgoing,
            FlowElement::ReceiveTask(e) => &e.outgoing,
            FlowElement::ScriptTask(e) => &e.outgoing,
            FlowElement::SendTask(e) => &e.outgoing,
            FlowElement::BusinessRuleTask(e) => &e.outgoing,
            FlowElement::CallActivity(e) => &e.outgoing,
            FlowElement::SubProcess(e) => &e.outgoing,
            FlowElement::ParallelGateway(e) => &e.outgoing,
            FlowElement::ExclusiveGateway(e) => &e.outgoing,
            FlowElement::InclusiveGateway(e) => &e.outgoing,
            FlowElement::EventBasedGateway(e) => &e.outgoing,
            FlowElement::IntermediateCatchEvent(e) => &e.outgoing,
            FlowElement::IntermediateThrowEvent(e) => &e.outgoing,
            FlowElement::BoundaryEvent(e) => &e.outgoing,
        }
    }

    /// The multi-instance loop characteristics of an activity, if it has them.
    pub fn multi_instance(&self) -> Option<&MultiInstanceLoopCharacteristics> {
        match self {
            FlowElement::ServiceTask(e) => e.multi_instance.as_ref(),
            FlowElement::UserTask(e) => e.multi_instance.as_ref(),
            FlowElement::ReceiveTask(e) => e.multi_instance.as_ref(),
            FlowElement::ScriptTask(e) => e.multi_instance.as_ref(),
            FlowElement::SendTask(e) => e.multi_instance.as_ref(),
            FlowElement::BusinessRuleTask(e) => e.multi_instance.as_ref(),
            FlowElement::CallActivity(e) => e.multi_instance.as_ref(),
            FlowElement::SubProcess(e) => e.multi_instance.as_ref(),
            _ => None,
        }
    }

    /// Whether this activity is a compensation handler (`isForCompensation`).
    pub fn is_for_compensation(&self) -> bool {
        match self {
            FlowElement::ServiceTask(e) => e.is_for_compensation,
            FlowElement::UserTask(e) => e.is_for_compensation,
            FlowElement::ReceiveTask(e) => e.is_for_compensation,
            FlowElement::ScriptTask(e) => e.is_for_compensation,
            FlowElement::SendTask(e) => e.is_for_compensation,
            FlowElement::BusinessRuleTask(e) => e.is_for_compensation,
            FlowElement::CallActivity(e) => e.is_for_compensation,
            FlowElement::SubProcess(e) => e.is_for_compensation,
            _ => false,
        }
    }

    /// Whether this is an activity (a task, sub-process or call activity), the
    /// elements boundary events attach to.
    pub fn is_activity(&self) -> bool {
        matches!(
            self,
            FlowElement::ServiceTask(_)
                | FlowElement::UserTask(_)
                | FlowElement::ReceiveTask(_)
                | FlowElement::ScriptTask(_)
                | FlowElement::SendTask(_)
                | FlowElement::BusinessRuleTask(_)
                | FlowElement::CallActivity(_)
                | FlowElement::SubProcess(_)
        )
    }

    pub fn bpmn_element_type(&self) -> &'static str {
        match self {
            FlowElement::StartEvent(_) => "START_EVENT",
            FlowElement::EndEvent(_) => "END_EVENT",
            FlowElement::ServiceTask(_) => "SERVICE_TASK",
            FlowElement::UserTask(_) => "USER_TASK",
            FlowElement::ReceiveTask(_) => "RECEIVE_TASK",
            FlowElement::ScriptTask(_) => "SCRIPT_TASK",
            FlowElement::SendTask(_) => "SEND_TASK",
            FlowElement::BusinessRuleTask(_) => "BUSINESS_RULE_TASK",
            FlowElement::CallActivity(_) => "CALL_ACTIVITY",
            FlowElement::SubProcess(sp) if sp.triggered_by_event => "EVENT_SUB_PROCESS",
            FlowElement::SubProcess(sp) if sp.ad_hoc => "AD_HOC_SUB_PROCESS",
            FlowElement::SubProcess(_) => "SUB_PROCESS",
            FlowElement::ParallelGateway(_) => "PARALLEL_GATEWAY",
            FlowElement::ExclusiveGateway(_) => "EXCLUSIVE_GATEWAY",
            FlowElement::InclusiveGateway(_) => "INCLUSIVE_GATEWAY",
            FlowElement::EventBasedGateway(_) => "EVENT_BASED_GATEWAY",
            FlowElement::IntermediateCatchEvent(_) => "INTERMEDIATE_CATCH_EVENT",
            FlowElement::IntermediateThrowEvent(_) => "INTERMEDIATE_THROW_EVENT",
            FlowElement::BoundaryEvent(_) => "BOUNDARY_EVENT",
        }
    }
}

/// Sequence flow connecting two flow elements.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceFlow {
    pub id: String,
    pub name: Option<String>,
    pub source_ref: String,
    pub target_ref: String,
    /// FEEL expression for conditional flows (exclusive/inclusive gateways)
    pub condition_expression: Option<String>,
    pub is_default: bool,
}

// ---- Flow element types ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartEvent {
    pub id: String,
    pub name: Option<String>,
    pub outgoing: Vec<String>,
    pub event_definition: Option<EventDefinition>,
    pub interrupting: bool,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub execution_listeners: Vec<ZeebeExecutionListener>,
}

impl StartEvent {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            outgoing: Vec::new(),
            event_definition: None,
            interrupting: true,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            execution_listeners: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndEvent {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub event_definition: Option<EventDefinition>,
    pub execution_listeners: Vec<ZeebeExecutionListener>,
}

impl EndEvent {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            event_definition: None,
            execution_listeners: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceTask {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub task_definition: Option<ZeebeTaskDefinition>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub execution_listeners: Vec<ZeebeExecutionListener>,
    pub multi_instance: Option<MultiInstanceLoopCharacteristics>,
    /// `isForCompensation`: a compensation handler, run only by a compensation throw event.
    #[serde(default)]
    pub is_for_compensation: bool,
}

impl ServiceTask {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            task_definition: None,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            execution_listeners: Vec::new(),
            multi_instance: None,
            is_for_compensation: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserTask {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub assignee: Option<String>,
    pub candidate_groups: Option<String>,
    pub candidate_users: Option<String>,
    pub due_date: Option<String>,
    pub follow_up_date: Option<String>,
    pub form_definition: Option<ZeebeFormDefinition>,
    pub user_task_form: Option<ZeebeUserTaskForm>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub execution_listeners: Vec<ZeebeExecutionListener>,
    pub task_listeners: Vec<ZeebeTaskListener>,
    pub multi_instance: Option<MultiInstanceLoopCharacteristics>,
    pub priority: Option<String>,
    /// `isForCompensation`: a compensation handler, run only by a compensation throw event.
    #[serde(default)]
    pub is_for_compensation: bool,
}

impl UserTask {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            assignee: None,
            candidate_groups: None,
            candidate_users: None,
            due_date: None,
            follow_up_date: None,
            form_definition: None,
            user_task_form: None,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            execution_listeners: Vec::new(),
            task_listeners: Vec::new(),
            multi_instance: None,
            priority: None,
            is_for_compensation: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiveTask {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub message_ref: Option<String>,
    /// Name of the referenced message, resolved from `message_ref`.
    pub message_name: Option<String>,
    /// Correlation key from the referenced message's `zeebe:subscription`.
    pub correlation_key: Option<String>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub multi_instance: Option<MultiInstanceLoopCharacteristics>,
    /// `isForCompensation`: a compensation handler, run only by a compensation throw event.
    #[serde(default)]
    pub is_for_compensation: bool,
}

impl ReceiveTask {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            message_ref: None,
            message_name: None,
            correlation_key: None,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            multi_instance: None,
            is_for_compensation: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptTask {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub script: Option<String>,
    pub result_variable: Option<String>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub multi_instance: Option<MultiInstanceLoopCharacteristics>,
    /// `isForCompensation`: a compensation handler, run only by a compensation throw event.
    #[serde(default)]
    pub is_for_compensation: bool,
}

impl ScriptTask {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            script: None,
            result_variable: None,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            multi_instance: None,
            is_for_compensation: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendTask {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub task_definition: Option<ZeebeTaskDefinition>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub multi_instance: Option<MultiInstanceLoopCharacteristics>,
    /// `isForCompensation`: a compensation handler, run only by a compensation throw event.
    #[serde(default)]
    pub is_for_compensation: bool,
}

impl SendTask {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            task_definition: None,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            multi_instance: None,
            is_for_compensation: false,
        }
    }
}

/// A business rule task that evaluates a DMN decision.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessRuleTask {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    /// The Zeebe-specific decision ID to call (from `zeebe:calledDecision`)
    pub zeebe_called_decision_id: Option<String>,
    /// Optional result variable name
    pub zeebe_result_variable: Option<String>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub multi_instance: Option<MultiInstanceLoopCharacteristics>,
    /// `isForCompensation`: a compensation handler, run only by a compensation throw event.
    #[serde(default)]
    pub is_for_compensation: bool,
}

impl BusinessRuleTask {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            zeebe_called_decision_id: None,
            zeebe_result_variable: None,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            multi_instance: None,
            is_for_compensation: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallActivity {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub called_element: Option<ZeebeCalledElement>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub multi_instance: Option<MultiInstanceLoopCharacteristics>,
    /// `isForCompensation`: a compensation handler, run only by a compensation throw event.
    #[serde(default)]
    pub is_for_compensation: bool,
}

impl CallActivity {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            called_element: None,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            multi_instance: None,
            is_for_compensation: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubProcess {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub triggered_by_event: bool,
    pub elements: HashMap<String, FlowElement>,
    pub sequence_flows: Vec<SequenceFlow>,
    pub start_events: Vec<String>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
    pub multi_instance: Option<MultiInstanceLoopCharacteristics>,
    /// `bpmn:adHocSubProcess`.
    #[serde(default)]
    pub ad_hoc: bool,
    /// Job worker implementation of an ad-hoc sub-process (e.g. the AI Agent connector).
    #[serde(default)]
    pub task_definition: Option<ZeebeTaskDefinition>,
    /// Associations directly inside the sub-process.
    #[serde(default)]
    pub associations: Vec<Association>,
    /// Ad-hoc sub-process: `zeebe:adHoc activeElementsCollection`, the FEEL expression
    /// listing the inner elements to activate.
    #[serde(default)]
    pub active_elements_collection: Option<String>,
    /// Ad-hoc sub-process: `completionCondition`.
    #[serde(default)]
    pub completion_condition: Option<String>,
    /// Ad-hoc sub-process: `cancelRemainingInstances` (default `true`).
    #[serde(default = "default_true")]
    pub cancel_remaining_instances: bool,
    /// Ad-hoc sub-process: `zeebe:adHoc outputCollection`.
    #[serde(default)]
    pub output_collection: Option<String>,
    /// Ad-hoc sub-process: `zeebe:adHoc outputElement`.
    #[serde(default)]
    pub output_element: Option<String>,
    /// `isForCompensation`: a compensation handler, run only by a compensation throw event.
    #[serde(default)]
    pub is_for_compensation: bool,
}

impl SubProcess {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            triggered_by_event: false,
            elements: HashMap::new(),
            sequence_flows: Vec::new(),
            start_events: Vec::new(),
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
            multi_instance: None,
            ad_hoc: false,
            task_definition: None,
            associations: Vec::new(),
            active_elements_collection: None,
            completion_condition: None,
            cancel_remaining_instances: true,
            output_collection: None,
            output_element: None,
            is_for_compensation: false,
        }
    }

    /// Find an element by ID, recursively searching nested subprocesses.
    pub fn find_element(&self, id: &str) -> Option<&FlowElement> {
        if let Some(e) = self.elements.get(id) {
            return Some(e);
        }
        for e in self.elements.values() {
            if let FlowElement::SubProcess(nested) = e {
                if let Some(found) = nested.find_element(id) {
                    return Some(found);
                }
            }
        }
        None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gateway {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub default_flow: Option<String>,
}

impl Gateway {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            default_flow: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntermediateCatchEvent {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub event_definition: Option<EventDefinition>,
    pub input_mappings: Vec<ZeebeIoMapping>,
    pub output_mappings: Vec<ZeebeIoMapping>,
}

impl IntermediateCatchEvent {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            event_definition: None,
            input_mappings: Vec::new(),
            output_mappings: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntermediateThrowEvent {
    pub id: String,
    pub name: Option<String>,
    pub incoming: Vec<String>,
    pub outgoing: Vec<String>,
    pub event_definition: Option<EventDefinition>,
}

impl IntermediateThrowEvent {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            incoming: Vec::new(),
            outgoing: Vec::new(),
            event_definition: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundaryEvent {
    pub id: String,
    pub name: Option<String>,
    pub outgoing: Vec<String>,
    pub attached_to_ref: String,
    pub cancel_activity: bool,
    pub event_definition: Option<EventDefinition>,
    pub output_mappings: Vec<ZeebeIoMapping>,
}

impl BoundaryEvent {
    pub fn new(id: impl Into<String>, attached_to: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            outgoing: Vec::new(),
            attached_to_ref: attached_to.into(),
            cancel_activity: true,
            event_definition: None,
            output_mappings: Vec::new(),
        }
    }
}

// ---- Event definitions ----

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EventDefinition {
    Timer(TimerEventDefinition),
    Message(MessageEventDefinition),
    Signal(SignalEventDefinition),
    Error(ErrorEventDefinition),
    Escalation(EscalationEventDefinition),
    Compensation(CompensationEventDefinition),
    /// A link event, by link name.
    Link(String),
    Terminate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerEventDefinition {
    pub timer_type: TimerType,
    /// FEEL expression or ISO 8601 duration/date/cycle
    pub expression: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimerType {
    Duration,
    Date,
    Cycle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageEventDefinition {
    /// The message name (may be a FEEL expression)
    pub message_name: String,
    /// Correlation key expression (from ZeebeSubscription extension)
    pub correlation_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalEventDefinition {
    pub signal_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEventDefinition {
    pub error_code: Option<String>,
    pub error_message_variable: Option<String>,
    pub error_code_variable: Option<String>,
}

/// A compensation event. On a throw event, `activity_ref` limits compensation to one
/// activity of the throw event's scope.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompensationEventDefinition {
    pub activity_ref: Option<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscalationEventDefinition {
    pub escalation_code: Option<String>,
}

// ---- Zeebe extension elements ----

/// Defines the job type and retry count for service tasks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeebeTaskDefinition {
    pub job_type: String,
    /// FEEL expression for retry count (default: "3")
    pub retries: String,
    pub timeout: Option<String>,
}

/// Input or output variable mapping using FEEL expressions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeebeIoMapping {
    /// Source FEEL expression
    pub source: String,
    /// Target variable name
    pub target: String,
}

/// References an external form for a user task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeebeFormDefinition {
    pub form_key: Option<String>,
    pub external_reference: Option<String>,
}

/// References an embedded form in the deployment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeebeUserTaskForm {
    pub form_key: String,
    pub body: Option<String>,
}

/// Defines the process to call from a call activity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeebeCalledElement {
    pub process_id: String,
    pub propagate_all_child_variables: bool,
}

/// Message correlation key subscription.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeebeSubscription {
    pub correlation_key: String,
}

/// Execution listener (pre/post hooks on elements).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeebeExecutionListener {
    pub event_type: ExecutionListenerEventType,
    pub job_type: String,
    pub retries: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExecutionListenerEventType {
    Start,
    End,
}

/// Task listener for user tasks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeebeTaskListener {
    pub event_type: String,
    pub job_type: String,
    pub retries: String,
}

/// Multi-instance loop characteristics for tasks/subprocesses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiInstanceLoopCharacteristics {
    pub is_sequential: bool,
    pub input_collection: String,
    pub input_element: Option<String>,
    pub output_collection: Option<String>,
    pub output_element: Option<String>,
    pub completion_condition: Option<String>,
}
