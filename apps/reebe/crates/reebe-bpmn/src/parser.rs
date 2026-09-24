use crate::model::*;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use std::collections::HashMap;
use thiserror::Error;

pub const ZEEBE_NS: &str = "http://camunda.org/schema/zeebe/1.0";
pub const BPMN_NS: &str = "http://www.omg.org/spec/BPMN/20100524/MODEL";

#[derive(Debug, Error)]
pub enum BpmnParseError {
    #[error("XML parse error: {0}")]
    XmlError(String),

    #[error("Missing required attribute '{attr}' on element '{element}'")]
    MissingAttribute { element: String, attr: String },

    #[error("Invalid BPMN structure: {0}")]
    InvalidStructure(String),
}

impl From<quick_xml::Error> for BpmnParseError {
    fn from(e: quick_xml::Error) -> Self {
        BpmnParseError::XmlError(e.to_string())
    }
}

impl From<quick_xml::events::attributes::AttrError> for BpmnParseError {
    fn from(e: quick_xml::events::attributes::AttrError) -> Self {
        BpmnParseError::XmlError(e.to_string())
    }
}

/// Root declarations that event definitions refer to by id.
#[derive(Default)]
struct PrescanRefs {
    messages: HashMap<String, String>,         // message id -> name
    signals: HashMap<String, String>,          // signal id -> name
    message_keys: HashMap<String, String>,     // message id -> correlation key
    error_codes: HashMap<String, String>,      // error id -> errorCode
    escalation_codes: HashMap<String, String>, // escalation id -> escalationCode
}

