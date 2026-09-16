# Routing events to processes — Handling messages sent by a user

Sometimes explicit "user tasks" are not an appropriate choice to involve a human user to participate in a process: the user does not want to observe a task in Tasklist, but rather have the possibility to actively trigger some action right at the time when it becomes necessary from a business perspective. The difference is which event gives the _active trigger_.

Diagram (BPMN): Payment (Manager)
  start "Daily" → "Check new payments on bank account" → "Mark order as paid" → end "Payments processed"
  note: Approved invoices are those waiting for the 'Payment received' message
  note: For all payed orders found

Diagram (BPMN): Invoice Receipt (Process Engine)
  start "Invoice received" → business rule task "Validate order" → intermediate catch event "Payment received" → call activity "Order Shipping" → end "Order processed"

**(1)**

We did not model a user task in this process, as the user will not immediately be triggered. The user cannot do anything at the moment when the process enters this event. Instead, we made it wait for a "message" which is later triggered by a human user.

**(2)**

The accountant actually receives the "external trigger" by actively looking at new payments in the bank account.

**(3)**

Every new payment now has to be correlated to the right waiting process instance manually. In this situation it is often the better choice not to model a user task, but let the process wait for a "message" generated from a user.

These scenarios are not directly supported by Camunda Tasklist. A custom search screen built for the accountant might allow you to observe and find orders waiting for a payment. By interacting with such a screen, the accountant communicates with those process instances all at once. When hitting a 'Paid' button, a piece of custom code using the API must now correlate the user's message to the affected process instance(s).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/routing-events-to-processes
