# Process instance modification — Activate an interrupting event subprocess

We can use the modification command to activate an interrupting event subprocess of the process. Consider the following
example:

![The process instance waits on task. We use the modification command to activate an interrupting event subprocess in the same scope.](assets/process-instance-modification/process-instance-modification-activate-interrupting-event-subprocess.png)

The process instance completed the first task `A` and waits on task `B`. Task `C` is embedded in an interrupting message
event subprocess. An external system will publish the message and interrupt the process, but it is not available.

To correct the state of the process instance, we modify it and activate the interrupting event subprocess. As a result,
the event subprocess is active and enters the start event. But the activation doesn't interrupt the process instance
and terminate task `B`. So, both tasks `B` and `C` are active.

If we want to simulate the interrupting behavior of the event subprocess, we need to add a modification instruction
to [terminate the instance](#terminate-an-element-instance) of the task `B`.

If the start event of the event subprocess has output variable mappings, we may need to
[set the variables](#set-variables) with the activation instruction.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification
