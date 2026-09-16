# Event-based gateway — Additional resources

### XML representation

An event-based gateway with two outgoing sequence flows:

```xml
<bpmn:eventBasedGateway id="gateway" />

<bpmn:sequenceFlow id="s1" sourceRef="gateway" targetRef="payment-details-updated" />

<bpmn:intermediateCatchEvent id="payment-details-updated"
  name="Payment Details Updated">
  <bpmn:messageEventDefinition messageRef="message-payment-details-updated" />
</bpmn:intermediateCatchEvent>

<bpmn:sequenceFlow id="s2" sourceRef="gateway" targetRef="wait-one-hour" />

<bpmn:intermediateCatchEvent id="wait-one-hour" name="1 hour">
  <bpmn:timerEventDefinition>
    <bpmn:timeDuration>PT1H</bpmn:timeDuration>
  </bpmn:timerEventDefinition>
</bpmn:intermediateCatchEvent>

<bpmn:intermediateCatchEvent id="payment-canceled" name="Payment canceled">
  <bpmn:signalEventDefinition signalRef="signal-payment-canceled" />
</bpmn:intermediateCatchEvent>
```

### References

- [Timer events](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events)
- [Message events](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/event-based-gateways/event-based-gateways