/// Pre-scan XML for `<bpmn:message>`, `<bpmn:signal>`, `<bpmn:error>` and
/// `<bpmn:escalation>` declarations so that forward references (event definitions
/// appearing before the declaration) are resolved.
///
/// Also collects the `zeebe:subscription` correlation key a root `<bpmn:message>`
/// carries — where Camunda Modeler and Web Modeler put it — keyed by message id.
fn prescan_refs(xml: &str) -> PrescanRefs {
    let mut refs = PrescanRefs::default();
    let PrescanRefs { messages, signals, message_keys, error_codes, escalation_codes } = &mut refs;
    let mut current_message: Option<String> = None;
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(ref event @ (Event::Start(ref e) | Event::Empty(ref e))) => {
                let name = local_name_owned(e.name().as_ref());
                match name.as_str() {
                    "message" => {
                        let id = get_attr(e, "id");
                        if let (Some(id), Some(n)) = (id.clone(), get_attr(e, "name")) {
                            messages.insert(id, n);
                        }
                        // Only a `<message>` with children can hold a subscription; a
                        // self-closing one has no end event to clear the marker with.
                        if matches!(event, Event::Start(_)) {
                            current_message = id;
                        }
                    }
                    "subscription" => {
                        if let (Some(id), Some(key)) =
                            (current_message.as_ref(), get_attr(e, "correlationKey"))
                        {
                            message_keys.insert(id.clone(), key);
                        }
                    }
                    "signal" => {
                        if let (Some(id), Some(n)) = (get_attr(e, "id"), get_attr(e, "name")) {
                            signals.insert(id, n);
                        }
                    }
                    "error" => {
                        if let (Some(id), Some(code)) = (get_attr(e, "id"), get_attr(e, "errorCode")) {
                            error_codes.insert(id, code);
                        }
                    }
                    "escalation" => {
                        if let (Some(id), Some(code)) =
                            (get_attr(e, "id"), get_attr(e, "escalationCode"))
                        {
                            escalation_codes.insert(id, code);
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                if local_name_owned(e.name().as_ref()) == "message" {
                    current_message = None;
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    refs
}

/// Parse a BPMN 2.0 XML string and return all process definitions.
pub fn parse_bpmn(xml: &str) -> Result<Vec<BpmnProcess>, BpmnParseError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut processes: Vec<BpmnProcess> = Vec::new();

    // Pre-scan to resolve forward references for messages and signals
    let refs = prescan_refs(xml);

    // We use a stateful parser with a stack
    let mut parser_state = ParserState::new();
    parser_state.messages = refs.messages;
    parser_state.signals = refs.signals;
    parser_state.message_keys = refs.message_keys;
    parser_state.error_codes = refs.error_codes;
    parser_state.escalation_codes = refs.escalation_codes;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name_bytes = e.name().as_ref().to_vec();
                let name = local_name_owned(&name_bytes);
                parser_state.handle_start(&name, e, &reader)?;
            }
            Ok(Event::Empty(ref e)) => {
                let name_bytes = e.name().as_ref().to_vec();
                let name = local_name_owned(&name_bytes);
                parser_state.handle_empty(&name, e, &reader)?;
            }
            Ok(Event::End(ref e)) => {
                let name_bytes = e.name().as_ref().to_vec();
                let name = local_name_owned(&name_bytes);
                if let Some(process) = parser_state.handle_end(&name)? {
                    processes.push(process);
                }
            }
            Ok(Event::Text(ref e)) => {
                let text = e
                    .unescape()
                    .map(|s| s.into_owned())
                    .unwrap_or_default();
                parser_state.handle_text(&text);
            }
            Ok(Event::CData(ref e)) => {
                // bpmn-js and other editors may wrap condition expressions and
                // other text content in CDATA sections. Treat them identically
                // to plain text nodes.
                let text = String::from_utf8_lossy(e.as_ref()).into_owned();
                parser_state.handle_text(&text);
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(BpmnParseError::XmlError(e.to_string())),
            _ => {}
        }
        buf.clear();
    }

    Ok(processes)
}

fn local_name(name: &[u8]) -> &str {
    let s = std::str::from_utf8(name).unwrap_or("");
    // Strip namespace prefix if present
    if let Some(pos) = s.rfind(':') {
        &s[pos + 1..]
    } else {
        s
    }
}

fn local_name_owned(name: &[u8]) -> String {
    local_name(name).to_string()
}

fn get_attr(
    e: &quick_xml::events::BytesStart,
    name: &str,
) -> Option<String> {
    e.attributes()
        .filter_map(|a| a.ok())
        .find(|a| {
            let key = std::str::from_utf8(a.key.as_ref()).unwrap_or("");
            let local = if let Some(pos) = key.rfind(':') { &key[pos + 1..] } else { key };
            local == name
        })
        .and_then(|a| {
            a.unescape_value()
                .ok()
                .map(|v| v.into_owned())
        })
}

fn get_required_attr(
    e: &quick_xml::events::BytesStart,
    element: &str,
    attr: &str,
) -> Result<String, BpmnParseError> {
    get_attr(e, attr).ok_or_else(|| BpmnParseError::MissingAttribute {
        element: element.to_string(),
        attr: attr.to_string(),
    })
}

#[derive(Debug)]
enum ParseContext {
    Root,
    Process(BpmnProcess),
    ServiceTask(ServiceTask),
    UserTask(UserTask),
    ReceiveTask(ReceiveTask),
    ScriptTask(ScriptTask),
    SendTask(SendTask),
    BusinessRuleTask(BusinessRuleTask),
    CallActivity(CallActivity),
    SubProcess(SubProcess),
    // For gateways, we store the type alongside the gateway
    ExclusiveGateway(Gateway),
    ParallelGateway(Gateway),
    InclusiveGateway(Gateway),
    EventBasedGateway(Gateway),
    StartEvent(StartEvent),
    EndEvent(EndEvent),
    IntermediateCatchEvent(IntermediateCatchEvent),
    IntermediateThrowEvent(IntermediateThrowEvent),
    BoundaryEvent(BoundaryEvent),
    // Extension elements context
    ExtensionElements,
}

struct ParserState {
    stack: Vec<ParseContext>,
    // Messages referenced in the process
    messages: HashMap<String, String>, // id -> name
    // Signals referenced in the process
    signals: HashMap<String, String>, // id -> name
    // Correlation keys declared on root messages
    message_keys: HashMap<String, String>, // message id -> correlation key
    // Codes of root errors and escalations, so a definition's ref resolves to its code
    error_codes: HashMap<String, String>,
    escalation_codes: HashMap<String, String>,
    // Event subscription key seen before the event's message definition
    pending_correlation_key: Option<String>,
    // Current text content (for CDATA elements)
    current_text: String,
    // Pending event definition being built
    pending_event_def: Option<EventDefinition>,
}

impl ParserState {
    fn new() -> Self {
        Self {
            stack: vec![ParseContext::Root],
            messages: HashMap::new(),
            signals: HashMap::new(),
            message_keys: HashMap::new(),
            error_codes: HashMap::new(),
            escalation_codes: HashMap::new(),
            pending_correlation_key: None,
            current_text: String::new(),
            pending_event_def: None,
        }
    }

    /// The `errorCode` of the `<bpmn:error>` an `errorRef` names; the ref itself
    /// when the error declares no code.
    fn error_code(&self, error_ref: Option<String>) -> Option<String> {
        error_ref.map(|r| self.error_codes.get(&r).cloned().unwrap_or(r))
    }

    /// The `escalationCode` of the `<bpmn:escalation>` an `escalationRef` names.
    fn escalation_code(&self, escalation_ref: Option<String>) -> Option<String> {
        escalation_ref.map(|r| self.escalation_codes.get(&r).cloned().unwrap_or(r))
    }

    fn current_process(&mut self) -> Option<&mut BpmnProcess> {
        for ctx in self.stack.iter_mut().rev() {
            if let ParseContext::Process(p) = ctx {
                return Some(p);
            }
        }
        None
    }

    /// Add a regular (non-start, non-end) flow element to the nearest enclosing
    /// SubProcess or Process scope.
    fn add_element_to_scope(&mut self, id: String, element: FlowElement) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::SubProcess(sp) => { sp.elements.insert(id, element); return; }
                ParseContext::Process(p) => { p.elements.insert(id, element); return; }
                _ => {}
            }
        }
    }

    /// Add a start event to the nearest enclosing SubProcess or Process scope,
    /// registering it in start_events.
    fn add_start_event_to_scope(&mut self, id: String, element: FlowElement) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::SubProcess(sp) => {
                    sp.start_events.push(id.clone());
                    sp.elements.insert(id, element);
                    return;
                }
                ParseContext::Process(p) => {
                    p.start_events.push(id.clone());
                    p.elements.insert(id, element);
                    return;
                }
                _ => {}
            }
        }
    }

    /// Add an end event to the nearest enclosing SubProcess or Process scope.
    fn add_end_event_to_scope(&mut self, id: String, element: FlowElement) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::SubProcess(sp) => {
                    sp.elements.insert(id, element);
                    return;
                }
                ParseContext::Process(p) => {
                    p.end_events.push(id.clone());
                    p.elements.insert(id, element);
                    return;
                }
                _ => {}
            }
        }
    }

    fn handle_start(
        &mut self,
        name: &str,
        e: &quick_xml::events::BytesStart,
        _reader: &Reader<&[u8]>,
    ) -> Result<(), BpmnParseError> {
        match name {
            "message" => {
                if let (Some(id), Some(msg_name)) = (get_attr(e, "id"), get_attr(e, "name")) {
                    self.messages.insert(id, msg_name);
                }
            }
            "signal" => {
                if let (Some(id), Some(sig_name)) = (get_attr(e, "id"), get_attr(e, "name")) {
                    self.signals.insert(id, sig_name);
                }
            }
            "process" => {
                let id = get_required_attr(e, "process", "id")?;
                let mut process = BpmnProcess::new(id);
                process.name = get_attr(e, "name");
                process.is_executable = get_attr(e, "isExecutable")
                    .map(|v| v != "false")
                    .unwrap_or(true);
                self.stack.push(ParseContext::Process(process));
            }
            "startEvent" => {
                let id = get_required_attr(e, "startEvent", "id")?;
                let mut ev = StartEvent::new(id);
                ev.name = get_attr(e, "name");
                ev.interrupting = get_attr(e, "isInterrupting")
                    .map(|v| v != "false")
                    .unwrap_or(true);
                self.stack.push(ParseContext::StartEvent(ev));
            }
            "endEvent" => {
                let id = get_required_attr(e, "endEvent", "id")?;
                let mut ev = EndEvent::new(id);
                ev.name = get_attr(e, "name");
                self.stack.push(ParseContext::EndEvent(ev));
            }
            "serviceTask" => {
                let id = get_required_attr(e, "serviceTask", "id")?;
                let mut task = ServiceTask::new(id);
                task.name = get_attr(e, "name");
                self.stack.push(ParseContext::ServiceTask(task));
            }
            "userTask" => {
                let id = get_required_attr(e, "userTask", "id")?;
                let mut task = UserTask::new(id);
                task.name = get_attr(e, "name");
                self.stack.push(ParseContext::UserTask(task));
            }
            "receiveTask" => {
                let id = get_required_attr(e, "receiveTask", "id")?;
                let mut task = ReceiveTask::new(id);
                task.name = get_attr(e, "name");
                task.message_ref = get_attr(e, "messageRef");
                if let Some(r) = task.message_ref.as_ref() {
                    task.message_name = self.messages.get(r).cloned();
                    task.correlation_key = self.message_keys.get(r).cloned();
                }
                self.stack.push(ParseContext::ReceiveTask(task));
            }
            "scriptTask" => {
                let id = get_required_attr(e, "scriptTask", "id")?;
                let mut task = ScriptTask::new(id);
                task.name = get_attr(e, "name");
                self.stack.push(ParseContext::ScriptTask(task));
            }
            "sendTask" => {
                let id = get_required_attr(e, "sendTask", "id")?;
                let mut task = SendTask::new(id);
                task.name = get_attr(e, "name");
                self.stack.push(ParseContext::SendTask(task));
            }
            "businessRuleTask" => {
                let id = get_required_attr(e, "businessRuleTask", "id")?;
                let mut task = BusinessRuleTask::new(id);
                task.name = get_attr(e, "name");
                self.stack.push(ParseContext::BusinessRuleTask(task));
            }
            "callActivity" => {
                let id = get_required_attr(e, "callActivity", "id")?;
                let mut ca = CallActivity::new(id);
                ca.name = get_attr(e, "name");
                self.stack.push(ParseContext::CallActivity(ca));
            }
            "subProcess" | "adHocSubProcess" => {
                let id = get_required_attr(e, name, "id")?;
                let mut sp = SubProcess::new(id);
                sp.name = get_attr(e, "name");
                sp.ad_hoc = name == "adHocSubProcess";
                sp.triggered_by_event = get_attr(e, "triggeredByEvent")
                    .map(|v| v == "true")
                    .unwrap_or(false);
                self.stack.push(ParseContext::SubProcess(sp));
            }
            "exclusiveGateway" => {
                let id = get_required_attr(e, "exclusiveGateway", "id")?;
                let mut gw = Gateway::new(id);
                gw.name = get_attr(e, "name");
                gw.default_flow = get_attr(e, "default");
                self.stack.push(ParseContext::ExclusiveGateway(gw));
            }
            "parallelGateway" => {
                let id = get_required_attr(e, "parallelGateway", "id")?;
                let mut gw = Gateway::new(id);
                gw.name = get_attr(e, "name");
                self.stack.push(ParseContext::ParallelGateway(gw));
            }
            "inclusiveGateway" => {
                let id = get_required_attr(e, "inclusiveGateway", "id")?;
                let mut gw = Gateway::new(id);
                gw.name = get_attr(e, "name");
                gw.default_flow = get_attr(e, "default");
                self.stack.push(ParseContext::InclusiveGateway(gw));
            }
            "eventBasedGateway" => {
                let id = get_required_attr(e, "eventBasedGateway", "id")?;
                let mut gw = Gateway::new(id);
                gw.name = get_attr(e, "name");
                self.stack.push(ParseContext::EventBasedGateway(gw));
            }
            "intermediateCatchEvent" => {
                let id = get_required_attr(e, "intermediateCatchEvent", "id")?;
                let mut ev = IntermediateCatchEvent::new(id);
                ev.name = get_attr(e, "name");
                self.stack.push(ParseContext::IntermediateCatchEvent(ev));
            }
            "intermediateThrowEvent" => {
                let id = get_required_attr(e, "intermediateThrowEvent", "id")?;
                let mut ev = IntermediateThrowEvent::new(id);
                ev.name = get_attr(e, "name");
                self.stack.push(ParseContext::IntermediateThrowEvent(ev));
            }
            "boundaryEvent" => {
                let id = get_required_attr(e, "boundaryEvent", "id")?;
                let attached = get_required_attr(e, "boundaryEvent", "attachedToRef")?;
                let mut ev = BoundaryEvent::new(id, attached);
                ev.name = get_attr(e, "name");
                ev.cancel_activity = get_attr(e, "cancelActivity")
                    .map(|v| v != "false")
                    .unwrap_or(true);
                self.stack.push(ParseContext::BoundaryEvent(ev));
            }
            "extensionElements" => {
                self.stack.push(ParseContext::ExtensionElements);
            }
            "timerEventDefinition" => {
                self.pending_event_def = Some(EventDefinition::Timer(TimerEventDefinition {
                    timer_type: TimerType::Duration,
                    expression: String::new(),
                }));
            }
            "messageEventDefinition" => {
                let msg_ref = get_attr(e, "messageRef");
                let msg_name = msg_ref
                    .as_ref()
                    .and_then(|r| self.messages.get(r))
                    .cloned()
                    .unwrap_or_default();
                // A subscription on the event itself wins over the message's own.
                let correlation_key = self.pending_correlation_key.take()
                    .or_else(|| msg_ref.as_ref().and_then(|r| self.message_keys.get(r)).cloned());
                self.pending_event_def = Some(EventDefinition::Message(MessageEventDefinition {
                    message_name: msg_name,
                    correlation_key,
                }));
            }
            "signalEventDefinition" => {
                let signal_ref = get_attr(e, "signalRef");
                let signal_name = signal_ref
                    .as_ref()
                    .and_then(|r| self.signals.get(r))
                    .cloned()
                    .or(signal_ref)
                    .unwrap_or_default();
                self.pending_event_def = Some(EventDefinition::Signal(SignalEventDefinition {
                    signal_name,
                }));
            }
            "errorEventDefinition" => {
                let error_ref = get_attr(e, "errorRef");
                self.pending_event_def = Some(EventDefinition::Error(ErrorEventDefinition {
                    error_code: self.error_code(error_ref),
                    error_message_variable: None,
                    error_code_variable: None,
                }));
            }
            "escalationEventDefinition" => {
                let escalation_ref = get_attr(e, "escalationRef");
                self.pending_event_def = Some(EventDefinition::Escalation(EscalationEventDefinition {
                    escalation_code: self.escalation_code(escalation_ref),
                }));
            }
            "terminateEventDefinition" => {
                self.pending_event_def = Some(EventDefinition::Terminate);
            }
            "compensateEventDefinition" => {
                self.pending_event_def = Some(EventDefinition::Compensation);
            }
            // A sequenceFlow with child elements (e.g. conditionExpression) arrives as
            // a Start event rather than Empty. Handle it identically to the Empty case so
            // that the flow is registered immediately; conditionExpression is applied
            // later by apply_last_flow_condition in handle_end.
            "sequenceFlow" => {
                let id = get_required_attr(e, "sequenceFlow", "id")?;
                let source = get_required_attr(e, "sequenceFlow", "sourceRef")?;
                let target = get_required_attr(e, "sequenceFlow", "targetRef")?;
                let flow = SequenceFlow {
                    id,
                    name: get_attr(e, "name"),
                    source_ref: source,
                    target_ref: target,
                    condition_expression: None,
                    is_default: false,
                };
                self.add_sequence_flow(flow);
            }
            _ => {}
        }
        Ok(())
    }

    fn handle_empty(
        &mut self,
        name: &str,
        e: &quick_xml::events::BytesStart,
        _reader: &Reader<&[u8]>,
    ) -> Result<(), BpmnParseError> {
        match name {
            "message" => {
                if let (Some(id), Some(msg_name)) = (get_attr(e, "id"), get_attr(e, "name")) {
                    self.messages.insert(id, msg_name);
                }
            }
            "signal" => {
                if let (Some(id), Some(sig_name)) = (get_attr(e, "id"), get_attr(e, "name")) {
                    self.signals.insert(id, sig_name);
                }
            }
            "incoming" | "outgoing" => {}
            "sequenceFlow" => {
                let id = get_required_attr(e, "sequenceFlow", "id")?;
                let source = get_required_attr(e, "sequenceFlow", "sourceRef")?;
                let target = get_required_attr(e, "sequenceFlow", "targetRef")?;
                let flow = SequenceFlow {
                    id,
                    name: get_attr(e, "name"),
                    source_ref: source,
                    target_ref: target,
                    condition_expression: None,
                    is_default: false,
                };
                // Add to current process or subprocess
                self.add_sequence_flow(flow);
            }

            // Zeebe extension elements
            "taskDefinition" => {
                let job_type = get_attr(e, "type").unwrap_or_default();
                let retries = get_attr(e, "retries").unwrap_or_else(|| "3".to_string());
                let timeout = get_attr(e, "timeout");
                let def = ZeebeTaskDefinition { job_type, retries, timeout };
                self.apply_task_definition(def);
            }
            "input" => {
                let source = get_attr(e, "source").unwrap_or_default();
                let target = get_attr(e, "target").unwrap_or_default();
                let mapping = ZeebeIoMapping { source, target };
                self.apply_input_mapping(mapping);
            }
            "output" => {
                let source = get_attr(e, "source").unwrap_or_default();
                let target = get_attr(e, "target").unwrap_or_default();
                let mapping = ZeebeIoMapping { source, target };
                self.apply_output_mapping(mapping);
            }
            "calledElement" => {
                let process_id = get_attr(e, "processId").unwrap_or_default();
                let propagate = get_attr(e, "propagateAllChildVariablesEnabled")
                    .map(|v| v == "true")
                    .unwrap_or(false);
                let called = ZeebeCalledElement { process_id, propagate_all_child_variables: propagate };
                self.apply_called_element(called);
            }
            "calledDecision" => {
                let decision_id = get_attr(e, "decisionId");
                let result_variable = get_attr(e, "resultVariable");
                self.apply_called_decision(decision_id, result_variable);
            }
            "script" => {
                let expression = get_attr(e, "expression").unwrap_or_default();
                let result_variable = get_attr(e, "resultVariable");
                self.apply_script(expression, result_variable);
            }
            "subscription" => {
                let correlation_key = get_attr(e, "correlationKey").unwrap_or_default();
                self.apply_subscription_correlation_key(correlation_key);
            }
            "formDefinition" => {
                let form_key = get_attr(e, "formKey");
                let external_reference = get_attr(e, "externalReference");
                let def = ZeebeFormDefinition { form_key, external_reference };
                self.apply_form_definition(def);
            }
            "assignmentDefinition" => {
                let assignee = get_attr(e, "assignee");
                let candidate_groups = get_attr(e, "candidateGroups");
                let candidate_users = get_attr(e, "candidateUsers");
                self.apply_assignment_definition(assignee, candidate_groups, candidate_users);
            }
            "taskSchedule" => {
                let due_date = get_attr(e, "dueDate");
                let follow_up = get_attr(e, "followUpDate");
                self.apply_task_schedule(due_date, follow_up);
            }
            "executionListener" => {
                let event_type_str = get_attr(e, "eventType").unwrap_or_else(|| "start".to_string());
                let event_type = if event_type_str == "end" {
                    ExecutionListenerEventType::End
                } else {
                    ExecutionListenerEventType::Start
                };
                let job_type = get_attr(e, "type").unwrap_or_default();
                let retries = get_attr(e, "retries").unwrap_or_else(|| "3".to_string());
                let listener = ZeebeExecutionListener { event_type, job_type, retries };
                self.apply_execution_listener(listener);
            }
            "taskListener" => {
                let event_type = get_attr(e, "eventType").unwrap_or_else(|| "create".to_string());
                let job_type = get_attr(e, "type").unwrap_or_default();
                let retries = get_attr(e, "retries").unwrap_or_else(|| "3".to_string());
                let listener = ZeebeTaskListener { event_type, job_type, retries };
                self.apply_task_listener(listener);
            }
            "loopCharacteristics" => {
                let is_sequential = get_attr(e, "isSequential")
                    .map(|v| v == "true")
                    .unwrap_or(false);
                let input_collection = get_attr(e, "inputCollection").unwrap_or_default();
                let input_element = get_attr(e, "inputElement");
                let output_collection = get_attr(e, "outputCollection");
                let output_element = get_attr(e, "outputElement");
                let completion_condition = get_attr(e, "completionCondition");
                let mi = MultiInstanceLoopCharacteristics {
                    is_sequential,
                    input_collection,
                    input_element,
                    output_collection,
                    output_element,
                    completion_condition,
                };
                self.apply_multi_instance(mi);
            }
            "timerEventDefinition" => {
                self.pending_event_def = Some(EventDefinition::Timer(TimerEventDefinition {
                    timer_type: TimerType::Duration,
                    expression: String::new(),
                }));
                self.finalize_event_definition();
            }
            "messageEventDefinition" => {
                let msg_ref = get_attr(e, "messageRef");
                let msg_name = msg_ref
                    .as_ref()
                    .and_then(|r| self.messages.get(r))
                    .cloned()
                    .unwrap_or_default();
                // A subscription on the event itself wins over the message's own.
                let correlation_key = self.pending_correlation_key.take()
                    .or_else(|| msg_ref.as_ref().and_then(|r| self.message_keys.get(r)).cloned());
                self.pending_event_def = Some(EventDefinition::Message(MessageEventDefinition {
                    message_name: msg_name,
                    correlation_key,
                }));
                self.finalize_event_definition();
            }
            "signalEventDefinition" => {
                let signal_ref = get_attr(e, "signalRef");
                let signal_name = signal_ref
                    .as_ref()
                    .and_then(|r| self.signals.get(r))
                    .cloned()
                    .or(signal_ref)
                    .unwrap_or_default();
                self.pending_event_def = Some(EventDefinition::Signal(SignalEventDefinition {
                    signal_name,
                }));
                self.finalize_event_definition();
            }
            "errorEventDefinition" => {
                self.pending_event_def = Some(EventDefinition::Error(ErrorEventDefinition {
                    error_code: self.error_code(get_attr(e, "errorRef")),
                    error_message_variable: None,
                    error_code_variable: None,
                }));
                self.finalize_event_definition();
            }
            "escalationEventDefinition" => {
                self.pending_event_def = Some(EventDefinition::Escalation(EscalationEventDefinition {
                    escalation_code: self.escalation_code(get_attr(e, "escalationRef")),
                }));
                self.finalize_event_definition();
            }
            "terminateEventDefinition" => {
                self.pending_event_def = Some(EventDefinition::Terminate);
                self.finalize_event_definition();
            }
            "compensateEventDefinition" => {
                self.pending_event_def = Some(EventDefinition::Compensation);
                self.finalize_event_definition();
            }
            _ => {}
        }
        Ok(())
    }

    fn handle_text(&mut self, text: &str) {
        self.current_text = text.to_string();
    }

    /// Handle end tag; returns a process if we just finished parsing one.
    fn handle_end(&mut self, name: &str) -> Result<Option<BpmnProcess>, BpmnParseError> {
        match name {
            "timeDuration" | "timeCycle" | "timeDate" => {
                let expr = self.current_text.clone();
                if let Some(EventDefinition::Timer(ref mut timer)) = self.pending_event_def {
                    timer.expression = expr;
                    timer.timer_type = match name {
                        "timeDuration" => TimerType::Duration,
                        "timeCycle" => TimerType::Cycle,
                        "timeDate" => TimerType::Date,
                        _ => TimerType::Duration,
                    };
                }
                self.current_text.clear();
            }
            "conditionExpression" => {
                let expr = self.current_text.clone();
                self.current_text.clear();
                // Apply to the most recently added sequence flow
                self.apply_last_flow_condition(expr);
            }
            "incoming" => {
                let id = self.current_text.clone().trim().to_string();
                self.current_text.clear();
                self.apply_incoming(id);
            }
            "outgoing" => {
                let id = self.current_text.clone().trim().to_string();
                self.current_text.clear();
                self.apply_outgoing(id);
            }
            "sequenceFlow" => {
                // sequenceFlow as a start/end element pair
                // already handled in handle_start + conditionExpression
            }
            "timerEventDefinition" | "messageEventDefinition" | "signalEventDefinition"
            | "errorEventDefinition" | "escalationEventDefinition"
            | "terminateEventDefinition" | "compensateEventDefinition" => {
                self.finalize_event_definition();
            }
            "extensionElements" => {
                // Pop the ExtensionElements context
                if matches!(self.stack.last(), Some(ParseContext::ExtensionElements)) {
                    self.stack.pop();
                }
            }
            "startEvent" => {
                self.pending_correlation_key = None;
                if let Some(ParseContext::StartEvent(ev)) = self.stack.pop() {
                    let id = ev.id.clone();
                    self.add_start_event_to_scope(id, FlowElement::StartEvent(ev));
                }
            }
            "endEvent" => {
                if let Some(ParseContext::EndEvent(ev)) = self.stack.pop() {
                    let id = ev.id.clone();
                    self.add_end_event_to_scope(id, FlowElement::EndEvent(ev));
                }
            }
            "serviceTask" => {
                if let Some(ParseContext::ServiceTask(task)) = self.stack.pop() {
                    let id = task.id.clone();
                    self.add_element_to_scope(id, FlowElement::ServiceTask(task));
                }
            }
            "userTask" => {
                if let Some(ParseContext::UserTask(task)) = self.stack.pop() {
                    let id = task.id.clone();
                    self.add_element_to_scope(id, FlowElement::UserTask(task));
                }
            }
            "receiveTask" => {
                if let Some(ParseContext::ReceiveTask(task)) = self.stack.pop() {
                    let id = task.id.clone();
                    self.add_element_to_scope(id, FlowElement::ReceiveTask(task));
                }
            }
            "scriptTask" => {
                if let Some(ParseContext::ScriptTask(task)) = self.stack.pop() {
                    let id = task.id.clone();
                    self.add_element_to_scope(id, FlowElement::ScriptTask(task));
                }
            }
            "sendTask" => {
                if let Some(ParseContext::SendTask(task)) = self.stack.pop() {
                    let id = task.id.clone();
                    self.add_element_to_scope(id, FlowElement::SendTask(task));
                }
            }
            "businessRuleTask" => {
                if let Some(ParseContext::BusinessRuleTask(task)) = self.stack.pop() {
                    let id = task.id.clone();
                    self.add_element_to_scope(id, FlowElement::BusinessRuleTask(task));
                }
            }
            "callActivity" => {
                if let Some(ParseContext::CallActivity(ca)) = self.stack.pop() {
                    let id = ca.id.clone();
                    self.add_element_to_scope(id, FlowElement::CallActivity(ca));
                }
            }
            "subProcess" | "adHocSubProcess" => {
                if let Some(ParseContext::SubProcess(sp)) = self.stack.pop() {
                    let id = sp.id.clone();
                    self.add_element_to_scope(id, FlowElement::SubProcess(sp));
                }
            }
            "exclusiveGateway" => {
                if let Some(ParseContext::ExclusiveGateway(gw)) = self.stack.pop() {
                    let id = gw.id.clone();
                    self.add_element_to_scope(id, FlowElement::ExclusiveGateway(gw));
                }
            }
            "parallelGateway" => {
                if let Some(ParseContext::ParallelGateway(gw)) = self.stack.pop() {
                    let id = gw.id.clone();
                    self.add_element_to_scope(id, FlowElement::ParallelGateway(gw));
                }
            }
            "inclusiveGateway" => {
                if let Some(ParseContext::InclusiveGateway(gw)) = self.stack.pop() {
                    let id = gw.id.clone();
                    self.add_element_to_scope(id, FlowElement::InclusiveGateway(gw));
                }
            }
            "eventBasedGateway" => {
                if let Some(ParseContext::EventBasedGateway(gw)) = self.stack.pop() {
                    let id = gw.id.clone();
                    self.add_element_to_scope(id, FlowElement::EventBasedGateway(gw));
                }
            }
            "intermediateCatchEvent" => {
                self.pending_correlation_key = None;
                if let Some(ParseContext::IntermediateCatchEvent(ev)) = self.stack.pop() {
                    let id = ev.id.clone();
                    self.add_element_to_scope(id, FlowElement::IntermediateCatchEvent(ev));
                }
            }
            "intermediateThrowEvent" => {
                if let Some(ParseContext::IntermediateThrowEvent(ev)) = self.stack.pop() {
                    let id = ev.id.clone();
                    self.add_element_to_scope(id, FlowElement::IntermediateThrowEvent(ev));
                }
            }
            "boundaryEvent" => {
                self.pending_correlation_key = None;
                if let Some(ParseContext::BoundaryEvent(ev)) = self.stack.pop() {
                    let id = ev.id.clone();
                    self.add_element_to_scope(id, FlowElement::BoundaryEvent(ev));
                }
            }
            "process" => {
                if let Some(ParseContext::Process(mut process)) = self.stack.pop() {
                    // Resolve default flows: find every gateway that has a default_flow
                    // and mark the corresponding sequence flow's is_default flag.
                    let default_flow_ids: Vec<String> = process
                        .elements
                        .values()
                        .filter_map(|el| match el {
                            FlowElement::ExclusiveGateway(gw)
                            | FlowElement::InclusiveGateway(gw) => gw.default_flow.clone(),
                            _ => None,
                        })
                        .collect();
                    for flow in process.sequence_flows.iter_mut() {
                        if default_flow_ids.contains(&flow.id) {
                            flow.is_default = true;
                        }
                    }
                    return Ok(Some(process));
                }
            }
            _ => {}
        }
        Ok(None)
    }

    fn finalize_event_definition(&mut self) {
        if let Some(event_def) = self.pending_event_def.take() {
            // Apply to the innermost event element on the stack
            for ctx in self.stack.iter_mut().rev() {
                match ctx {
                    ParseContext::StartEvent(e) => {
                        e.event_definition = Some(event_def);
                        return;
                    }
                    ParseContext::EndEvent(e) => {
                        e.event_definition = Some(event_def);
                        return;
                    }
                    ParseContext::IntermediateCatchEvent(e) => {
                        e.event_definition = Some(event_def);
                        return;
                    }
                    ParseContext::IntermediateThrowEvent(e) => {
                        e.event_definition = Some(event_def);
                        return;
                    }
                    ParseContext::BoundaryEvent(e) => {
                        e.event_definition = Some(event_def);
                        return;
                    }
                    _ => {}
                }
            }
        }
    }

    fn add_sequence_flow(&mut self, flow: SequenceFlow) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::Process(p) => {
                    p.sequence_flows.push(flow);
                    return;
                }
                ParseContext::SubProcess(sp) => {
                    sp.sequence_flows.push(flow);
                    return;
                }
                _ => {}
            }
        }
    }

    fn apply_last_flow_condition(&mut self, condition: String) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::Process(p) => {
                    if let Some(flow) = p.sequence_flows.last_mut() {
                        flow.condition_expression = Some(condition);
                    }
                    return;
                }
                ParseContext::SubProcess(sp) => {
                    if let Some(flow) = sp.sequence_flows.last_mut() {
                        flow.condition_expression = Some(condition);
                    }
                    return;
                }
                _ => {}
            }
        }
    }

    fn apply_incoming(&mut self, id: String) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::ServiceTask(t) => { t.incoming.push(id); return; }
                ParseContext::UserTask(t) => { t.incoming.push(id); return; }
                ParseContext::ReceiveTask(t) => { t.incoming.push(id); return; }
                ParseContext::ScriptTask(t) => { t.incoming.push(id); return; }
                ParseContext::SendTask(t) => { t.incoming.push(id); return; }
                ParseContext::CallActivity(t) => { t.incoming.push(id); return; }
                ParseContext::SubProcess(t) => { t.incoming.push(id); return; }
                ParseContext::ExclusiveGateway(g) => { g.incoming.push(id); return; }
                ParseContext::ParallelGateway(g) => { g.incoming.push(id); return; }
                ParseContext::InclusiveGateway(g) => { g.incoming.push(id); return; }
                ParseContext::EventBasedGateway(g) => { g.incoming.push(id); return; }
                ParseContext::EndEvent(e) => { e.incoming.push(id); return; }
                ParseContext::IntermediateCatchEvent(e) => { e.incoming.push(id); return; }
                ParseContext::IntermediateThrowEvent(e) => { e.incoming.push(id); return; }
                _ => {}
            }
        }
    }

    fn apply_outgoing(&mut self, id: String) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::StartEvent(e) => { e.outgoing.push(id); return; }
                ParseContext::ServiceTask(t) => { t.outgoing.push(id); return; }
                ParseContext::UserTask(t) => { t.outgoing.push(id); return; }
                ParseContext::ReceiveTask(t) => { t.outgoing.push(id); return; }
                ParseContext::ScriptTask(t) => { t.outgoing.push(id); return; }
                ParseContext::SendTask(t) => { t.outgoing.push(id); return; }
                ParseContext::CallActivity(t) => { t.outgoing.push(id); return; }
                ParseContext::SubProcess(t) => { t.outgoing.push(id); return; }
                ParseContext::ExclusiveGateway(g) => { g.outgoing.push(id); return; }
                ParseContext::ParallelGateway(g) => { g.outgoing.push(id); return; }
                ParseContext::InclusiveGateway(g) => { g.outgoing.push(id); return; }
                ParseContext::EventBasedGateway(g) => { g.outgoing.push(id); return; }
                ParseContext::IntermediateCatchEvent(e) => { e.outgoing.push(id); return; }
                ParseContext::IntermediateThrowEvent(e) => { e.outgoing.push(id); return; }
                ParseContext::BoundaryEvent(e) => { e.outgoing.push(id); return; }
                _ => {}
            }
        }
    }

    fn apply_task_definition(&mut self, def: ZeebeTaskDefinition) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::ServiceTask(t) => { t.task_definition = Some(def); return; }
                ParseContext::SendTask(t) => { t.task_definition = Some(def); return; }
                ParseContext::SubProcess(sp) if sp.ad_hoc => { sp.task_definition = Some(def); return; }
                _ => {}
            }
        }
    }

    fn apply_input_mapping(&mut self, mapping: ZeebeIoMapping) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::ServiceTask(t) => { t.input_mappings.push(mapping); return; }
                ParseContext::UserTask(t) => { t.input_mappings.push(mapping); return; }
                ParseContext::ReceiveTask(t) => { t.input_mappings.push(mapping); return; }
                ParseContext::ScriptTask(t) => { t.input_mappings.push(mapping); return; }
                ParseContext::SendTask(t) => { t.input_mappings.push(mapping); return; }
                ParseContext::CallActivity(t) => { t.input_mappings.push(mapping); return; }
                ParseContext::SubProcess(t) => { t.input_mappings.push(mapping); return; }
                ParseContext::StartEvent(e) => { e.input_mappings.push(mapping); return; }
                ParseContext::IntermediateCatchEvent(e) => { e.input_mappings.push(mapping); return; }
                _ => {}
            }
        }
    }

    fn apply_output_mapping(&mut self, mapping: ZeebeIoMapping) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::ServiceTask(t) => { t.output_mappings.push(mapping); return; }
                ParseContext::UserTask(t) => { t.output_mappings.push(mapping); return; }
                ParseContext::ReceiveTask(t) => { t.output_mappings.push(mapping); return; }
                ParseContext::ScriptTask(t) => { t.output_mappings.push(mapping); return; }
                ParseContext::SendTask(t) => { t.output_mappings.push(mapping); return; }
                ParseContext::CallActivity(t) => { t.output_mappings.push(mapping); return; }
                ParseContext::SubProcess(t) => { t.output_mappings.push(mapping); return; }
                ParseContext::StartEvent(e) => { e.output_mappings.push(mapping); return; }
                ParseContext::IntermediateCatchEvent(e) => { e.output_mappings.push(mapping); return; }
                ParseContext::BoundaryEvent(e) => { e.output_mappings.push(mapping); return; }
                _ => {}
            }
        }
    }

    fn apply_called_element(&mut self, called: ZeebeCalledElement) {
        for ctx in self.stack.iter_mut().rev() {
            if let ParseContext::CallActivity(ca) = ctx {
                ca.called_element = Some(called);
                return;
            }
        }
    }

    fn apply_called_decision(&mut self, decision_id: Option<String>, result_variable: Option<String>) {
        for ctx in self.stack.iter_mut().rev() {
            if let ParseContext::BusinessRuleTask(t) = ctx {
                t.zeebe_called_decision_id = decision_id;
                t.zeebe_result_variable = result_variable;
                return;
            }
        }
    }

    fn apply_script(&mut self, expression: String, result_variable: Option<String>) {
        for ctx in self.stack.iter_mut().rev() {
            if let ParseContext::ScriptTask(t) = ctx {
                t.script = Some(expression);
                t.result_variable = result_variable;
                return;
            }
        }
    }

    fn apply_subscription_correlation_key(&mut self, key: String) {
        if let Some(EventDefinition::Message(ref mut msg)) = self.pending_event_def {
            msg.correlation_key = Some(key);
            return;
        }
        // Also try to find already-applied message event definition
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::StartEvent(e) => {
                    if let Some(EventDefinition::Message(ref mut msg)) = e.event_definition {
                        msg.correlation_key = Some(key);
                    } else {
                        // `extensionElements` usually precede the event definition.
                        self.pending_correlation_key = Some(key);
                    }
                    return;
                }
                ParseContext::IntermediateCatchEvent(e) => {
                    if let Some(EventDefinition::Message(ref mut msg)) = e.event_definition {
                        msg.correlation_key = Some(key);
                    } else {
                        // `extensionElements` usually precede the event definition.
                        self.pending_correlation_key = Some(key);
                    }
                    return;
                }
                ParseContext::BoundaryEvent(e) => {
                    if let Some(EventDefinition::Message(ref mut msg)) = e.event_definition {
                        msg.correlation_key = Some(key);
                    } else {
                        // `extensionElements` usually precede the event definition.
                        self.pending_correlation_key = Some(key);
                    }
                    return;
                }
                _ => {}
            }
        }
    }

    fn apply_form_definition(&mut self, def: ZeebeFormDefinition) {
        for ctx in self.stack.iter_mut().rev() {
            if let ParseContext::UserTask(t) = ctx {
                t.form_definition = Some(def);
                return;
            }
        }
    }

    fn apply_assignment_definition(&mut self, assignee: Option<String>, groups: Option<String>, users: Option<String>) {
        for ctx in self.stack.iter_mut().rev() {
            if let ParseContext::UserTask(t) = ctx {
                t.assignee = assignee;
                t.candidate_groups = groups;
                t.candidate_users = users;
                return;
            }
        }
    }

    fn apply_task_schedule(&mut self, due_date: Option<String>, follow_up: Option<String>) {
        for ctx in self.stack.iter_mut().rev() {
            if let ParseContext::UserTask(t) = ctx {
                t.due_date = due_date;
                t.follow_up_date = follow_up;
                return;
            }
        }
    }

    fn apply_execution_listener(&mut self, listener: ZeebeExecutionListener) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::ServiceTask(t) => { t.execution_listeners.push(listener); return; }
                ParseContext::UserTask(t) => { t.execution_listeners.push(listener); return; }
                ParseContext::StartEvent(e) => { e.execution_listeners.push(listener); return; }
                ParseContext::EndEvent(e) => { e.execution_listeners.push(listener); return; }
                _ => {}
            }
        }
    }

    fn apply_task_listener(&mut self, listener: ZeebeTaskListener) {
        for ctx in self.stack.iter_mut().rev() {
            if let ParseContext::UserTask(t) = ctx {
                t.task_listeners.push(listener);
                return;
            }
        }
    }

    fn apply_multi_instance(&mut self, mi: MultiInstanceLoopCharacteristics) {
        for ctx in self.stack.iter_mut().rev() {
            match ctx {
                ParseContext::ServiceTask(t) => { t.multi_instance = Some(mi); return; }
                ParseContext::UserTask(t) => { t.multi_instance = Some(mi); return; }
                ParseContext::ReceiveTask(t) => { t.multi_instance = Some(mi); return; }
                ParseContext::ScriptTask(t) => { t.multi_instance = Some(mi); return; }
                ParseContext::SendTask(t) => { t.multi_instance = Some(mi); return; }
                ParseContext::CallActivity(t) => { t.multi_instance = Some(mi); return; }
                ParseContext::SubProcess(t) => { t.multi_instance = Some(mi); return; }
                _ => {}
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIMPLE_PROCESS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0">
  <bpmn:process id="simple-process" name="Simple Process" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="ServiceTask_1" name="Do Work">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="my-job" retries="3"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="EndEvent_1">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="ServiceTask_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="ServiceTask_1" targetRef="EndEvent_1"/>
  </bpmn:process>
</bpmn:definitions>"#;

    #[test]
    fn test_parse_simple_process() {
        let processes = parse_bpmn(SIMPLE_PROCESS).unwrap();
        assert_eq!(processes.len(), 1);
        let p = &processes[0];
        assert_eq!(p.id, "simple-process");
        assert_eq!(p.name.as_deref(), Some("Simple Process"));
        assert!(p.is_executable);
        assert_eq!(p.start_events.len(), 1);
        assert_eq!(p.sequence_flows.len(), 2);
        assert!(p.elements.contains_key("ServiceTask_1"));
        assert!(p.elements.contains_key("StartEvent_1"));
        assert!(p.elements.contains_key("EndEvent_1"));
    }

    #[test]
    fn test_parse_service_task_with_job_type() {
        let processes = parse_bpmn(SIMPLE_PROCESS).unwrap();
        let p = &processes[0];
        if let Some(FlowElement::ServiceTask(task)) = p.elements.get("ServiceTask_1") {
            assert!(task.task_definition.is_some());
            let def = task.task_definition.as_ref().unwrap();
            assert_eq!(def.job_type, "my-job");
            assert_eq!(def.retries, "3");
        } else {
            panic!("ServiceTask_1 not found or wrong type");
        }
    }

    #[test]
    fn test_parse_exclusive_gateway() {
        let xml = r#"<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="gw-process" isExecutable="true">
    <bpmn:startEvent id="Start"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:exclusiveGateway id="GW1"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing><bpmn:outgoing>F3</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:endEvent id="End1"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="End2"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start" targetRef="GW1"/>
    <bpmn:sequenceFlow id="F2" sourceRef="GW1" targetRef="End1"/>
    <bpmn:sequenceFlow id="F3" sourceRef="GW1" targetRef="End2"/>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        assert_eq!(processes.len(), 1);
        let gw = processes[0].elements.get("GW1").unwrap();
        assert!(matches!(gw, FlowElement::ExclusiveGateway(_)));
    }

    #[test]
    fn test_parse_condition_expression_cdata() {
        // bpmn-js sometimes wraps condition expressions in CDATA sections.
        // The parser must read CDATA text the same as plain text.
        let xml = "<?xml version=\"1.0\"?>\n\
<bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\">\n\
  <bpmn:process id=\"cdata-proc\" isExecutable=\"true\">\n\
    <bpmn:startEvent id=\"Start\"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>\n\
    <bpmn:exclusiveGateway id=\"GW1\" default=\"F3\">\n\
      <bpmn:incoming>F1</bpmn:incoming>\n\
      <bpmn:outgoing>F2</bpmn:outgoing>\n\
      <bpmn:outgoing>F3</bpmn:outgoing>\n\
    </bpmn:exclusiveGateway>\n\
    <bpmn:endEvent id=\"End1\"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>\n\
    <bpmn:endEvent id=\"End2\"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>\n\
    <bpmn:sequenceFlow id=\"F1\" sourceRef=\"Start\" targetRef=\"GW1\"/>\n\
    <bpmn:sequenceFlow id=\"F2\" sourceRef=\"GW1\" targetRef=\"End1\">\n\
      <bpmn:conditionExpression><![CDATA[= count(validationErrors) = 0]]></bpmn:conditionExpression>\n\
    </bpmn:sequenceFlow>\n\
    <bpmn:sequenceFlow id=\"F3\" sourceRef=\"GW1\" targetRef=\"End2\"/>\n\
  </bpmn:process>\n\
</bpmn:definitions>";
        let processes = parse_bpmn(xml).unwrap();
        let flow_f2 = processes[0].sequence_flows.iter().find(|f| f.id == "F2").unwrap();
        assert_eq!(
            flow_f2.condition_expression.as_deref(),
            Some("= count(validationErrors) = 0"),
            "CDATA condition expression must be read correctly"
        );
    }

    #[test]
    fn test_parse_timer_event() {
        let xml = r#"<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="timer-process" isExecutable="true">
    <bpmn:startEvent id="TimerStart">
      <bpmn:outgoing>F1</bpmn:outgoing>
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration>PT10M</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:startEvent>
    <bpmn:endEvent id="End"><bpmn:incoming>F1</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="TimerStart" targetRef="End"/>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let ev = processes[0].elements.get("TimerStart").unwrap();
        if let FlowElement::StartEvent(se) = ev {
            assert!(matches!(se.event_definition, Some(EventDefinition::Timer(_))));
            if let Some(EventDefinition::Timer(t)) = &se.event_definition {
                assert_eq!(t.expression, "PT10M");
                assert_eq!(t.timer_type, TimerType::Duration);
            }
        } else {
            panic!("Expected StartEvent");
        }
    }

    #[test]
    fn test_message_correlation_keys() {
        // Event-level subscription before the definition; root-message subscription for the
        // receive task and the second catch event.
        let xml = r#"<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0">
  <bpmn:message id="M1" name="go"/>
  <bpmn:message id="M2" name="paid">
    <bpmn:extensionElements><zeebe:subscription correlationKey="=orderId"/></bpmn:extensionElements>
  </bpmn:message>
  <bpmn:process id="p" isExecutable="true">
    <bpmn:intermediateCatchEvent id="A">
      <bpmn:extensionElements><zeebe:subscription correlationKey="=key"/></bpmn:extensionElements>
      <bpmn:messageEventDefinition messageRef="M1"/>
    </bpmn:intermediateCatchEvent>
    <bpmn:intermediateCatchEvent id="B"><bpmn:messageEventDefinition messageRef="M2"/></bpmn:intermediateCatchEvent>
    <bpmn:receiveTask id="R" messageRef="M2"><bpmn:incoming>F</bpmn:incoming></bpmn:receiveTask>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let key_of = |id: &str| match processes[0].elements.get(id).unwrap() {
            FlowElement::IntermediateCatchEvent(e) => match &e.event_definition {
                Some(EventDefinition::Message(m)) => (m.message_name.clone(), m.correlation_key.clone()),
                _ => panic!("expected a message definition on {id}"),
            },
            _ => panic!("expected a catch event {id}"),
        };
        assert_eq!(key_of("A"), ("go".to_string(), Some("=key".to_string())));
        assert_eq!(key_of("B"), ("paid".to_string(), Some("=orderId".to_string())));
        if let FlowElement::ReceiveTask(r) = processes[0].elements.get("R").unwrap() {
            assert_eq!(r.message_name.as_deref(), Some("paid"));
            assert_eq!(r.correlation_key.as_deref(), Some("=orderId"));
        } else {
            panic!("expected a receive task");
        }
    }
}
