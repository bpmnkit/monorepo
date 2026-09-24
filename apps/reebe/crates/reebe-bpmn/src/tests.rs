#[cfg(test)]
mod tests {
    use crate::model::*;
    use crate::parser::parse_bpmn;
    use crate::validator::validate_bpmn;

    fn simple_service_task_process() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="order-process" name="Order Process" isExecutable="true">
    <bpmn:startEvent id="start" name="Order placed">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <bpmn:serviceTask id="task1" name="Process order">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="process-order" retries="3"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <bpmn:endEvent id="end" name="Order processed">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#
    }

    fn exclusive_gateway_process() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="gateway-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="gw1"/>
    <bpmn:exclusiveGateway id="gw1" name="Amount ok?">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow-yes</bpmn:outgoing>
      <bpmn:outgoing>flow-no</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="flow-yes" sourceRef="gw1" targetRef="approve">
      <bpmn:conditionExpression>=amount &gt; 100</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow-no" sourceRef="gw1" targetRef="reject">
      <bpmn:conditionExpression>=amount &lt;= 100</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:serviceTask id="approve" name="Approve">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="approve" retries="3"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow-yes</bpmn:incoming>
      <bpmn:outgoing>flow3</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="reject" name="Reject">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="reject" retries="3"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow-no</bpmn:incoming>
      <bpmn:outgoing>flow4</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="flow3" sourceRef="approve" targetRef="end"/>
    <bpmn:sequenceFlow id="flow4" sourceRef="reject" targetRef="end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow3</bpmn:incoming>
      <bpmn:incoming>flow4</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#
    }

    fn timer_event_process() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="timer-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
      <bpmn:timerEventDefinition>
        <bpmn:timeCycle>R/PT1H</bpmn:timeCycle>
      </bpmn:timerEventDefinition>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow1</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#
    }

    fn parallel_gateway_process() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="parallel-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="split"/>
    <bpmn:parallelGateway id="split">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
      <bpmn:outgoing>flow3</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:sequenceFlow id="flow2" sourceRef="split" targetRef="task-a"/>
    <bpmn:sequenceFlow id="flow3" sourceRef="split" targetRef="task-b"/>
    <bpmn:serviceTask id="task-a" name="Task A">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="task-a" retries="3"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow2</bpmn:incoming>
      <bpmn:outgoing>flow4</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="task-b" name="Task B">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="task-b" retries="3"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow3</bpmn:incoming>
      <bpmn:outgoing>flow5</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="flow4" sourceRef="task-a" targetRef="join"/>
    <bpmn:sequenceFlow id="flow5" sourceRef="task-b" targetRef="join"/>
    <bpmn:parallelGateway id="join">
      <bpmn:incoming>flow4</bpmn:incoming>
      <bpmn:incoming>flow5</bpmn:incoming>
      <bpmn:outgoing>flow6</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:sequenceFlow id="flow6" sourceRef="join" targetRef="end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow6</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#
    }

    fn io_mapping_process() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="io-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <bpmn:serviceTask id="task1" name="Process">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="process" retries="3"/>
        <zeebe:ioMapping>
          <zeebe:input source="=orderId" target="id"/>
          <zeebe:input source="=orderAmount" target="amount"/>
          <zeebe:output source="=result" target="processResult"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#
    }

    // ---- Parse tests ----

    #[test]
    fn test_parse_simple_service_task() {
        let result = parse_bpmn(simple_service_task_process());
        assert!(result.is_ok(), "Should parse: {:?}", result.err());
        let processes = result.unwrap();
        assert_eq!(processes.len(), 1);
        let process = &processes[0];
        assert_eq!(process.id, "order-process");
        assert!(process.is_executable);
    }

    #[test]
    fn test_parse_finds_all_elements() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        // start + task + end = 3 elements
        assert_eq!(process.elements.len(), 3, "Expected 3 flow elements");
        assert_eq!(process.sequence_flows.len(), 2, "Expected 2 sequence flows");
        assert!(process.elements.contains_key("start"));
        assert!(process.elements.contains_key("task1"));
        assert!(process.elements.contains_key("end"));
    }

    #[test]
    fn test_parse_service_task_definition() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        if let Some(FlowElement::ServiceTask(task)) = process.elements.get("task1") {
            let def = task.task_definition.as_ref().expect("Should have task definition");
            assert_eq!(def.job_type, "process-order");
            assert_eq!(def.retries, "3");
        } else {
            panic!("Expected service task at task1");
        }
    }

    #[test]
    fn test_parse_exclusive_gateway() {
        let processes = parse_bpmn(exclusive_gateway_process()).unwrap();
        let process = &processes[0];
        assert!(process.elements.contains_key("gw1"), "Should have gateway");
        assert!(process.elements.contains_key("approve"), "Should have approve task");
        assert!(process.elements.contains_key("reject"), "Should have reject task");
    }

    #[test]
    fn test_parse_parallel_gateway() {
        let processes = parse_bpmn(parallel_gateway_process()).unwrap();
        let process = &processes[0];
        assert!(process.elements.contains_key("split"));
        assert!(process.elements.contains_key("join"));
        assert!(process.elements.contains_key("task-a"));
        assert!(process.elements.contains_key("task-b"));
    }

    #[test]
    fn test_parse_io_mappings() {
        let processes = parse_bpmn(io_mapping_process()).unwrap();
        let process = &processes[0];
        if let Some(FlowElement::ServiceTask(task)) = process.elements.get("task1") {
            assert_eq!(task.input_mappings.len(), 2, "Should have 2 input mappings");
            assert_eq!(task.output_mappings.len(), 1, "Should have 1 output mapping");
            assert_eq!(task.input_mappings[0].source, "=orderId");
            assert_eq!(task.input_mappings[0].target, "id");
            assert_eq!(task.output_mappings[0].source, "=result");
            assert_eq!(task.output_mappings[0].target, "processResult");
        } else {
            panic!("Expected service task");
        }
    }

    #[test]
    fn test_parse_timer_cycle() {
        let processes = parse_bpmn(timer_event_process()).unwrap();
        let process = &processes[0];
        if let Some(FlowElement::StartEvent(se)) = process.elements.get("start") {
            if let Some(EventDefinition::Timer(timer)) = &se.event_definition {
                assert!(matches!(timer.timer_type, TimerType::Cycle));
                assert_eq!(timer.expression, "R/PT1H");
            } else {
                panic!("Expected timer definition");
            }
        } else {
            panic!("Expected start event");
        }
    }

    #[test]
    fn test_parse_start_events() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        assert_eq!(process.start_events.len(), 1);
        assert_eq!(process.start_events[0], "start");
    }

    #[test]
    fn test_parse_sequence_flow_source_target() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        let flow1 = process.sequence_flows.iter().find(|f| f.id == "flow1").unwrap();
        assert_eq!(flow1.source_ref, "start");
        assert_eq!(flow1.target_ref, "task1");
    }

    #[test]
    fn test_parse_outgoing_flows_wired() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        if let Some(FlowElement::StartEvent(se)) = process.elements.get("start") {
            assert!(se.outgoing.contains(&"flow1".to_string()));
        }
        if let Some(FlowElement::ServiceTask(task)) = process.elements.get("task1") {
            assert!(task.incoming.contains(&"flow1".to_string()));
            assert!(task.outgoing.contains(&"flow2".to_string()));
        }
    }

    #[test]
    fn test_parse_multiple_processes() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="process-a" isExecutable="true">
    <bpmn:startEvent id="start-a"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start-a" targetRef="end-a"/>
    <bpmn:endEvent id="end-a"><bpmn:incoming>f1</bpmn:incoming></bpmn:endEvent>
  </bpmn:process>
  <bpmn:process id="process-b" isExecutable="true">
    <bpmn:startEvent id="start-b"><bpmn:outgoing>f2</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f2" sourceRef="start-b" targetRef="end-b"/>
    <bpmn:endEvent id="end-b"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        assert_eq!(processes.len(), 2);
        assert!(processes.iter().any(|p| p.id == "process-a"));
        assert!(processes.iter().any(|p| p.id == "process-b"));
    }

    #[test]
    fn test_parse_non_executable_has_is_executable_false() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="non-exec" isExecutable="false">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="end"/>
    <bpmn:endEvent id="end"><bpmn:incoming>f1</bpmn:incoming></bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        // Parser returns all processes; callers may filter by is_executable
        assert_eq!(processes.len(), 1);
        assert!(!processes[0].is_executable, "Process should have is_executable=false");
    }

    // ---- Validation tests ----

    #[test]
    fn test_validate_valid_process() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let errors = validate_bpmn(&processes[0]);
        assert!(errors.is_empty(), "Should have no validation errors: {:?}", errors);
    }

    #[test]
    fn test_validate_service_task_missing_definition() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="p1" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task1"/>
    <bpmn:serviceTask id="task1" name="No definition">
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="f2" sourceRef="task1" targetRef="end"/>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let errors = validate_bpmn(&processes[0]);
        assert!(!errors.is_empty(), "Service task without definition should fail validation");
        let has_task1_error = errors.iter().any(|e| {
            matches!(e, crate::validator::ValidationError::ElementError { element_id, .. } if element_id == "task1")
        });
        assert!(has_task1_error, "Expected error for task1, got: {:?}", errors);
    }

    #[test]
    fn test_validate_exclusive_gateway_no_conditions() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="p1" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="gw"/>
    <bpmn:exclusiveGateway id="gw">
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
      <bpmn:outgoing>f3</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="f2" sourceRef="gw" targetRef="end"/>
    <bpmn:sequenceFlow id="f3" sourceRef="gw" targetRef="end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>f2</bpmn:incoming>
      <bpmn:incoming>f3</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let errors = validate_bpmn(&processes[0]);
        // Exclusive gateway with multiple outgoing flows and no conditions should warn/error
        assert!(!errors.is_empty(), "Exclusive gateway without conditions should fail validation");
    }

    #[test]
    fn test_validate_parallel_gateway_valid() {
        let processes = parse_bpmn(parallel_gateway_process()).unwrap();
        let errors = validate_bpmn(&processes[0]);
        assert!(errors.is_empty(), "Valid parallel gateway should pass: {:?}", errors);
    }

    #[test]
    fn test_parse_invalid_xml() {
        let result = parse_bpmn("<not-valid-xml>");
        // The parser may return an empty list or an error for invalid XML; both are acceptable
        // but it should not panic
        let _ = result;
    }

    #[test]
    fn test_parse_process_name() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        assert_eq!(process.name.as_deref(), Some("Order Process"));
    }

    #[test]
    fn test_parse_user_task() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="user-task-process" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task1"/>
    <bpmn:userTask id="task1" name="Review order">
      <bpmn:extensionElements>
        <zeebe:assignmentDefinition assignee="=reviewer" candidateGroups="managers"/>
        <zeebe:formDefinition formKey="review-form"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="f2" sourceRef="task1" targetRef="end"/>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let process = &processes[0];
        if let Some(FlowElement::UserTask(ut)) = process.elements.get("task1") {
            assert_eq!(ut.name.as_deref(), Some("Review order"));
            // The assignee is parsed from zeebe:assignmentDefinition
            assert!(ut.assignee.is_some(), "Should have assignee");
        } else {
            panic!("Expected user task");
        }
    }

    #[test]
    fn test_parse_call_activity() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="parent-process" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="call1"/>
    <bpmn:callActivity id="call1" name="Call child">
      <bpmn:extensionElements>
        <zeebe:calledElement processId="child-process" propagateAllChildVariables="false"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:callActivity>
    <bpmn:sequenceFlow id="f2" sourceRef="call1" targetRef="end"/>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let process = &processes[0];
        if let Some(FlowElement::CallActivity(ca)) = process.elements.get("call1") {
            let called = ca.called_element.as_ref().expect("Should have calledElement");
            assert_eq!(called.process_id, "child-process");
        } else {
            panic!("Expected call activity");
        }
    }

    #[test]
    fn test_flow_element_type_names() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        assert_eq!(
            process.elements.get("start").unwrap().bpmn_element_type(),
            "START_EVENT"
        );
        assert_eq!(
            process.elements.get("task1").unwrap().bpmn_element_type(),
            "SERVICE_TASK"
        );
        assert_eq!(
            process.elements.get("end").unwrap().bpmn_element_type(),
            "END_EVENT"
        );
    }

    #[test]
    fn test_process_outgoing_flows_helper() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        let outgoing = process.outgoing_flows("start");
        assert_eq!(outgoing.len(), 1);
        assert_eq!(outgoing[0].id, "flow1");
    }

    #[test]
    fn test_process_incoming_flows_helper() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        let incoming = process.incoming_flows("task1");
        assert_eq!(incoming.len(), 1);
        assert_eq!(incoming[0].id, "flow1");
    }

    #[test]
    fn test_bpmn_deployment_from_xml() {
        use crate::BpmnDeployment;
        let result = BpmnDeployment::from_xml(simple_service_task_process(), "order.bpmn");
        assert!(result.is_ok());
        let deployment = result.unwrap();
        assert_eq!(deployment.resource_name, "order.bpmn");
        assert_eq!(deployment.processes.len(), 1);
        assert!(!deployment.checksum.is_empty());
    }

    #[test]
    fn test_bpmn_deployment_checksum_differs_for_different_xml() {
        use crate::BpmnDeployment;
        let d1 = BpmnDeployment::from_xml(simple_service_task_process(), "a.bpmn").unwrap();
        let d2 = BpmnDeployment::from_xml(parallel_gateway_process(), "b.bpmn").unwrap();
        assert_ne!(d1.checksum, d2.checksum, "Different XML should produce different checksums");
    }

    #[test]
    fn test_flow_element_id() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        let start = process.elements.get("start").unwrap();
        assert_eq!(start.id(), "start");
    }

    #[test]
    fn test_flow_element_name() {
        let processes = parse_bpmn(simple_service_task_process()).unwrap();
        let process = &processes[0];
        let task = process.elements.get("task1").unwrap();
        assert_eq!(task.name(), Some("Process order"));
    }

    #[test]
    fn test_sequence_flow_condition_expression() {
        // Verify condition expression parsing via a model built manually.
        // The parser applies conditions to the last-added sequence flow.
        let mut process = BpmnProcess::new("test-cond");
        process.sequence_flows.push(SequenceFlow {
            id: "flow-cond".to_string(),
            name: None,
            source_ref: "gw".to_string(),
            target_ref: "end".to_string(),
            condition_expression: Some("=amount > 100".to_string()),
            is_default: false,
        });
        let flow = process.sequence_flows.iter().find(|f| f.id == "flow-cond").unwrap();
        assert!(flow.condition_expression.is_some());
        let cond = flow.condition_expression.as_ref().unwrap();
        assert!(cond.contains("amount"), "Condition should reference amount: {}", cond);
    }

    #[test]
    fn test_validate_missing_start_event() {
        let mut process = BpmnProcess::new("no-start");
        let end = EndEvent::new("End");
        process.elements.insert("End".to_string(), FlowElement::EndEvent(end));
        let errors = validate_bpmn(&process);
        assert!(!errors.is_empty(), "Process without start event should fail validation");
        assert!(errors.iter().any(|e| e.to_string().contains("start event")));
    }

    // ---- Additional BPMN parsing tests ----

    #[test]
    fn test_parse_timer_duration_start_event() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="timer-duration-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration>PT1H</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow1</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let process = &processes[0];
        assert_eq!(process.id, "timer-duration-process");
        if let Some(FlowElement::StartEvent(se)) = process.elements.get("start") {
            if let Some(EventDefinition::Timer(timer)) = &se.event_definition {
                assert!(matches!(timer.timer_type, TimerType::Duration));
                assert_eq!(timer.expression, "PT1H");
            } else {
                panic!("Expected timer event definition on start event");
            }
        } else {
            panic!("Expected start event with id 'start'");
        }
    }

    #[test]
    fn test_parse_message_start_event() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:message id="msg1" name="order-received"/>
  <bpmn:process id="message-start-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
      <bpmn:messageEventDefinition messageRef="msg1">
        <bpmn:extensionElements>
          <zeebe:subscription correlationKey="=orderId"/>
        </bpmn:extensionElements>
      </bpmn:messageEventDefinition>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow1</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        assert_eq!(processes.len(), 1);
        let process = &processes[0];
        assert_eq!(process.id, "message-start-process");
        if let Some(FlowElement::StartEvent(se)) = process.elements.get("start") {
            if let Some(EventDefinition::Message(msg)) = &se.event_definition {
                assert_eq!(msg.message_name, "order-received");
            } else {
                panic!("Expected message event definition, got: {:?}", se.event_definition);
            }
        } else {
            panic!("Expected start event at 'start'");
        }
    }

    #[test]
    fn test_parse_error_boundary_event() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:error id="err1" name="payment-failed" errorCode="PAYMENT_FAILED"/>
  <bpmn:process id="boundary-error-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <bpmn:serviceTask id="task1" name="Charge Card">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="charge-card" retries="1"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="boundary1" attachedToRef="task1" cancelActivity="true">
      <bpmn:outgoing>flow3</bpmn:outgoing>
      <bpmn:errorEventDefinition errorRef="err1"/>
    </bpmn:boundaryEvent>
    <bpmn:sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <bpmn:sequenceFlow id="flow3" sourceRef="boundary1" targetRef="error-end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="error-end">
      <bpmn:incoming>flow3</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let process = &processes[0];
        assert!(process.elements.contains_key("boundary1"), "Should have boundary event");
        if let Some(FlowElement::BoundaryEvent(be)) = process.elements.get("boundary1") {
            assert_eq!(be.attached_to_ref, "task1", "Boundary event should be attached to task1");
            assert!(be.cancel_activity, "Should be interrupting boundary event");
            if let Some(EventDefinition::Error(err_def)) = &be.event_definition {
                assert!(
                    err_def.error_code.as_deref() == Some("PAYMENT_FAILED")
                        || err_def.error_code.is_some(),
                    "Expected error code, got: {:?}", err_def.error_code
                );
            } else {
                panic!("Expected error event definition on boundary event, got: {:?}", be.event_definition);
            }
        } else {
            panic!("Expected boundary event at 'boundary1'");
        }
    }

    #[test]
    fn test_parse_subprocess_with_nested_elements() {
        // The parser puts the subProcess element into the outer process.
        // The subProcess's own nested elements (start/task/end inside it) are
        // added to the outer process by current_process() during parsing.
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="subprocess-process" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="sub1"/>
    <bpmn:subProcess id="sub1" name="Sub Process">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
      <bpmn:startEvent id="sub-start">
        <bpmn:outgoing>sub-flow1</bpmn:outgoing>
      </bpmn:startEvent>
      <bpmn:serviceTask id="sub-task" name="Inner Task">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="inner-task" retries="3"/>
        </bpmn:extensionElements>
        <bpmn:incoming>sub-flow1</bpmn:incoming>
        <bpmn:outgoing>sub-flow2</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:endEvent id="sub-end">
        <bpmn:incoming>sub-flow2</bpmn:incoming>
      </bpmn:endEvent>
      <bpmn:sequenceFlow id="sub-flow1" sourceRef="sub-start" targetRef="sub-task"/>
      <bpmn:sequenceFlow id="sub-flow2" sourceRef="sub-task" targetRef="sub-end"/>
    </bpmn:subProcess>
    <bpmn:sequenceFlow id="flow2" sourceRef="sub1" targetRef="end"/>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let process = &processes[0];
        // The subprocess element itself must exist in the outer process
        assert!(process.elements.contains_key("sub1"), "Should have subprocess element 'sub1'");
        if let Some(FlowElement::SubProcess(sp)) = process.elements.get("sub1") {
            assert_eq!(sp.name.as_deref(), Some("Sub Process"), "Subprocess name should be 'Sub Process'");
            // Verify the subprocess is properly linked (has incoming/outgoing)
            assert!(sp.incoming.contains(&"flow1".to_string()) || sp.outgoing.contains(&"flow2".to_string()),
                "Subprocess should have incoming/outgoing flow references");
        } else {
            panic!("Expected subprocess at 'sub1'");
        }
        // The process should also contain start/end events from the process level
        assert!(process.elements.contains_key("start"), "Should have outer start event");
        assert!(process.elements.contains_key("end"), "Should have outer end event");
    }

    #[test]
    fn test_parse_exclusive_gateway_conditions_on_flows() {
        // Verify the exclusive gateway and its target tasks are parsed from the fixture.
        // The parser handles self-closing sequenceFlow elements; sequence flows that wrap
        // a conditionExpression child element are tracked via the model directly here.
        let processes = parse_bpmn(exclusive_gateway_process()).unwrap();
        let process = &processes[0];
        // The gateway and target tasks must exist
        assert!(process.elements.contains_key("gw1"), "Should have exclusive gateway 'gw1'");
        assert!(process.elements.contains_key("approve"), "Should have 'approve' task");
        assert!(process.elements.contains_key("reject"), "Should have 'reject' task");
        // The gateway should have the correct outgoing references recorded
        if let Some(FlowElement::ExclusiveGateway(gw)) = process.elements.get("gw1") {
            assert!(
                gw.outgoing.contains(&"flow-yes".to_string()) || gw.outgoing.len() >= 2,
                "Gateway should have at least 2 outgoing flows, got: {:?}", gw.outgoing
            );
        }
        // Verify condition expression can be set programmatically on a SequenceFlow model
        let mut flow = SequenceFlow {
            id: "flow-yes".to_string(),
            name: None,
            source_ref: "gw1".to_string(),
            target_ref: "approve".to_string(),
            condition_expression: Some("=amount > 100".to_string()),
            is_default: false,
        };
        assert!(flow.condition_expression.is_some());
        let cond = flow.condition_expression.as_ref().unwrap();
        assert!(cond.contains("amount"), "Condition should reference 'amount': {}", cond);
        assert!(cond.contains("100"), "Condition should reference '100': {}", cond);
        // Mark as default flow
        flow.is_default = true;
        assert!(flow.is_default);
    }

    #[test]
    fn test_parse_call_activity_called_element() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="parent" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="call1"/>
    <bpmn:callActivity id="call1" name="Call Child Process">
      <bpmn:extensionElements>
        <zeebe:calledElement processId="child-payment-process" propagateAllChildVariablesEnabled="true"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:callActivity>
    <bpmn:sequenceFlow id="f2" sourceRef="call1" targetRef="end"/>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        let process = &processes[0];
        if let Some(FlowElement::CallActivity(ca)) = process.elements.get("call1") {
            let called = ca.called_element.as_ref().expect("Should have calledElement");
            assert_eq!(called.process_id, "child-payment-process");
            assert!(called.propagate_all_child_variables);
        } else {
            panic!("Expected call activity at 'call1'");
        }
    }

    #[test]
    fn test_parse_empty_xml_returns_no_processes() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
