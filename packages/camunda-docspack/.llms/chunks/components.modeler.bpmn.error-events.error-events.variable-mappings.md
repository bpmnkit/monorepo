# Error events — Variable mappings

Variables can be passed along into the error catch event with the payload when the error is thrown from the client command. These variables can be merged into the process instance by defining an output mapping at the error catch event.

Visit the documentation regarding [variable mappings](https://docs.camunda.io/docs/next/components/modeler/concepts/variables#inputoutput-variable-mappings) for more information.


## Additional resources

### XML representation

A boundary error event:

```xml
<bpmn:error id="invalid-credit-card-error" errorCode="Invalid Credit Card" />

<bpmn:boundaryEvent id="invalid-credit-card-1" name="Invalid Credit Card" attachedToRef="collect-money">
 <bpmn:errorEventDefinition errorRef="invalid-credit-card-error" />
</bpmn:boundaryEvent>
```

A error boundary catch-all event:

```xml
<bpmn:boundaryEvent id="invalid-credit-card-2" name="Unknown Error" attachedToRef="collect-money">
  <bpmn:errorEventDefinition id="catch-all-errors" />
</bpmn:boundaryEvent>
```

### References

- [Incidents](https://docs.camunda.io/docs/next/components/concepts/incidents)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events
