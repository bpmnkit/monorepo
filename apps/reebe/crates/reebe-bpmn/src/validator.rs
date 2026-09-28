use crate::model::*;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error, Clone)]
pub enum ValidationError {
    #[error("Process '{process_id}': {message}")]
    ProcessError { process_id: String, message: String },

    #[error("Element '{element_id}' in process '{process_id}': {message}")]
    ElementError {
        process_id: String,
        element_id: String,
        message: String,
    },
}

/// Validate a BPMN process against Zeebe's validation rules.
/// Returns a list of validation errors (empty if valid).
pub fn validate_bpmn(process: &BpmnProcess) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    validate_process(process, &mut errors);

    errors
}

fn validate_process(process: &BpmnProcess, errors: &mut Vec<ValidationError>) {
    let pid = &process.id;

    // Must have at least one start event
    if process.start_events.is_empty() {
        errors.push(ValidationError::ProcessError {
            process_id: pid.clone(),
            message: "Process must have at least one start event".to_string(),
        });
    }

    // Validate each element
    for (element_id, element) in &process.elements {
        validate_element(pid, element_id, element, process, errors);
    }

    // Validate sequence flows; those of an unsupported element are reported with it.
    for flow in &process.sequence_flows {
        let unsupported = process.unsupported_elements.iter().any(|el| el.id == flow.source_ref || el.id == flow.target_ref);
        if !unsupported {
            validate_sequence_flow(pid, flow, process, errors);
        }
    }

    // Zeebe rejects the elements it does not execute.
    for el in &process.unsupported_elements {
        errors.push(ValidationError::ElementError {
            process_id: pid.clone(),
            element_id: el.id.clone(),
            message: format!(
                "Elements of type '{}' are currently not supported. Please refer to the documentation for a list \
                 of supported elements: https://docs.camunda.io/docs/components/modeler/bpmn/bpmn-coverage/",
                model_type_name(&el.element_type),
            ),
        });
    }

    validate_scope(pid, &process.elements, errors);
}

/// The name Zeebe's validator gives an element type: its model interface's simple
/// name, the XML name with a capital (`complexGateway` → `ComplexGateway`).
fn model_type_name(xml_name: &str) -> String {
    let mut chars = xml_name.chars();
    chars.next().map(|first| first.to_uppercase().chain(chars).collect()).unwrap_or_default()
}

/// Checks that apply to each scope — the process and every sub-process in it.
fn validate_scope(process_id: &str, elements: &HashMap<String, FlowElement>, errors: &mut Vec<ValidationError>) {
    validate_links(process_id, elements, errors);
    validate_compensation(process_id, elements, errors);
    for el in elements.values() {
        if let FlowElement::SubProcess(sp) = el {
            validate_scope(process_id, &sp.elements, errors);
        }
    }
}

/// Link events pair up by name within one scope: every link throw event needs a link
/// catch event of its name, and a name belongs to one catch event only.
fn validate_links(process_id: &str, elements: &HashMap<String, FlowElement>, errors: &mut Vec<ValidationError>) {
    let mut catches: HashMap<&str, Vec<&str>> = HashMap::new();
    for el in elements.values() {
        if let FlowElement::IntermediateCatchEvent(e) = el {
            if let Some(EventDefinition::Link(name)) = &e.event_definition {
                catches.entry(name.as_str()).or_default().push(e.id.as_str());
            }
        }
    }
    let mut duplicated: Vec<(&str, Vec<&str>)> = catches
        .iter()
        .filter(|(_, ids)| ids.len() > 1)
        .map(|(name, ids)| (*name, ids.clone()))
        .collect();
    duplicated.sort();
    for (name, mut ids) in duplicated {
        ids.sort();
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: ids[1].to_string(),
            message: format!(
                "Multiple intermediate catch link event definitions with the same name '{name}' are not allowed."
            ),
        });
    }
    for el in elements.values() {
        let (id, def) = match el {
            FlowElement::IntermediateThrowEvent(e) => (&e.id, &e.event_definition),
            FlowElement::IntermediateCatchEvent(e) => (&e.id, &e.event_definition),
            _ => continue,
        };
        let Some(EventDefinition::Link(name)) = def else { continue };
        if name.trim().is_empty() {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: id.clone(),
                message: "Link name must be present and not empty.".to_string(),
            });
        } else if matches!(el, FlowElement::IntermediateThrowEvent(_)) && !catches.contains_key(name.as_str()) {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: id.clone(),
                message: format!("Can't find an catch link event for the throw link event with the name '{name}'."),
            });
        }
    }
}

