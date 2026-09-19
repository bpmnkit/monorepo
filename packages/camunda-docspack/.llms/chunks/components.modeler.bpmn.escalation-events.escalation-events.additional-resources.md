# Escalation events — Additional resources

### XML representation

An intermediate escalation throw event with expression:

```xml
<bpmn:intermediateThrowEvent id="StartEvent_1">
    <bpmn:escalationEventDefinition id="EscalationEventDefinition_0sdm9od" escalationRef="Escalation_2alpsjo" />
</bpmn:intermediateThrowEvent>

<bpmn:escalation id="Escalation_2alpsjo" name="Escalation_2alpsjo" escalationCode="=escalationCode" />
```

An escalation boundary catch event:

```xml
<bpmn:boundaryEvent id="Event_1wpcmdz" cancelActivity="false" attachedToRef="Activity_1q7i1lv">
    <bpmn:escalationEventDefinition id="EscalationEventDefinition_1fpge5i" escalationRef="Escalation_2alpsjo" />
</bpmn:boundaryEvent>

<bpmn:escalation id="Escalation_2alpsjo" name="Escalation_2alpsjo" escalationCode="escalationCode" />
```

A escalation boundary catch-all event:

```xml
<bpmn:boundaryEvent id="Event_1wpcmdz" cancelActivity="false" attachedToRef="Activity_1q7i1lv">
    <bpmn:escalationEventDefinition id="EscalationEventDefinition_1fpge5i" />
</bpmn:boundaryEvent>
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/escalation-events/escalation-events
