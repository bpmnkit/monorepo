# Messages — Message cardinality

A message is correlated only _once_ to a process (based on the BPMN process ID), across all versions of this process. If multiple subscriptions for the same process are opened (by multiple process instances or within one instance), the message is correlated only to one of the subscriptions.

When subscriptions are opened for different processes, the message is correlated to _all_ the subscriptions.

A message is _not_ correlated to a message start event subscription if an instance of the process is active and was created by a message with the same correlation key. If the message is buffered, it can be correlated after the active instance is ended. Otherwise, it is discarded.

### Duplicate subscriptions

When multiple process instances subscribe to the same message name and correlation key simultaneously, there is no guarantee about which instance receives the message.

The selection is non-deterministic by design. An alternative approach, for example, routing to the most recently created instance, would mask correlation key design problems during single-instance development testing, and then fail unexpectedly in production when multiple users run concurrent instances. Non-deterministic selection surfaces the problem early.

The optimal solution is to use **unique correlation keys per interaction**, so that each subscription is unambiguous. See [request-reply with unique correlation key](#request-reply-with-unique-correlation-key) for more details.

---
Source: https://docs.camunda.io/docs/next/components/concepts/messages
