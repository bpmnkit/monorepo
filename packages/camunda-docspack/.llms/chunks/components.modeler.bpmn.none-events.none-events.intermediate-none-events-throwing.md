# None events — Intermediate none events (throwing)

Intermediate none events can be used to indicate some state achieved in the process. They are especially useful for monitoring to understand how the process is doing, for example, as milestones or key performance indicators (KPIs).

The engine itself doesn't do anything in the event, it just passes through it.


## Variable mappings

All none events can have [variable output mappings](https://docs.camunda.io/docs/next/components/concepts/variables#output-mappings).

For start events, this is often used to initialize process variables.


## Additional resources

### XML representation

A none start event:

```xml
<bpmn:startEvent id="order-placed" name="Order Placed" />
```

A none end event:

```xml
<bpmn:endEvent id="order-delivered" name="Order Delivered" />
```

An intermediate none event:

```xml
<bpmn:intermediateThrowEvent id="money-collected" name="Money Collected" />
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/none-events/none-events
