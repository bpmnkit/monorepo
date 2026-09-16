# Message aggregation — Example use case

Imagine a workflow that collects three messages for each order before processing them together.

### BPMN model

Below is the key structure of the BPMN process:

- **Start event:** Message start event that starts a process for the first message of each `correlation_key`.
- **Intermediate catch event:** Waits for additional messages with the same correlation key.
- **Gateway:** Checks if the desired number of messages has been received.
- **Service task:** Processes all aggregated messages when complete.

```xml
<bpmn:process id="message_aggregator" name="Message Aggregator" isExecutable="true">
  <bpmn:startEvent id="StartEvent_Message">
    <bpmn:messageEventDefinition messageRef="Message_Received" />
    <bpmn:extensionElements>
      <zeebe:ioMapping>
        <zeebe:output source="= [message]" target="messages" />
        <zeebe:output source="= correlation_key" target="correlation_key" />
      </zeebe:ioMapping>
    </bpmn:extensionElements>
  </bpmn:startEvent>

  <bpmn:intermediateCatchEvent id="CatchEvent_Message">
    <bpmn:messageEventDefinition messageRef="Message_Received" />
    <bpmn:extensionElements>
      <zeebe:ioMapping>
        <zeebe:output source="= append(messages, message)" target="messages" />
      </zeebe:ioMapping>
    </bpmn:extensionElements>
  </bpmn:intermediateCatchEvent>

  <bpmn:exclusiveGateway id="Gateway_CheckCount" default="Flow_Process">
    <bpmn:sequenceFlow id="Flow_Loop" sourceRef="Gateway_CheckCount" targetRef="CatchEvent_Message">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">=count(messages) &lt; 3</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Process" sourceRef="Gateway_CheckCount" targetRef="Service_Process" />
  </bpmn:exclusiveGateway>

  <bpmn:serviceTask id="Service_Process" name="Process Aggregated Messages">
    <bpmn:extensionElements>
      <zeebe:taskDefinition type="process-aggregated" />
      <zeebe:ioMapping>
        <zeebe:input source="=messages" target="messages" />
      </zeebe:ioMapping>
    </bpmn:extensionElements>
  </bpmn:serviceTask>

  <bpmn:endEvent id="EndEvent_Complete" />
</bpmn:process>
```

---
Source: https://docs.camunda.io/docs/next/components/concepts/message-aggregation
