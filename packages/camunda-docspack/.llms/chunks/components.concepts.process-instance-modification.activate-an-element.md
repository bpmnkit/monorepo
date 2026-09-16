# Process instance modification — Activate an element

We can use the modification command to activate an element of the process. Consider the following example:

![The process instance waits on task. We use the modification command to activate a task from a parallel flow.](assets/process-instance-modification/process-instance-modification-activate-an-element.png)

The process instance completed the first task `A` and waits on task `B`. Task `C` is connected to task `A` by a
non-interrupting message catch event. An external system will publish the message, but it is not available.

To correct the state of the process instance, we modify it and activate task `C`. As a result, task `C` is active, and a
job worker can pick it up.

The process instance activates the element in the same way as the regular flow; for example, if the incoming sequence
flow of the element would be taken. The activation of the element can include the following steps:

- Apply the input variable mappings.
- Create the event subscriptions; for example, of boundary events.
- Apply additional logic depending on the element; for example, create a job for a service task.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification
