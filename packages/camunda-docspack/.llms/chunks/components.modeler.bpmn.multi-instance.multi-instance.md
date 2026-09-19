# Multi-instance

Learn about multi-instance activities like service tasks and receive tasks. These can be executed multiple times - once for each element of a given collection.

A multi-instance activity is executed multiple times - once for each element of a given collection (like a _foreach_ loop in a programming language).

We support the multi-instance marker for all [supported activities](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-coverage), such as service tasks, receive tasks, embedded subprocceses, and call activities. For example:

![multi-instance](assets/multi-instance-example.png)

On the execution level, a multi-instance activity has two parts: a multi-instance body, and an inner activity. The multi-instance body is the container for all instances of the inner activity.

When the activity is entered, the multi-instance body is activated and one instance for every element of the `inputCollection` is created (sequentially or in parallel). When all instances are completed, the body is completed and the activity is left.

**Note**
Events with a `JobWorker` implementation, such as intermediate throw events, do not support this marker.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance
