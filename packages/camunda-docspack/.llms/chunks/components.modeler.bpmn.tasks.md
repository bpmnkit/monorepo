# Overview

This document outlines an overview of supported elements.

The basic elements of BPMN processes are tasks; these are atomic units of work composed to create a meaningful result. Whenever a token reaches a task, the token stops and Zeebe creates a job and notifies a registered worker to perform work. When that handler signals completion, the token continues on the outgoing sequence flow.

Choosing the granularity of a task is up to the person modeling the process. For example, the activity of processing an order can be modeled as a single _Process Order_ task, or as three individual tasks _Collect Money_, _Fetch Items_, _Ship Parcel_. If you use Zeebe to orchestrate microservices, one task can represent one microservice invocation.

Currently supported elements:

- [Service tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks)
- [User tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks)
- [Receive tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks)
- [Business rule tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks)
- [Script tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/script-tasks/script-tasks)
- [Send tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/send-tasks/send-tasks)
- [Manual tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/manual-tasks/manual-tasks)
- [Undefined tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/undefined-tasks/undefined-tasks)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/tasks