/// A compensation throw event's `activityRef` names an activity of its own scope that
/// has a compensation boundary event. An event sub-process cannot start with a
/// compensation event: Zeebe does not support compensation start events.
fn validate_compensation(process_id: &str, elements: &HashMap<String, FlowElement>, errors: &mut Vec<ValidationError>) {
    let has_compensation_boundary = |activity: &str| {
        elements.values().any(|e| matches!(
            e,
            FlowElement::BoundaryEvent(be)
                if be.attached_to_ref == activity && matches!(be.event_definition, Some(EventDefinition::Compensation(_)))
        ))
    };
    for el in elements.values() {
        let (id, def) = match el {
            FlowElement::IntermediateThrowEvent(e) => (&e.id, &e.event_definition),
            FlowElement::EndEvent(e) => (&e.id, &e.event_definition),
            FlowElement::SubProcess(sp) if sp.triggered_by_event => {
                for start in &sp.start_events {
                    if let Some(FlowElement::StartEvent(se)) = sp.elements.get(start) {
                        if matches!(se.event_definition, Some(EventDefinition::Compensation(_))) {
                            errors.push(ValidationError::ElementError {
                                process_id: process_id.to_string(),
                                element_id: se.id.clone(),
                                message: "The start event of an event sub-process must be a timer, message, \
                                          error, signal or escalation event; compensation start events are not supported"
                                    .to_string(),
                            });
                        }
                    }
                }
                continue;
            }
            _ => continue,
        };
        let Some(EventDefinition::Compensation(CompensationEventDefinition { activity_ref: Some(activity) })) = def else {
            continue;
        };
        if !elements.get(activity).is_some_and(FlowElement::is_activity) || !has_compensation_boundary(activity) {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: id.clone(),
                message: format!(
                    "The compensation activityRef '{activity}' must reference an activity with a compensation \
                     boundary event in the same scope as the compensation throw event"
                ),
            });
        }
    }
}

fn validate_element(
    process_id: &str,
    element_id: &str,
    element: &FlowElement,
    process: &BpmnProcess,
    errors: &mut Vec<ValidationError>,
) {
    match element {
        FlowElement::ServiceTask(task) => {
            validate_service_task(process_id, element_id, task, errors);
        }
        FlowElement::UserTask(task) => {
            validate_user_task(process_id, element_id, task, errors);
        }
        FlowElement::CallActivity(ca) => {
            validate_call_activity(process_id, element_id, ca, errors);
        }
        FlowElement::StartEvent(ev) => {
            validate_start_event(process_id, element_id, ev, errors);
        }
        FlowElement::EndEvent(ev) => {
            validate_end_event(process_id, element_id, ev, errors);
        }
        FlowElement::IntermediateCatchEvent(ev) => {
            validate_intermediate_catch_event(process_id, element_id, ev, errors);
        }
        FlowElement::BoundaryEvent(ev) => {
            validate_boundary_event(process_id, element_id, ev, process, errors);
        }
        FlowElement::ExclusiveGateway(gw) => {
            validate_exclusive_gateway(process_id, element_id, gw, process, errors);
        }
        FlowElement::SubProcess(sp) => {
            validate_subprocess(process_id, element_id, sp, errors);
        }
        _ => {}
    }

    // Check isolated elements (no incoming and no outgoing, except start/end events)
    let is_start = matches!(element, FlowElement::StartEvent(_));
    let is_end = matches!(element, FlowElement::EndEvent(_));
    let is_boundary = matches!(element, FlowElement::BoundaryEvent(_));
    // An event sub-process is started by its event, not by a sequence flow.
    let is_event_subprocess = matches!(element, FlowElement::SubProcess(sp) if sp.triggered_by_event);
    // A compensation handler is linked to its boundary event by an association.
    let is_handler = element.is_for_compensation();

    if !is_start && !is_end && !is_boundary && !is_event_subprocess && !is_handler {
        let has_incoming = process.sequence_flows.iter().any(|f| f.target_ref == *element_id);
        let has_outgoing = process.sequence_flows.iter().any(|f| f.source_ref == *element_id);

        if !has_incoming && !has_outgoing && process.elements.len() > 1 {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Element is isolated (not connected to any other element)".to_string(),
            });
        }
    }
}

fn validate_service_task(
    process_id: &str,
    element_id: &str,
    task: &ServiceTask,
    errors: &mut Vec<ValidationError>,
) {
    if task.task_definition.is_none() {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: element_id.to_string(),
            message: "Service task must have a zeebe:taskDefinition extension element".to_string(),
        });
        return;
    }

    let def = task.task_definition.as_ref().unwrap();
    if def.job_type.is_empty() {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: element_id.to_string(),
            message: "Service task job type must not be empty".to_string(),
        });
    }

    validate_io_mappings(process_id, element_id, &task.input_mappings, &task.output_mappings, errors);
    validate_multi_instance(process_id, element_id, &task.multi_instance, errors);
}

