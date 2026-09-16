# Creating readable process models — Helpful practices — Emphasizing the happy path

You may want to emphasize the _"happy path"_ leading to the delivery of a successful process result by placing the tasks, events, and gateways belonging to the happy path on a straight sequence flow in the center of your diagram - at least as often as possible.

Diagram (BPMN): TwitterDemoProcess
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [Yes: =approved] service task "Publish on Twitter" → end "Tweet published"
    — [No: =not(approved)] service task "Send rejection notification" → end "Tweet rejected"

The _five_ BPMN symbols belonging to the happy path are put on a straight sequence flow in the center of the diagram.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
