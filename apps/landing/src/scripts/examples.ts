import type { DmnDefinitions } from "@bpmn-sdk/core"
import type { FormDefinition } from "@bpmn-sdk/core"
import type { InMemoryFileResolver, TabsApi, WelcomeExample } from "@bpmn-sdk/plugins/tabs"

export const examples: Record<string, string> = {
	simple: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@bpmn-sdk/core" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="order-validation" name="Order Validation" isExecutable="true">
    <bpmn:startEvent id="start" name="Order Received">
      <bpmn:outgoing>Flow_0000001</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="validate" name="Validate Order">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="validate-order"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000001</bpmn:incoming>
      <bpmn:outgoing>Flow_0000002</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="notify" name="Send Confirmation">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="send-email"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000002</bpmn:incoming>
      <bpmn:outgoing>Flow_0000003</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Done">
      <bpmn:incoming>Flow_0000003</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_0000001" sourceRef="start" targetRef="validate"/>
    <bpmn:sequenceFlow id="Flow_0000002" sourceRef="validate" targetRef="notify"/>
    <bpmn:sequenceFlow id="Flow_0000003" sourceRef="notify" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="order-validation_di">
    <bpmndi:BPMNPlane id="order-validation_di_plane" bpmnElement="order-validation">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="84" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="51" y="124" width="98" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="validate_di" bpmnElement="validate">
        <dc:Bounds x="250" y="62" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="notify_di" bpmnElement="notify">
        <dc:Bounds x="450" y="62" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="682" y="84" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="680" y="124" width="40" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0000001_di" bpmnElement="Flow_0000001">
        <di:waypoint x="118" y="102"/>
        <di:waypoint x="250" y="102"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000002_di" bpmnElement="Flow_0000002">
        <di:waypoint x="350" y="102"/>
        <di:waypoint x="450" y="102"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000003_di" bpmnElement="Flow_0000003">
        <di:waypoint x="550" y="102"/>
        <di:waypoint x="682" y="102"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,

	gateway: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@bpmn-sdk/core" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="approval-flow" name="Approval Workflow" isExecutable="true">
    <bpmn:startEvent id="start" name="Request Submitted">
      <bpmn:outgoing>Flow_0000004</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="review" name="Auto Review">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="auto-review"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000004</bpmn:incoming>
      <bpmn:outgoing>Flow_0000005</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:exclusiveGateway id="decision" name="Approved?" default="Flow_0000008">
      <bpmn:incoming>Flow_0000005</bpmn:incoming>
      <bpmn:outgoing>Flow_0000006</bpmn:outgoing>
      <bpmn:outgoing>Flow_0000008</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="process" name="Process Request">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="process"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000006</bpmn:incoming>
      <bpmn:outgoing>Flow_0000007</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="done" name="Completed">
      <bpmn:incoming>Flow_0000007</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:serviceTask id="reject" name="Send Rejection">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="reject"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000008</bpmn:incoming>
      <bpmn:outgoing>Flow_0000009</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="rejected" name="Rejected">
      <bpmn:incoming>Flow_0000009</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_0000004" sourceRef="start" targetRef="review"/>
    <bpmn:sequenceFlow id="Flow_0000005" sourceRef="review" targetRef="decision"/>
    <bpmn:sequenceFlow id="Flow_0000006" sourceRef="decision" targetRef="process" name="approved">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">= approved = true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_0000007" sourceRef="process" targetRef="done"/>
    <bpmn:sequenceFlow id="Flow_0000008" sourceRef="decision" targetRef="reject" name="rejected"/>
    <bpmn:sequenceFlow id="Flow_0000009" sourceRef="reject" targetRef="rejected"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="approval-flow_di">
    <bpmndi:BPMNPlane id="approval-flow_di_plane" bpmnElement="approval-flow">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="164" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="40.5" y="204" width="119" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="review_di" bpmnElement="review">
        <dc:Bounds x="250" y="142" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="decision_di" bpmnElement="decision">
        <dc:Bounds x="482" y="164" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="522" y="146" width="63" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="process_di" bpmnElement="process">
        <dc:Bounds x="650" y="62" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="reject_di" bpmnElement="reject">
        <dc:Bounds x="650" y="222" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="done_di" bpmnElement="done">
        <dc:Bounds x="882" y="84" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="868.5" y="124" width="63" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="rejected_di" bpmnElement="rejected">
        <dc:Bounds x="882" y="244" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="872" y="284" width="56" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0000004_di" bpmnElement="Flow_0000004">
        <di:waypoint x="118" y="182"/>
        <di:waypoint x="250" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000005_di" bpmnElement="Flow_0000005">
        <di:waypoint x="350" y="182"/>
        <di:waypoint x="482" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000006_di" bpmnElement="Flow_0000006">
        <di:waypoint x="500" y="164"/>
        <di:waypoint x="500" y="102"/>
        <di:waypoint x="650" y="102"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="547" y="78" width="56" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000007_di" bpmnElement="Flow_0000007">
        <di:waypoint x="750" y="102"/>
        <di:waypoint x="882" y="102"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000008_di" bpmnElement="Flow_0000008">
        <di:waypoint x="500" y="200"/>
        <di:waypoint x="500" y="262"/>
        <di:waypoint x="650" y="262"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="547" y="238" width="56" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000009_di" bpmnElement="Flow_0000009">
        <di:waypoint x="750" y="262"/>
        <di:waypoint x="882" y="262"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,

	parallel: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@bpmn-sdk/core" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="order-fulfillment" name="Order Fulfillment" isExecutable="true">
    <bpmn:startEvent id="start" name="Order Placed">
      <bpmn:outgoing>Flow_0000001</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:parallelGateway id="fork">
      <bpmn:incoming>Flow_0000001</bpmn:incoming>
      <bpmn:outgoing>Flow_0000002</bpmn:outgoing>
      <bpmn:outgoing>Flow_0000003</bpmn:outgoing>
      <bpmn:outgoing>Flow_0000004</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:serviceTask id="pay" name="Process Payment">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="payment-service"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000002</bpmn:incoming>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="stock" name="Reserve Inventory">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="inventory-service"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000003</bpmn:incoming>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="email" name="Send Confirmation">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="email-service"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000004</bpmn:incoming>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="ship" name="Ship Order">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="shipping-service"/>
      </bpmn:extensionElements>
      <bpmn:outgoing>Flow_0000005</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Order Complete">
      <bpmn:incoming>Flow_0000005</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_0000001" sourceRef="start" targetRef="fork"/>
    <bpmn:sequenceFlow id="Flow_0000002" sourceRef="fork" targetRef="pay" name="payment"/>
    <bpmn:sequenceFlow id="Flow_0000003" sourceRef="fork" targetRef="stock" name="inventory"/>
    <bpmn:sequenceFlow id="Flow_0000004" sourceRef="fork" targetRef="email" name="notifications"/>
    <bpmn:sequenceFlow id="Flow_0000005" sourceRef="ship" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="order-fulfillment_di">
    <bpmndi:BPMNPlane id="order-fulfillment_di_plane" bpmnElement="order-fulfillment">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="58" y="222" width="84" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ship_di" bpmnElement="ship">
        <dc:Bounds x="50" y="320" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fork_di" bpmnElement="fork">
        <dc:Bounds x="282" y="182" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="282" y="342" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="251" y="382" width="98" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="pay_di" bpmnElement="pay">
        <dc:Bounds x="450" y="0" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="stock_di" bpmnElement="stock">
        <dc:Bounds x="450" y="160" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="email_di" bpmnElement="email">
        <dc:Bounds x="450" y="320" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0000001_di" bpmnElement="Flow_0000001">
        <di:waypoint x="118" y="200"/>
        <di:waypoint x="282" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000002_di" bpmnElement="Flow_0000002">
        <di:waypoint x="300" y="182"/>
        <di:waypoint x="300" y="40"/>
        <di:waypoint x="450" y="40"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="350.5" y="16" width="49" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000003_di" bpmnElement="Flow_0000003">
        <di:waypoint x="318" y="200"/>
        <di:waypoint x="450" y="200"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="352.5" y="176" width="63" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000004_di" bpmnElement="Flow_0000004">
        <di:waypoint x="300" y="218"/>
        <di:waypoint x="300" y="360"/>
        <di:waypoint x="450" y="360"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="329.5" y="336" width="91" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000005_di" bpmnElement="Flow_0000005">
        <di:waypoint x="150" y="360"/>
        <di:waypoint x="282" y="360"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,

	"ai-agent": `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@bpmn-sdk/core" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="ai-support-agent" name="AI Support Agent" isExecutable="true">
    <bpmn:startEvent id="start" name="Ticket Created">
      <bpmn:outgoing>Flow_0000001</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="enrich" name="Fetch Context">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="fetch-customer-data"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000001</bpmn:incoming>
      <bpmn:outgoing>Flow_0000003</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:adHocSubProcess id="agent" name="AI Agent">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.camunda:ai-agent:1"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000003</bpmn:incoming>
      <bpmn:outgoing>Flow_0000004</bpmn:outgoing>
      <bpmn:serviceTask id="search" name="Search KB">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="knowledge-search"/>
        </bpmn:extensionElements>
        <bpmn:outgoing>Flow_0000002</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:serviceTask id="draft" name="Draft Response">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="draft-reply"/>
        </bpmn:extensionElements>
        <bpmn:incoming>Flow_0000002</bpmn:incoming>
      </bpmn:serviceTask>
      <bpmn:sequenceFlow id="Flow_0000002" sourceRef="search" targetRef="draft"/>
    </bpmn:adHocSubProcess>
    <bpmn:exclusiveGateway id="check" name="Confidence?" default="Flow_0000007">
      <bpmn:incoming>Flow_0000004</bpmn:incoming>
      <bpmn:outgoing>Flow_0000005</bpmn:outgoing>
      <bpmn:outgoing>Flow_0000007</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="send" name="Auto-Reply">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="send-reply"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000005</bpmn:incoming>
      <bpmn:outgoing>Flow_0000006</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="resolved" name="Resolved">
      <bpmn:incoming>Flow_0000006</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:userTask id="escalate" name="Human Review">
      <bpmn:extensionElements>
        <zeebe:formDefinition formId="review-form"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000007</bpmn:incoming>
      <bpmn:outgoing>Flow_0000008</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="escalated" name="Escalated">
      <bpmn:incoming>Flow_0000008</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_0000001" sourceRef="start" targetRef="enrich"/>
    <bpmn:sequenceFlow id="Flow_0000003" sourceRef="enrich" targetRef="agent"/>
    <bpmn:sequenceFlow id="Flow_0000004" sourceRef="agent" targetRef="check"/>
    <bpmn:sequenceFlow id="Flow_0000005" sourceRef="check" targetRef="send" name="high">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">= confidence > 0.9</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_0000006" sourceRef="send" targetRef="resolved"/>
    <bpmn:sequenceFlow id="Flow_0000007" sourceRef="check" targetRef="escalate" name="low"/>
    <bpmn:sequenceFlow id="Flow_0000008" sourceRef="escalate" targetRef="escalated"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="ai-support-agent_di">
    <bpmndi:BPMNPlane id="ai-support-agent_di_plane" bpmnElement="ai-support-agent">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="164" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="51" y="204" width="98" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="enrich_di" bpmnElement="enrich">
        <dc:Bounds x="250" y="142" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="agent_di" bpmnElement="agent" isExpanded="true">
        <dc:Bounds x="450" y="122" width="340" height="120"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="check_di" bpmnElement="check">
        <dc:Bounds x="840" y="164" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="880" y="146" width="77" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="send_di" bpmnElement="send">
        <dc:Bounds x="1007" y="62" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="escalate_di" bpmnElement="escalate">
        <dc:Bounds x="1007" y="222" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="resolved_di" bpmnElement="resolved">
        <dc:Bounds x="1157" y="84" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="1147" y="124" width="56" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="escalated_di" bpmnElement="escalated">
        <dc:Bounds x="1157" y="244" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="1143.5" y="284" width="63" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="search_di" bpmnElement="search">
        <dc:Bounds x="470" y="142" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="draft_di" bpmnElement="draft">
        <dc:Bounds x="670" y="142" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0000001_di" bpmnElement="Flow_0000001">
        <di:waypoint x="118" y="182"/>
        <di:waypoint x="250" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000003_di" bpmnElement="Flow_0000003">
        <di:waypoint x="350" y="182"/>
        <di:waypoint x="450" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000004_di" bpmnElement="Flow_0000004">
        <di:waypoint x="790" y="182"/>
        <di:waypoint x="840" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000005_di" bpmnElement="Flow_0000005">
        <di:waypoint x="858" y="164"/>
        <di:waypoint x="858" y="102"/>
        <di:waypoint x="1007" y="102"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="912.5" y="78" width="40" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000006_di" bpmnElement="Flow_0000006">
        <di:waypoint x="1107" y="102"/>
        <di:waypoint x="1157" y="102"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000007_di" bpmnElement="Flow_0000007">
        <di:waypoint x="858" y="200"/>
        <di:waypoint x="858" y="262"/>
        <di:waypoint x="1007" y="262"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="912.5" y="238" width="40" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000008_di" bpmnElement="Flow_0000008">
        <di:waypoint x="1107" y="262"/>
        <di:waypoint x="1157" y="262"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000002_di" bpmnElement="Flow_0000002">
        <di:waypoint x="570" y="182"/>
        <di:waypoint x="670" y="182"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
}

// ── DMN example: Shipping Cost ─────────────────────────────────────────────────

const DMN_SHIPPING_COST: DmnDefinitions = {
	id: "shipping-cost-defs",
	name: "Shipping Cost",
	namespace: "http://camunda.org/schema/1.0/dmn",
	namespaces: {},
	modelerAttributes: {},
	decisions: [
		{
			id: "decision-shipping-cost",
			name: "Shipping Cost",
			decisionTable: {
				id: "shipping-cost-table",
				hitPolicy: "FIRST",
				inputs: [
					{
						id: "input-weight",
						label: "Package Weight (kg)",
						inputExpression: { id: "input-weight-expr", typeRef: "number", text: "weight" },
					},
					{
						id: "input-dest",
						label: "Destination",
						inputExpression: { id: "input-dest-expr", typeRef: "string", text: "destination" },
					},
				],
				outputs: [
					{
						id: "output-cost",
						label: "Shipping Cost (€)",
						name: "shippingCost",
						typeRef: "number",
					},
					{ id: "output-carrier", label: "Carrier", name: "carrier", typeRef: "string" },
				],
				rules: [
					{
						id: "rule-1",
						description: "Light domestic",
						inputEntries: [
							{ id: "r1-i1", text: "< 5" },
							{ id: "r1-i2", text: '"domestic"' },
						],
						outputEntries: [
							{ id: "r1-o1", text: "4.99" },
							{ id: "r1-o2", text: '"DHL"' },
						],
					},
					{
						id: "rule-2",
						description: "Heavy domestic",
						inputEntries: [
							{ id: "r2-i1", text: ">= 5" },
							{ id: "r2-i2", text: '"domestic"' },
						],
						outputEntries: [
							{ id: "r2-o1", text: "9.99" },
							{ id: "r2-o2", text: '"DHL Freight"' },
						],
					},
					{
						id: "rule-3",
						description: "Light international",
						inputEntries: [
							{ id: "r3-i1", text: "< 5" },
							{ id: "r3-i2", text: '"international"' },
						],
						outputEntries: [
							{ id: "r3-o1", text: "19.99" },
							{ id: "r3-o2", text: '"FedEx"' },
						],
					},
					{
						id: "rule-4",
						description: "Heavy international",
						inputEntries: [
							{ id: "r4-i1", text: ">= 5" },
							{ id: "r4-i2", text: '"international"' },
						],
						outputEntries: [
							{ id: "r4-o1", text: "49.99" },
							{ id: "r4-o2", text: '"FedEx Freight"' },
						],
					},
				],
			},
			informationRequirements: [],
			knowledgeRequirements: [],
			authorityRequirements: [],
		},
	],
	inputData: [],
	knowledgeSources: [],
	businessKnowledgeModels: [],
	textAnnotations: [],
	associations: [],
}

// ── Form example: Support Ticket ───────────────────────────────────────────────

const FORM_SUPPORT_TICKET: FormDefinition = {
	id: "form-support-ticket",
	type: "default",
	components: [
		{
			id: "f-subject",
			type: "textfield",
			label: "Subject",
			key: "subject",
			validate: { required: true },
		},
		{
			id: "f-category",
			type: "select",
			label: "Category",
			key: "category",
			validate: { required: true },
			values: [
				{ label: "Billing", value: "billing" },
				{ label: "Technical", value: "technical" },
				{ label: "Account", value: "account" },
				{ label: "Other", value: "other" },
			],
		},
		{
			id: "f-priority",
			type: "radio",
			label: "Priority",
			key: "priority",
			values: [
				{ label: "Low", value: "low" },
				{ label: "Medium", value: "medium" },
				{ label: "High", value: "high" },
			],
			defaultValue: "medium",
		},
		{
			id: "f-desc",
			type: "textarea",
			label: "Description",
			key: "description",
			validate: { required: true },
		},
		{
			id: "f-attach",
			type: "filepicker",
			label: "Attachments",
			key: "attachments",
			multiple: true,
		},
		{ id: "f-sep", type: "separator" },
		{ id: "f-submit", type: "button", label: "Submit Ticket", action: "submit" },
	],
}

// ── Multi-file example: Loan Application ───────────────────────────────────────

export const LOAN_APPLICATION_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" id="loan-app-defs" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@bpmn-sdk/core" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="loan-application" name="Loan Application" isExecutable="true">
    <bpmn:startEvent id="start" name="Application Received">
      <bpmn:outgoing>Flow_001</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="fill-form" name="Fill Application Form">
      <bpmn:extensionElements>
        <zeebe:formDefinition formId="form-loan-application"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_001</bpmn:incoming>
      <bpmn:outgoing>Flow_002</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:businessRuleTask id="assess-risk" name="Assess Credit Risk">
      <bpmn:extensionElements>
        <zeebe:calledDecision decisionId="decision-credit-risk" resultVariable="riskResult"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_002</bpmn:incoming>
      <bpmn:outgoing>Flow_003</bpmn:outgoing>
    </bpmn:businessRuleTask>
    <bpmn:exclusiveGateway id="check-approval" name="Approved?" default="Flow_006">
      <bpmn:incoming>Flow_003</bpmn:incoming>
      <bpmn:outgoing>Flow_004</bpmn:outgoing>
      <bpmn:outgoing>Flow_006</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="disburse" name="Disburse Funds">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="disburse-loan"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_004</bpmn:incoming>
      <bpmn:outgoing>Flow_005</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end-approved" name="Loan Approved">
      <bpmn:incoming>Flow_005</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:serviceTask id="notify-reject" name="Send Rejection Notice">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="send-rejection"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_006</bpmn:incoming>
      <bpmn:outgoing>Flow_007</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end-rejected" name="Loan Rejected">
      <bpmn:incoming>Flow_007</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_001" sourceRef="start" targetRef="fill-form"/>
    <bpmn:sequenceFlow id="Flow_002" sourceRef="fill-form" targetRef="assess-risk"/>
    <bpmn:sequenceFlow id="Flow_003" sourceRef="assess-risk" targetRef="check-approval"/>
    <bpmn:sequenceFlow id="Flow_004" sourceRef="check-approval" targetRef="disburse" name="approved">
      <bpmn:conditionExpression>= riskResult.approved = true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_005" sourceRef="disburse" targetRef="end-approved"/>
    <bpmn:sequenceFlow id="Flow_006" sourceRef="check-approval" targetRef="notify-reject" name="rejected"/>
    <bpmn:sequenceFlow id="Flow_007" sourceRef="notify-reject" targetRef="end-rejected"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="loan-app-di">
    <bpmndi:BPMNPlane id="loan-app-di-plane" bpmnElement="loan-application">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="40" y="222" width="120" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fill-form_di" bpmnElement="fill-form">
        <dc:Bounds x="250" y="160" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="assess-risk_di" bpmnElement="assess-risk">
        <dc:Bounds x="450" y="160" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="check-approval_di" bpmnElement="check-approval">
        <dc:Bounds x="652" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="692" y="164" width="63" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="disburse_di" bpmnElement="disburse">
        <dc:Bounds x="820" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end-approved_di" bpmnElement="end-approved">
        <dc:Bounds x="982" y="102" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="958" y="142" width="84" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="notify-reject_di" bpmnElement="notify-reject">
        <dc:Bounds x="820" y="260" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end-rejected_di" bpmnElement="end-rejected">
        <dc:Bounds x="982" y="282" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="958" y="322" width="84" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_001_di" bpmnElement="Flow_001">
        <di:waypoint x="118" y="200"/><di:waypoint x="250" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_002_di" bpmnElement="Flow_002">
        <di:waypoint x="350" y="200"/><di:waypoint x="450" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_003_di" bpmnElement="Flow_003">
        <di:waypoint x="550" y="200"/><di:waypoint x="652" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_004_di" bpmnElement="Flow_004">
        <di:waypoint x="670" y="182"/><di:waypoint x="670" y="120"/><di:waypoint x="820" y="120"/>
        <bpmndi:BPMNLabel><dc:Bounds x="724" y="96" width="56" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_005_di" bpmnElement="Flow_005">
        <di:waypoint x="920" y="120"/><di:waypoint x="982" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_006_di" bpmnElement="Flow_006">
        <di:waypoint x="670" y="218"/><di:waypoint x="670" y="300"/><di:waypoint x="820" y="300"/>
        <bpmndi:BPMNLabel><dc:Bounds x="724" y="276" width="56" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_007_di" bpmnElement="Flow_007">
        <di:waypoint x="920" y="300"/><di:waypoint x="982" y="300"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

export const LOAN_DMN: DmnDefinitions = {
	id: "credit-risk-defs",
	name: "Credit Risk Assessment",
	namespace: "http://camunda.org/schema/1.0/dmn",
	namespaces: {},
	modelerAttributes: {},
	decisions: [
		{
			id: "decision-credit-risk",
			name: "Credit Risk Assessment",
			decisionTable: {
				id: "credit-risk-table",
				hitPolicy: "UNIQUE",
				inputs: [
					{
						id: "input-score",
						label: "Credit Score",
						inputExpression: { id: "input-score-expr", typeRef: "number", text: "creditScore" },
					},
					{
						id: "input-amount",
						label: "Requested Amount (€)",
						inputExpression: {
							id: "input-amount-expr",
							typeRef: "number",
							text: "requestedAmount",
						},
					},
				],
				outputs: [
					{ id: "output-risk", label: "Risk Level", name: "riskLevel", typeRef: "string" },
					{ id: "output-approved", label: "Approved", name: "approved", typeRef: "boolean" },
					{ id: "output-max", label: "Max Amount (€)", name: "maxAmount", typeRef: "number" },
				],
				rules: [
					{
						id: "rule-1",
						description: "Excellent credit, small loan",
						inputEntries: [
							{ id: "r1-i1", text: ">= 750" },
							{ id: "r1-i2", text: "<= 50000" },
						],
						outputEntries: [
							{ id: "r1-o1", text: '"low"' },
							{ id: "r1-o2", text: "true" },
							{ id: "r1-o3", text: "50000" },
						],
					},
					{
						id: "rule-2",
						description: "Good credit, medium loan",
						inputEntries: [
							{ id: "r2-i1", text: "[650..750)" },
							{ id: "r2-i2", text: "<= 25000" },
						],
						outputEntries: [
							{ id: "r2-o1", text: '"medium"' },
							{ id: "r2-o2", text: "true" },
							{ id: "r2-o3", text: "25000" },
						],
					},
					{
						id: "rule-3",
						description: "Fair credit, large loan — reject",
						inputEntries: [
							{ id: "r3-i1", text: "[550..650)" },
							{ id: "r3-i2", text: "> 10000" },
						],
						outputEntries: [
							{ id: "r3-o1", text: '"high"' },
							{ id: "r3-o2", text: "false" },
							{ id: "r3-o3", text: "0" },
						],
					},
					{
						id: "rule-4",
						description: "Poor credit — always reject",
						inputEntries: [
							{ id: "r4-i1", text: "< 550" },
							{ id: "r4-i2", text: "" },
						],
						outputEntries: [
							{ id: "r4-o1", text: '"very high"' },
							{ id: "r4-o2", text: "false" },
							{ id: "r4-o3", text: "0" },
						],
					},
				],
			},
			informationRequirements: [],
			knowledgeRequirements: [],
			authorityRequirements: [],
		},
	],
	inputData: [],
	knowledgeSources: [],
	businessKnowledgeModels: [],
	textAnnotations: [],
	associations: [],
}

export const LOAN_FORM: FormDefinition = {
	id: "form-loan-application",
	type: "default",
	components: [
		{
			id: "lf-name",
			type: "textfield",
			label: "Full Name",
			key: "fullName",
			validate: { required: true },
		},
		{
			id: "lf-dob",
			type: "datetime",
			key: "dateOfBirth",
			subtype: "date",
			dateLabel: "Date of Birth",
			validate: { required: true },
		},
		{
			id: "lf-employment",
			type: "select",
			label: "Employment Status",
			key: "employmentStatus",
			validate: { required: true },
			values: [
				{ label: "Employed (full-time)", value: "full-time" },
				{ label: "Employed (part-time)", value: "part-time" },
				{ label: "Self-employed", value: "self-employed" },
				{ label: "Unemployed", value: "unemployed" },
			],
		},
		{
			id: "lf-income",
			type: "number",
			label: "Annual Income (€)",
			key: "annualIncome",
			validate: { required: true },
		},
		{
			id: "lf-amount",
			type: "number",
			label: "Requested Amount (€)",
			key: "requestedAmount",
			validate: { required: true },
		},
		{
			id: "lf-purpose",
			type: "select",
			label: "Loan Purpose",
			key: "loanPurpose",
			validate: { required: true },
			values: [
				{ label: "Home improvement", value: "home" },
				{ label: "Vehicle", value: "vehicle" },
				{ label: "Education", value: "education" },
				{ label: "Business", value: "business" },
				{ label: "Other", value: "other" },
			],
		},
		{ id: "lf-notes", type: "textarea", label: "Additional Notes", key: "notes" },
		{
			id: "lf-consent",
			type: "checkbox",
			label: "I consent to a credit check",
			key: "creditCheckConsent",
			validate: { required: true },
		},
		{ id: "lf-sep", type: "separator" },
		{ id: "lf-submit", type: "button", label: "Submit Application", action: "submit" },
	],
}

// ── Optimizable example ─────────────────────────────────────────────────────────
// This diagram intentionally contains issues surfaced by optimize():
//   feel/missing-default-flow — gw-channel has no default attribute
//   feel/empty-condition      — Flow_2 exits the gateway with no condition
//   flow/dead-end             — sendSms has no outgoing sequence flow
//   task/reusable-group       — sendSms + sendEmail share type="notify-customer"

const CUSTOMER_NOTIFICATION_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="Definitions_notification"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="customer-notification" name="Customer Notification" isExecutable="true">
    <bpmn:startEvent id="start" name="Customer Action">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:exclusiveGateway id="gw-channel" name="Notification Channel?">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="sendSms" name="Send SMS">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="notify-customer"/>
        <zeebe:taskHeaders>
          <zeebe:header key="channel" value="sms"/>
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="sendEmail" name="Send Email">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="notify-customer"/>
        <zeebe:taskHeaders>
          <zeebe:header key="channel" value="email"/>
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Done">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="start" targetRef="gw-channel"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="gw-channel" targetRef="sendSms"/>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="gw-channel" targetRef="sendEmail">
      <bpmn:conditionExpression>= channel = "email"</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_4" sourceRef="sendEmail" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="customer-notification_di">
    <bpmndi:BPMNPlane id="customer-notification_di_plane" bpmnElement="customer-notification">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="150" y="107" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw-channel_di" bpmnElement="gw-channel" isMarkerVisible="true">
        <dc:Bounds x="255" y="99" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sendSms_di" bpmnElement="sendSms">
        <dc:Bounds x="390" y="50" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sendEmail_di" bpmnElement="sendEmail">
        <dc:Bounds x="390" y="170" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="572" y="192" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="186" y="125"/>
        <di:waypoint x="255" y="124"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="280" y="99"/>
        <di:waypoint x="280" y="90"/>
        <di:waypoint x="390" y="90"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="280" y="149"/>
        <di:waypoint x="280" y="210"/>
        <di:waypoint x="390" y="210"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="490" y="210"/>
        <di:waypoint x="572" y="210"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

// ── Welcome screen example entries ─────────────────────────────────────────────

export function makeExamples(api: TabsApi, resolver: InMemoryFileResolver): WelcomeExample[] {
	return [
		{
			label: "Order Validation",
			description: "Linear service-task flow with start, validate, notify, and end events",
			badge: "BPMN",
			onOpen() {
				api.openTab({ type: "bpmn", xml: examples.simple ?? "", name: "Order Validation" })
			},
		},
		{
			label: "Shipping Cost",
			description:
				"Decision table: package weight × destination → cost and carrier (FIRST hit policy)",
			badge: "DMN",
			onOpen() {
				api.openTab({ type: "dmn", defs: DMN_SHIPPING_COST, name: "Shipping Cost" })
			},
		},
		{
			label: "Support Ticket",
			description:
				"Support request form with subject, category, priority, description, and file upload",
			badge: "FORM",
			onOpen() {
				api.openTab({ type: "form", form: FORM_SUPPORT_TICKET, name: "Support Ticket" })
			},
		},
		{
			label: "Loan Application Flow",
			description: "BPMN process linked to a Credit Risk DMN table and an Application Form",
			badge: "MULTI",
			onOpen() {
				resolver.registerDmn(LOAN_DMN)
				resolver.registerForm(LOAN_FORM)
				api.openTab({ type: "form", form: LOAN_FORM, name: "Loan Application Form" })
				api.openTab({ type: "dmn", defs: LOAN_DMN, name: "Credit Risk Assessment" })
				api.openTab({ type: "bpmn", xml: LOAN_APPLICATION_BPMN, name: "Loan Application Flow" })
			},
		},
		{
			label: "FEEL Playground",
			description: "Interactive FEEL expression evaluator with syntax highlighting",
			badge: "FEEL",
			onOpen() {
				api.openTab({ type: "feel", name: "FEEL Playground" })
			},
		},
		{
			label: "Customer Notification Flow",
			description:
				"Process with common issues: missing default flow, dead-end task, and reusable service tasks — try Optimize!",
			badge: "BPMN",
			onOpen() {
				api.openTab({
					type: "bpmn",
					xml: CUSTOMER_NOTIFICATION_BPMN,
					name: "Customer Notification Flow",
				})
			},
		},
	]
}