fn validate_user_task(
    process_id: &str,
    element_id: &str,
    task: &UserTask,
    errors: &mut Vec<ValidationError>,
) {
    // User task should have a form definition or user task form (not strictly required but recommended)
    // We won't make this a hard error to allow bare user tasks in development
    validate_io_mappings(process_id, element_id, &task.input_mappings, &task.output_mappings, errors);
    validate_multi_instance(process_id, element_id, &task.multi_instance, errors);
}

fn validate_call_activity(
    process_id: &str,
    element_id: &str,
    ca: &CallActivity,
    errors: &mut Vec<ValidationError>,
) {
    if ca.called_element.is_none() {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: element_id.to_string(),
            message: "Call activity must have a zeebe:calledElement extension element".to_string(),
        });
        return;
    }

    let called = ca.called_element.as_ref().unwrap();
    if called.process_id.is_empty() {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: element_id.to_string(),
            message: "Call activity calledElement processId must not be empty".to_string(),
        });
    }

    validate_io_mappings(process_id, element_id, &ca.input_mappings, &ca.output_mappings, errors);
}

fn validate_start_event(
    process_id: &str,
    element_id: &str,
    ev: &StartEvent,
    errors: &mut Vec<ValidationError>,
) {
    if let Some(EventDefinition::Timer(timer)) = &ev.event_definition {
        validate_timer_definition(process_id, element_id, timer, errors);
    }
    if let Some(EventDefinition::Message(msg)) = &ev.event_definition {
        if msg.message_name.is_empty() {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Message start event must reference a message with a name".to_string(),
            });
        }
    }
}

fn validate_end_event(
    _process_id: &str,
    _element_id: &str,
    ev: &EndEvent,
    _errors: &mut Vec<ValidationError>,
) {
    if let Some(EventDefinition::Error(err)) = &ev.event_definition {
        // Error end events should have an error code
        if err.error_code.as_ref().map_or(true, |c| c.is_empty()) {
            // Warning only - not a hard validation error in Zeebe
        }
    }
}

fn validate_intermediate_catch_event(
    process_id: &str,
    element_id: &str,
    ev: &IntermediateCatchEvent,
    errors: &mut Vec<ValidationError>,
) {
    match &ev.event_definition {
        None => {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Intermediate catch event must have an event definition".to_string(),
            });
        }
        Some(EventDefinition::Timer(timer)) => {
            validate_timer_definition(process_id, element_id, timer, errors);
        }
        Some(EventDefinition::Message(msg)) => {
            if msg.message_name.is_empty() {
                errors.push(ValidationError::ElementError {
                    process_id: process_id.to_string(),
                    element_id: element_id.to_string(),
                    message: "Message catch event must reference a message with a name".to_string(),
                });
            }
        }
        _ => {}
    }
}

fn validate_boundary_event(
    process_id: &str,
    element_id: &str,
    ev: &BoundaryEvent,
    process: &BpmnProcess,
    errors: &mut Vec<ValidationError>,
) {
    // Boundary event must reference an existing element
    if !process.elements.contains_key(&ev.attached_to_ref) {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: element_id.to_string(),
            message: format!(
                "Boundary event references non-existent element '{}'",
                ev.attached_to_ref
            ),
        });
    }

    match &ev.event_definition {
        None => {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Boundary event must have an event definition".to_string(),
            });
        }
        Some(EventDefinition::Timer(timer)) => {
            validate_timer_definition(process_id, element_id, timer, errors);
        }
        Some(EventDefinition::Message(msg)) => {
            if msg.message_name.is_empty() {
                errors.push(ValidationError::ElementError {
                    process_id: process_id.to_string(),
                    element_id: element_id.to_string(),
                    message: "Message boundary event must reference a message with a name".to_string(),
                });
            }
        }
        _ => {}
    }
}

fn validate_exclusive_gateway(
    process_id: &str,
    element_id: &str,
    gw: &Gateway,
    process: &BpmnProcess,
    errors: &mut Vec<ValidationError>,
) {
    if gw.outgoing.len() <= 1 {
        return; // No need to validate single-exit gateways
    }

    let default_flow = &gw.default_flow;
    for flow_id in &gw.outgoing {
        let is_default = default_flow.as_ref().map_or(false, |d| d == flow_id);
        if is_default {
            continue;
        }
        let flow = process.sequence_flows.iter().find(|f| &f.id == flow_id);
        if let Some(flow) = flow {
            if flow.condition_expression.is_none() {
                errors.push(ValidationError::ElementError {
                    process_id: process_id.to_string(),
                    element_id: element_id.to_string(),
                    message: format!(
                        "Exclusive gateway outgoing flow '{}' must have a condition expression (unless it's the default flow)",
                        flow_id
                    ),
                });
            }
        }
    }
}

