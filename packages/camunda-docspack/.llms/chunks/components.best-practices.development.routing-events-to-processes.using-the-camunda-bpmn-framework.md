# Routing events to processes — Using the Camunda BPMN framework

If you use the **Camunda BPMN Framework** as described in the book ["Real Life BPMN"](https://page.camunda.com/wp-real-life-bpmn-book-excerpt) you will typically have message start events (even if you only have a single start event) to connect the surrounding human flows to the technical flow via messages:

Diagram (BPMN): TwitterDemoProcess
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [No] service task "Send rejection notification" → end "Tweet rejected"
    — [Yes] service task "Publish on Twitter" → end "Tweet published"

Diagram (BPMN):
  start "Great Idea" → "Write tweet" → "Publish tweet" → event-based gateway
    — intermediate catch event "Tweet published" → end "Employee happy"
    — intermediate catch event "Rejection notification received" → "Complain about boss" → end "Employee sad"

**(1)**

This is a message start event, which allows you to show the collaboration between the human and the technical flows. However, it is the only the starting point of the technical pool and could be a none start event in terms of execution.

If there is _exactly one message start event_ for the whole process definition, it can also be treated as if it were a none start event when starting a process instance.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/routing-events-to-processes
