# Conditional events — XML representation

### Conditional start event

```xml
<bpmn:startEvent id="ConditionalStart">
  <bpmn:conditionalEventDefinition id="ConditionalEventDefinition_Start">
    <bpmn:condition xsi:type="bpmn:tFormalExpression">= amount > 100</bpmn:condition>
  </bpmn:conditionalEventDefinition>
</bpmn:startEvent>
```

### Intermediate conditional catch event

```xml
<bpmn:intermediateCatchEvent id="WaitForCondition">
  <bpmn:conditionalEventDefinition id="ConditionalEventDefinition_Catch">
    <bpmn:condition xsi:type="bpmn:tFormalExpression">
      = processorAvailable
    </bpmn:condition>

    <bpmn:extensionElements>
      <zeebe:conditionalFilter
        variableEvents="create, update" />
    </bpmn:extensionElements>
  </bpmn:conditionalEventDefinition>
</bpmn:intermediateCatchEvent>
```

### Conditional boundary event

```xml
<bpmn:boundaryEvent id="CancelReview" attachedToRef="ReviewApplication">
  <bpmn:conditionalEventDefinition id="ConditionalEventDefinition_Boundary">
    <bpmn:condition xsi:type="bpmn:tFormalExpression">
      = customerCancelled
    </bpmn:condition>
  </bpmn:conditionalEventDefinition>
</bpmn:boundaryEvent>
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/conditional-events/conditional-events