fn validate_subprocess(
    process_id: &str,
    element_id: &str,
    sp: &SubProcess,
    errors: &mut Vec<ValidationError>,
) {
    // An ad-hoc sub-process activates its elements directly; it has no start event.
    if sp.start_events.is_empty() && !sp.ad_hoc {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: element_id.to_string(),
            message: "Sub-process must have at least one start event".to_string(),
        });
    }
    validate_multi_instance(process_id, element_id, &sp.multi_instance, errors);
}

fn validate_timer_definition(
    process_id: &str,
    element_id: &str,
    timer: &TimerEventDefinition,
    errors: &mut Vec<ValidationError>,
) {
    if timer.expression.is_empty() {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: element_id.to_string(),
            message: "Timer event must have a time expression".to_string(),
        });
    }
}

fn validate_io_mappings(
    process_id: &str,
    element_id: &str,
    inputs: &[ZeebeIoMapping],
    outputs: &[ZeebeIoMapping],
    errors: &mut Vec<ValidationError>,
) {
    for mapping in inputs {
        if mapping.source.is_empty() {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Input mapping source expression must not be empty".to_string(),
            });
        }
        if mapping.target.is_empty() {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Input mapping target must not be empty".to_string(),
            });
        }
    }

    for mapping in outputs {
        if mapping.source.is_empty() {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Output mapping source expression must not be empty".to_string(),
            });
        }
        if mapping.target.is_empty() {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Output mapping target must not be empty".to_string(),
            });
        }
    }
}

fn validate_multi_instance(
    process_id: &str,
    element_id: &str,
    mi: &Option<MultiInstanceLoopCharacteristics>,
    errors: &mut Vec<ValidationError>,
) {
    if let Some(mi) = mi {
        if mi.input_collection.is_empty() {
            errors.push(ValidationError::ElementError {
                process_id: process_id.to_string(),
                element_id: element_id.to_string(),
                message: "Multi-instance loop: inputCollection expression must not be empty".to_string(),
            });
        }
    }
}

fn validate_sequence_flow(
    process_id: &str,
    flow: &SequenceFlow,
    process: &BpmnProcess,
    errors: &mut Vec<ValidationError>,
) {
    if !process.elements.contains_key(&flow.source_ref) {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: flow.id.clone(),
            message: format!("Sequence flow references non-existent source '{}'", flow.source_ref),
        });
    }
    if !process.elements.contains_key(&flow.target_ref) {
        errors.push(ValidationError::ElementError {
            process_id: process_id.to_string(),
            element_id: flow.id.clone(),
            message: format!("Sequence flow references non-existent target '{}'", flow.target_ref),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse_bpmn;

    const VALID_PROCESS: &str = r#"<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0">
  <bpmn:process id="valid-process" isExecutable="true">
    <bpmn:startEvent id="Start"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="Task1">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="my-job"/>
      </bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="End"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start" targetRef="Task1"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task1" targetRef="End"/>
  </bpmn:process>
</bpmn:definitions>"#;

    const INVALID_PROCESS_NO_TASK_DEF: &str = r#"<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="invalid-process" isExecutable="true">
    <bpmn:startEvent id="Start"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="Task1">
      <bpmn:incoming>F1</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="End"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start" targetRef="Task1"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task1" targetRef="End"/>
  </bpmn:process>
</bpmn:definitions>"#;

    #[test]
    fn test_valid_process_no_errors() {
        let processes = parse_bpmn(VALID_PROCESS).unwrap();
        let errors = validate_bpmn(&processes[0]);
        assert!(errors.is_empty(), "Expected no errors, got: {:?}", errors);
    }

    #[test]
    fn test_service_task_without_task_definition() {
        let processes = parse_bpmn(INVALID_PROCESS_NO_TASK_DEF).unwrap();
        let errors = validate_bpmn(&processes[0]);
        assert!(!errors.is_empty(), "Expected validation errors for missing task definition");
        assert!(errors.iter().any(|e| e.to_string().contains("taskDefinition")));
    }

    #[test]
    fn test_process_without_start_event() {
        let mut process = BpmnProcess::new("test");
        let end = EndEvent::new("End");
        process.elements.insert("End".to_string(), FlowElement::EndEvent(end));
        let errors = validate_bpmn(&process);
        assert!(errors.iter().any(|e| e.to_string().contains("start event")));
    }

    #[test]
    fn test_exclusive_gateway_without_conditions() {
        let xml = r#"<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="gw-process" isExecutable="true">
    <bpmn:startEvent id="Start"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:exclusiveGateway id="GW1">
      <bpmn:incoming>F1</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
      <bpmn:outgoing>F3</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="End1"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="End2"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start" targetRef="GW1"/>
    <bpmn:sequenceFlow id="F2" sourceRef="GW1" targetRef="End1"/>
    <bpmn:sequenceFlow id="F3" sourceRef="GW1" targetRef="End2"/>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let errors = validate_bpmn(&processes[0]);
        assert!(!errors.is_empty(), "Expected validation errors for gateway without conditions");
    }
}
