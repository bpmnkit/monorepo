# Signal events — Variable mappings

When broadcasting a signal you can pass along variables.

By default, all signal variables are merged into the process instance.
This behavior can be customized by defining an output mapping at the signal catch event.

When a signal throw event broadcasts a signal, all local variables are passed along.
You can use input mappings to define these local variables.

For more information about variable scopes, visit the documentation about [variable scopes](https://docs.camunda.io/docs/next/components/modeler/concepts/variables#variable-scopes).


## Additional resources

### XML representation

A signal start event with signal definition:

```xml
<bpmn:startEvent id="startEventId" name="Order placed">
    <bpmn:signalEventDefinition id="signalEventDefinitionId" signalRef="signalId" />
</bpmn:startEvent>

<bpmn:signal id="signalId" name="order placed" />
```

A signal boundary event with signal definition:

```xml
<bpmn:boundaryEvent id="order-canceled" name="Order canceled" attachedToRef="ActivityId">
  <bpmn:signalEventDefinition id="signalId" />
</bpmn:boundaryEvent>

<bpmn:signal id="signalId" name="order canceled" />
```

A signal intermediate catch event with signal definition:

```xml
<bpmn:intermediateThrowEvent id="money-collected" name="Money collected">
    <bpmn:signalEventDefinition id="signalEventDefinitionId" signalRef="signalId" />
</bpmn:intermediateThrowEvent>

<bpmn:signal id="signalId" name="money collected" />
```

A signal end event with signal definition:

```xml
<bpmn:endEvent id="parcel_shipped" name="Parcel shipped">
  <bpmn:signalEventDefinition id="signalEventDefinitionId" signalRef="signalId" />
</bpmn:endEvent>

<bpmn:signal id="signalId" name="parcel shipped" />
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events
