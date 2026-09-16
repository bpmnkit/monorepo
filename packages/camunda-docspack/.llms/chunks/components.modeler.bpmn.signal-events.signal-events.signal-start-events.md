# Signal events — Signal start events

Signal start events can be used to start process instances. Deploying several processes with a signal start event enables
creation of multiple process instances by performing a single broadcast.

Broadcasting a signal iterates over the available subscriptions. If the name of the broadcasted signal matches the
name of the signal start event, the process instance is created.

Signal subscriptions only exist for the latest version of a process definition. Deploying a new version of the same
process (based on the BPMN process ID) will delete the old signal subscription. A new subscription is opened for the
new deployed process definition. When the latest version of a process is deleted, the signal subscription is also deleted. If the previous version of the same process (based on the BPMN process ID) contains a signal start event, a new subscription
is opened for it.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events
