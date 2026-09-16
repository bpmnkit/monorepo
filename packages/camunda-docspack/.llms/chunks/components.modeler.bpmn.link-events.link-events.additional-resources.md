# Link events — Additional resources

### XML representation

A manual task:

```xml
<bpmn:intermediateThrowEvent id="Throw_Link_Event_A" name="A">
  <bpmn:linkEventDefinition id="ThrowLinkEventDefinition" name="A" />
</bpmn:intermediateThrowEvent>
<bpmn:intermediateCatchEvent id="Catch_Link_Event_A" name="A">
  <bpmn:linkEventDefinition id="CatchLinkEventDefinition" name="A" />
</bpmn:intermediateCatchEvent>
```

### References

- [Intermediate none events]

[intermediate none events]: ../none-events/none-events.md#intermediate-none-events-throwing

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/link-events/link-events
