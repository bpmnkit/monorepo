# Message events — Message start events

A process can have one or more message start events (besides other types of start events). Each of the message events must have a unique message name.

When a process is deployed, it creates a message subscription for each message start event. Message subscriptions of the previous version of the process (based on the BPMN process ID) are closed.

### Message correlation

When the message subscription is created, a message can be correlated to the start event if the message name matches. On correlating the message, a new process instance is created and the corresponding message start event is activated.

Messages are **not** correlated if they were published before the process was deployed or if a new version of the process is deployed without a proper start event.

The `correlationKey` of a published message can be used to control the process instance creation.

- If an instance of this process is active (independently from its version) and it was triggered by a message with the same `correlationKey`, the message is **not** correlated and no new instance is created. If the message has a time-to-live (TTL) > 0, it is buffered.
- When the active process instance is completed or terminated and a message with the same `correlationKey` and a matching message name is buffered (that is, TTL > 0), this message is correlated and a new instance of the latest version of the process is created.

If the `correlationKey` of a message is empty, it creates a new process instance and does not check if an instance is already active.

**Note**

You do not specify a `correlationKey` for a message start event in the BPMN model when designing a process.

- When an application sends a message that is caught by a message start event, the application can specify a `correlationKey` in the message.
- If a message caught by a start event contains a `correlationKey` value, the `correlationKey` is used to ensure only one process instance is active per key (idempotency). The `correlationKey` is not stored as a tag on the process instance, and the `tags` field remains empty.
- Follow-up messages are then checked against this `correlationKey` value (that is, is there an active process instance that was started by a message with the same `correlationKey`?).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events
