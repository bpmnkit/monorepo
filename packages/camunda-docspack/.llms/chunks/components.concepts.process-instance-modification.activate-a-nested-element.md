# Process instance modification — Activate a nested element

We can use the modification command to activate an element of the process nested inside an embedded or an event
subprocess. This is a special case of [activating an element](#activate-an-element). Consider the following example:

![The process instance waits on a task inside a subprocess. We use the modification command to activate a task from a parallel flow in the same subprocess.](assets/process-instance-modification/process-instance-modification-activate-nested-element.png)

The process instance completed the first task `A` in the embedded subprocess. It passed the inclusive gateway and waited
on task `B`. Task `C` is also connected to the inclusive gateway, but the condition didn't match. The condition should
match, but the job worker for task `A` provided unexpected variables.

To correct the state of the process instance, we modify it and activate task `C`. As a result, task `C` is active in the
same instance of the subprocess as the other task `B`.

The process instance activates the element always in an existing instance of its subprocess.

If the subprocess doesn't have an active instance, the process instance creates a new instance of the subprocess
first. The creation of the subprocess can include the creation of the event subscriptions; for example, of boundary
events. In contrast to a regular activation of the subprocess, the process instance doesn't activate the start event
of the subprocess or apply any input variable mappings.

If the subprocess itself is nested in another subprocess, the same procedure is applied to this subprocess.

**Note**
The process instance can't activate the element if the subprocess has more than one active instance. It can't decide in
which instance of the subprocess to activate the element. As a result, the process instance doesn't apply the activation
instruction and rejects the command.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification
