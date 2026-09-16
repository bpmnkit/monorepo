# Service integration patterns with BPMN — Hiding technical complexity behind call activities

Whenever technical details of one service integration become complicated, you can think of creating a separate process model for the technicalities of the call and use a [call activity](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities) in the main process.

An example is given in chapter 7 of [Practical Process Automation](https://processautomationbook.com/):

![Hiding technical details behind call activity](service-integration-patterns-assets/hiding-technical-details-behind-call-activity.png)

In the customer scenario, a document storage service was long-running, but could not do a real callback or response message for technical reasons (in short, firewall limitations). As a result, the document storage service needed to be regularly polled for the response. In the customer scenario, this was done by a "document storage adapter" process that leveraged workflow engine features to implement the polling every minute, and especially the persistent waiting in between. In the main business process, this technical adapter process was simply invoked via a call activity, meaning no technicalities bloated that diagram.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns
