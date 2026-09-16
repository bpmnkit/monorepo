# Exclusive gateway

Learn more about exclusive gateways (or XOR-gateways) and their conditions, which allow you to make a decision based on data such as process variables.

An exclusive gateway (or XOR-gateway) selects one outgoing sequence flow based on data such as process variables.

![process](assets/exclusive-gateway.png)

For an exclusive gateway with multiple outgoing sequence flows:

- All but one sequence flow must have a `conditionExpression`.
- The remaining sequence flow can omit the `conditionExpression`, but the gateway must define it as the default flow.
- Leaving the `conditionExpression` empty does not automatically make a sequence flow the default flow. In Modeler, set the exclusive gateway's default flow in the gateway properties by selecting the outgoing sequence flow to use as the default.
- When a process instance reaches the gateway, the system evaluates the `conditionExpression` values in BPMN XML order and takes the first sequence flow whose condition is fulfilled.
  - If no condition is fulfilled, the process instance takes the **default flow**. The default flow should not have a condition, so the system does not evaluate it.
  - If no condition is fulfilled and the gateway has no default flow, an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) is created.

For example, if one sequence flow uses the condition `= totalPrice > 100`, you can set another outgoing sequence flow as the gateway's default flow to handle all remaining cases where `totalPrice <= 100`.

An exclusive gateway can also join multiple incoming flows to improve BPMN readability. A joining gateway has pass-through semantics and does not merge incoming concurrent flows like a parallel gateway.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/exclusive-gateways/exclusive-gateways
