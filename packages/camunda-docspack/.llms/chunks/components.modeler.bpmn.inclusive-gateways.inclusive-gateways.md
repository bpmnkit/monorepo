# Inclusive gateway

Learn more about inclusive gateways, which allow for making multiple decisions based on data or process variables, and can be diverging or converging.

The inclusive gateway (or OR-gateway) allows for making multiple decisions based on data or process variables. Inclusive gateways can be diverging (a sequence flow is split into multiple paths) or converging (split paths are merged before continuing).

![A process model to prepare lunch at lunchtime can use an inclusive gateway to decide which steps to take to prepare the different lunch components, e.g. cook pasta,stir-fry steak, prepare salad, or any combination of these.](assets/inclusive-gateway.png)

If an inclusive gateway has multiple outgoing sequence flows, all sequence flows must have a condition to define when the flow is taken. If the inclusive gateway only has one outgoing sequence flow, then it does not need to have a condition.

Optionally, one of the sequence flows can be marked as the default flow. This sequence flow should not have a condition, because its behavior depends on the other conditions.

When an inclusive gateway is entered, the conditions are evaluated. The process instance takes all sequence flows where the condition is fulfilled.

For example: Courses selected include `pasta` and `salad`.

![An inclusive gateway has decided to take the steps to cook pasta and prepare salad, but not stir-fry steak.](assets/inclusive-gateway-1.png)

For example: Courses selected include `steak`, `pasta` and `salad`.

![An inclusive gateway has decided to take the steps to cook pasta, stir-fry steak, and prepare salad.](assets/inclusive-gateway-2.png)

If no condition is fulfilled, it takes the **default flow** of the gateway. Note that the default flow is not expected to have a condition, and is therefore not evaluated. If no condition is fulfilled and the gateway has no default flow, an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) is created.

For example: No courses selected then the default flow is taken.

![An inclusive gateway has decided to take the step to prepare salad as the default because none of the conditions were fulfilled.](assets/inclusive-gateway-default.png)

A converging inclusive gateway (also known as a merging or joining inclusive gateway) merges incoming paths before the sequence flow continues. A converging gateway is completed and merges incoming sequence flows if one of the following conditions is met:

- All incoming sequence flows have been taken at least once.
- No path exists from any active flow node to the inclusive gateway (excluding incoming paths to the inclusive gateway that have already been taken).

For example: Once all selected courses are complete, the table can be cleared.

![An inclusive converging gateway waits until all incoming, executed sequence flows are completed before cleaning the table.](assets/inclusive-gateway-join.png)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/inclusive-gateways/inclusive-gateways
