# Message events — Variable mappings

By default, all message variables are merged into the process instance. This behavior can be customized by defining an output mapping at the message catch event.

Visit the documentation regarding [variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings) for more information on this topic.


## Additional resources

### XML representation

A message start event with message definition:

```xml
<bpmn:message id="Message_0z0aft4" name="order-placed" />

<bpmn:startEvent id="order-placed" name="Order placed">
  <bpmn:messageEventDefinition messageRef="Message_0z0aft4" />
</bpmn:startEvent>
```

An intermediate message catch event with message definition:

```xml
<bpmn:message id="Message_1iz5qtq" name="money-collected">
  <bpmn:extensionElements>
    <zeebe:subscription correlationKey="= orderId" />
  </bpmn:extensionElements>
</bpmn:message>

<bpmn:intermediateCatchEvent id="money-collected" name="Money collected" >
  <bpmn:messageEventDefinition messageRef="Message_1iz5qtq" />
</bpmn:intermediateCatchEvent>
```

A boundary message event:

```xml
<bpmn:boundaryEvent id="order-canceled" name="Order Canceled"
  attachedToRef="collect-money">
  <bpmn:messageEventDefinition messageRef="Message_1iz5qtq" />
</bpmn:boundaryEvent>
```

### References

- [Message correlation](https://docs.camunda.io/docs/next/components/concepts/messages)
- [Expressions](https://docs.camunda.io/docs/next/components/concepts/expressions)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)
- [Incidents](https://docs.camunda.io/docs/next/components/concepts/incidents)
- [Job handling](https://docs.camunda.io/docs/next/components/concepts/job-workers)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events
