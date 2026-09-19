# BPMN primer — Modeling BPMN diagrams — Events: Waiting for something to happen

**Events** in BPMN represent things that _happen_. A process can react to events (_catching_ event) as well as emit events (_throwing_ event). For example:

<center>
<ReactPlayer
playing
loop
playsInline
height="300px"
src="/videos/catch-event.mp4"
/>
</center>

The circle with the envelope symbol is a catching message event. It makes the token continue as soon as a message is received. The XML representation of the process contains the criteria for which kind of message triggers continuation.

Events can be added to the process in various ways. Not only can they be used to make a token wait at a certain point, but also for interrupting a token's progress.

Refer to the [events](https://docs.camunda.io/docs/next/components/modeler/bpmn/events) section on which types of events are currently supported and how to use them.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-primer
