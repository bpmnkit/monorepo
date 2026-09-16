# Event subprocess — Additional resources

### XML representation

An event subprocess with an interrupting timer start event:

```xml
<bpmn:subProcess id="compensate-subprocess" triggeredByEvent="true">
  <bpmn:startEvent id="cancel-order" isInterrupting="true">
    <bpmn:timerEventDefinition>
      <bpmn:timeDuration>PT5M</bpmn:timeDuration>
    </bpmn:timerEventDefinition>
  ... other elements
</bpmn:subProcess>
```

### References

- [Embedded subprocess](https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses)
- [Variable scopes](https://docs.camunda.io/docs/next/components/concepts/variables#variable-scopes)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses
