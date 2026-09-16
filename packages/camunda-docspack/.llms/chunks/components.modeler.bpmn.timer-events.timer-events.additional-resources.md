# Timer events — Additional resources

### XML representation

A timer start event with time date:

```xml
 <bpmn:startEvent id="release-date">
  <bpmn:timerEventDefinition>
    <bpmn:timeDate>2019-10-01T12:00:00Z</bpmn:timeDate>
  </bpmn:timerEventDefinition>
</bpmn:startEvent>
```

An intermediate timer catch event with time duration:

```xml
<bpmn:intermediateCatchEvent id="coffee-break">
  <bpmn:timerEventDefinition>
    <bpmn:timeDuration>PT10M</bpmn:timeDuration>
  </bpmn:timerEventDefinition>
</bpmn:intermediateCatchEvent>
```

A non-interrupting boundary timer event with time cycle:

```xml
<bpmn:boundaryEvent id="reminder" cancelActivity="false" attachedToRef="process-order">
  <bpmn:timerEventDefinition>
    <bpmn:timeCycle>R3/PT1H</bpmn:timeCycle>
  </bpmn:timerEventDefinition>
</bpmn:boundaryEvent>
```

### References

- [Expressions](https://docs.camunda.io/docs/next/components/concepts/expressions)
- [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events