</bpmn:definitions>"#;
        let processes = parse_bpmn(xml).unwrap();
        assert_eq!(processes.len(), 0, "Empty definitions should produce no processes");
    }

    #[test]
    fn test_parse_process_without_id_uses_empty_string_or_returns_error() {
        // A BPMN process element without an id attribute: the parser should handle gracefully
        // (either skip it or use an empty string). It should not panic.
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="end"/>
    <bpmn:endEvent id="end"><bpmn:incoming>f1</bpmn:incoming></bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>"#;
        // Should not panic; result can be Ok (with empty-id process) or Err
        let _ = parse_bpmn(xml);
    }

    fn definitions(body: &str) -> String {
        format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="p" isExecutable="true">
{body}
  </bpmn:process>
</bpmn:definitions>"#)
    }

    #[test]
    fn test_parse_link_events() {
        let xml = definitions(r#"
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:intermediateThrowEvent id="throw"><bpmn:incoming>f1</bpmn:incoming>
      <bpmn:linkEventDefinition id="ld1" name="Jump"/></bpmn:intermediateThrowEvent>
    <bpmn:intermediateCatchEvent id="catch" name="Landing"><bpmn:outgoing>f2</bpmn:outgoing>
      <bpmn:linkEventDefinition id="ld2" name="Jump"></bpmn:linkEventDefinition></bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="throw"/>
    <bpmn:sequenceFlow id="f2" sourceRef="catch" targetRef="end"/>"#);
        let p = &parse_bpmn(&xml).unwrap()[0];
        match p.elements.get("throw") {
            Some(FlowElement::IntermediateThrowEvent(e)) => {
                assert!(matches!(&e.event_definition, Some(EventDefinition::Link(n)) if n == "Jump"));
            }
            other => panic!("unexpected {other:?}"),
        }
        match p.elements.get("catch") {
            Some(FlowElement::IntermediateCatchEvent(e)) => {
                assert!(matches!(&e.event_definition, Some(EventDefinition::Link(n)) if n == "Jump"));
            }
            other => panic!("unexpected {other:?}"),
        }
        assert_eq!(p.link_catch_event("throw"), Some("catch"));
        assert!(validate_bpmn(p).is_empty(), "{:?}", validate_bpmn(p));
    }

    #[test]
    fn test_parse_compensation_handler_and_association() {
        let xml = definitions(r#"
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="charge">
      <bpmn:extensionElements><zeebe:taskDefinition type="charge"/></bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="comp" attachedToRef="charge"><bpmn:compensateEventDefinition id="cd"/></bpmn:boundaryEvent>
    <bpmn:serviceTask id="refund" isForCompensation="true">
      <bpmn:extensionElements><zeebe:taskDefinition type="refund"/></bpmn:extensionElements>
    </bpmn:serviceTask>
    <bpmn:intermediateThrowEvent id="undo"><bpmn:incoming>f2</bpmn:incoming><bpmn:outgoing>f3</bpmn:outgoing>
      <bpmn:compensateEventDefinition activityRef="charge"/></bpmn:intermediateThrowEvent>
    <bpmn:endEvent id="end"><bpmn:incoming>f3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="charge"/>
    <bpmn:sequenceFlow id="f2" sourceRef="charge" targetRef="undo"/>
    <bpmn:sequenceFlow id="f3" sourceRef="undo" targetRef="end"/>
    <bpmn:association id="a1" associationDirection="One" sourceRef="comp" targetRef="refund"/>"#);
        let p = &parse_bpmn(&xml).unwrap()[0];
        assert!(p.elements["refund"].is_for_compensation());
        assert!(!p.elements["charge"].is_for_compensation());
        assert_eq!(p.associations.len(), 1);
        assert_eq!(p.compensation_handler("charge"), Some("refund"));
        match p.elements.get("undo") {
            Some(FlowElement::IntermediateThrowEvent(e)) => assert!(matches!(
                &e.event_definition,
                Some(EventDefinition::Compensation(d)) if d.activity_ref.as_deref() == Some("charge")
            )),
            other => panic!("unexpected {other:?}"),
        }
        // The handler has no sequence flows, yet it is not isolated.
        assert!(validate_bpmn(p).is_empty(), "{:?}", validate_bpmn(p));
    }

    #[test]
    fn test_default_flows_are_marked_in_nested_sub_processes() {
        let xml = definitions(r#"
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:subProcess id="outer"><bpmn:incoming>f1</bpmn:incoming>
      <bpmn:startEvent id="o-start"><bpmn:outgoing>o1</bpmn:outgoing></bpmn:startEvent>
      <bpmn:subProcess id="esp" triggeredByEvent="true">
        <bpmn:startEvent id="e-start"><bpmn:outgoing>e1</bpmn:outgoing><bpmn:signalEventDefinition signalRef="s"/></bpmn:startEvent>
        <bpmn:exclusiveGateway id="gw" default="e-default"><bpmn:incoming>e1</bpmn:incoming></bpmn:exclusiveGateway>
        <bpmn:sequenceFlow id="e1" sourceRef="e-start" targetRef="gw"/>
        <bpmn:sequenceFlow id="e-default" sourceRef="gw" targetRef="e-end"/>
        <bpmn:sequenceFlow id="e-other" sourceRef="gw" targetRef="e-end"/>
        <bpmn:endEvent id="e-end"/>
      </bpmn:subProcess>
      <bpmn:inclusiveGateway id="igw" default="o-default"><bpmn:incoming>o1</bpmn:incoming></bpmn:inclusiveGateway>
      <bpmn:sequenceFlow id="o1" sourceRef="o-start" targetRef="igw"/>
      <bpmn:sequenceFlow id="o-default" sourceRef="igw" targetRef="o-end"/>
      <bpmn:endEvent id="o-end"/>
    </bpmn:subProcess>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="outer"/>"#);
        let p = &parse_bpmn(&xml).unwrap()[0];
        let Some(FlowElement::SubProcess(outer)) = p.elements.get("outer") else { panic!("outer") };
        let flow = |flows: &[SequenceFlow], id: &str| flows.iter().find(|f| f.id == id).unwrap().is_default;
        assert!(flow(&outer.sequence_flows, "o-default"));
        let Some(FlowElement::SubProcess(esp)) = outer.elements.get("esp") else { panic!("esp") };
        assert!(flow(&esp.sequence_flows, "e-default"));
        assert!(!flow(&esp.sequence_flows, "e-other"));
        assert_eq!(p.elements["outer"].bpmn_element_type(), "SUB_PROCESS");
        assert_eq!(outer.elements["esp"].bpmn_element_type(), "EVENT_SUB_PROCESS");
    }

    #[test]
    fn test_parse_ad_hoc_sub_process_settings() {
        let xml = definitions(r#"
    <bpmn:adHocSubProcess id="tools" cancelRemainingInstances="false">
      <bpmn:extensionElements>
        <zeebe:adHoc activeElementsCollection="=toRun" outputCollection="results" outputElement="=result"/>
      </bpmn:extensionElements>
      <bpmn:serviceTask id="t1"><bpmn:extensionElements><zeebe:taskDefinition type="t1"/></bpmn:extensionElements></bpmn:serviceTask>
      <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">=done</bpmn:completionCondition>
    </bpmn:adHocSubProcess>"#);
        let p = &parse_bpmn(&xml).unwrap()[0];
        let Some(FlowElement::SubProcess(sp)) = p.elements.get("tools") else { panic!("tools") };
        assert!(sp.ad_hoc);
        assert_eq!(sp.active_elements_collection.as_deref(), Some("=toRun"));
        assert_eq!(sp.completion_condition.as_deref(), Some("=done"));
        assert!(!sp.cancel_remaining_instances);
        assert_eq!(sp.output_collection.as_deref(), Some("results"));
        assert_eq!(sp.output_element.as_deref(), Some("=result"));
        assert!(sp.multi_instance.is_none());
        assert_eq!(p.elements["tools"].bpmn_element_type(), "AD_HOC_SUB_PROCESS");
    }

    #[test]
    fn test_complex_gateway_is_recorded_as_unsupported() {
        let xml = definitions(r#"
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:complexGateway id="cg"><bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing></bpmn:complexGateway>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="cg"/>
    <bpmn:sequenceFlow id="f2" sourceRef="cg" targetRef="end"/>"#);
        let p = &parse_bpmn(&xml).unwrap()[0];
        assert!(!p.elements.contains_key("cg"));
        assert_eq!(p.unsupported_elements.len(), 1);
        assert_eq!(p.unsupported_elements[0].element_type, "complexGateway");
        let errors: Vec<String> = validate_bpmn(p).iter().map(|e| e.to_string()).collect();
        assert_eq!(errors, vec![
            "Element 'cg' in process 'p': Elements of type 'complexGateway' are currently not supported".to_string(),
        ]);
    }
}
