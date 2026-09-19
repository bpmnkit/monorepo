# Building flexibility into BPMN models — Examples

### Allow proactive order status communication

Assume that for an order to be validated, the customer must determine the delivery date before we can confirm the order. If the order is not acceptable—due to consistency issues or customer related issues—it is declined.

Some of our orders might be so important that we want to ensure we keep customers happy, even if not everything runs smoothly on our side.

Diagram (BPMN):
  start "Order received" → service task "Validate order" → service task "Check customer" → service task "Determine delivery date" → end "Order confirmed"

**(1)**

Order managers can request proactive customer communication on demand. Assume they can communicate the reasons via a form, whereas the communication as such is carried out by the call center.

**(2)**

On a regular basis, we check based on some rules, whether the order is so important that we proactively communicate why the order is not yet confirmed. Again, the communication is carried out by the call center.

### Allow for order cancellation any time

The customer might be allowed to request a cancellation until the order is confirmed. This request would have to be reviewed to determine whether we must accept the cancellation.

Diagram (BPMN):
  start "Order received" → service task "Validate order" → service task "Check customer" → service task "Determine delivery date" → end "Order confirmed"

**(1)**

Whenever the customer requests a cancellation until the order is confirmed, we review that request and decide whether we have to accept the cancellation or not.

**(2)**

If we accept the cancellation, we must terminate the entire process. To do so, we need to use one trick: throw an error event that will end the current event subprocess, but not yet the order process.

**(3)**

This leads to another subprocess to be triggered, and this one is interrupting. Now, the process instance is really cancelled.

### Allow for order details to change, but repeat order validation

**Caution: Camunda 7 Only**
Condition events are [not yet supported in Camunda 8](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-coverage)

If the customer changes the order details, the order must be validated again.

Diagram (BPMN):
  start "Order received" → subprocess "Order Processing" → service task "Determine delivery date" → end "Order confirmed"

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/building-flexibility-into-bpmn-models
