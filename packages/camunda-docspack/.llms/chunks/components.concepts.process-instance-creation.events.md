# Process instance creation — Events

Process instances are also created implicitly via various start events. Camunda 8 supports message start events and timer start events.

### Message event

A process with a [message start event](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events#message-start-events) can be started by publishing a message with the name that matches the message name of the start event.

For each new message a new instance is created.

### Timer event

A process can also have one or more [timer start events](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events#timer-start-events). An instance of the process is created when the associated timer is triggered. Timers can also trigger periodically.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
