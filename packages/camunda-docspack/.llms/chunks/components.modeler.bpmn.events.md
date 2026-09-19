# Overview

This document outlines an overview of general events, intermediate events, and boundary events.

**Events** in BPMN represent things that _happen_. A process can react to events (_catching_ event) as well as emit events (_throwing_ event). For example, a catching message event makes the token continue as soon as a message is received. The XML representation of the process contains the criteria for which kind of message triggers continuation.

Events can be added to the process in various ways. Not only can they be used to make a token wait at a certain point, but also for interrupting a token's progress.

Currently supported events:

- [None events](https://docs.camunda.io/docs/next/components/modeler/bpmn/none-events/none-events)
- [Message events](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events)
- [Timer events](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events)
- [Error events](https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events)
- [Escalation events](https://docs.camunda.io/docs/next/components/modeler/bpmn/escalation-events/escalation-events)
- [Terminate events](https://docs.camunda.io/docs/next/components/modeler/bpmn/terminate-events/terminate-events)
- [Link events](https://docs.camunda.io/docs/next/components/modeler/bpmn/link-events/link-events)
- [Signal events](https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events)
- [Compensation events](https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-events/compensation-events)

**Note**
Not all the events are supported yet. For a complete overview of supported events, refer to the [BPMN coverage](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-coverage#events).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/events
