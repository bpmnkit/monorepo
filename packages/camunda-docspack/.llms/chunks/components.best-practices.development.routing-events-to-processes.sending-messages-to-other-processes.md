# Routing events to processes — Sending messages to other processes

If messages are exchanged between different processes deployed in the workflow engine you have to implement the communication yourself by writing some code that starts a new process instance.

Diagram (BPMN): Invoice Receipt (Process Engine)
  start "Order received" → business rule task "Validate order" → intermediate catch event "Payment received" → call activity "Order Shipping" → end "Order processed"

Diagram (BPMN):
  start "Input received" → "Do OCR and classify input data" → send task "Route input" → end "Input processed"

Diagram (BPMN):
  start "Daily" → service task "Retrieve new payments" → send task "Notify waiting order" → end "Payment checked"

**(1)**

Use some simple code on the sending side to route the message to a new process instance, for example by starting a new process instance by the BPMN ID in Java:

```java
@JobWorker(type="routeInput")
public void routeInput(@Variable String invoiceId) {
  Map<String, Object> variables = new HashMap<String, Object>();
  variables.put("invoiceId", invoiceId);
  zeebeClient.newCreateInstanceCommand()
    .bpmnProcessId("invoice").latestVersion()
	.variables(variables)
    .send()
    .exceptionally( throwable -> { throw new RuntimeException("Could not create new process instance", throwable); });
}
```

**(2)**

Use some simple code on the sending side to correlate the message to a running process instance, for example in Java:

```java
@JobWorker(type="notifyOrder")
public void notifyOrder(@Variable String orderId, @Variable String paymentInformation) {
  Map<String, Object> variables = new HashMap<String, Object>();
  variables.put("paymentInformation", paymentInformation);

  zeebeClient.newPublishMessageCommand()
    .messageName("MsgPaymentReceived")
    .corrlationKey(orderId)
    .variables(variables)
    .send()
    .exceptionally( throwable -> { throw new RuntimeException("Could not publish message", throwable); });
}
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/routing-events-to-processes
