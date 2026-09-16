# Process instance modification — Terminate an element instance

We can use the modification command to terminate an active element instance of the process instance. Consider the
following example:

![The process instance waits on a task inside a nested interrupting event subprocess. We use the modification command to terminate the event subprocess.](assets/process-instance-modification/process-instance-modification-terminate-element-instance.png)

The process instance completed the first task `A` in the embedded subprocess. It triggered the interrupting timer event
subprocess and terminated task `B` inside the embedded subprocess. An external system published a message and triggered
the non-interrupting message boundary event on the subprocess. The process instance waits on task `C` inside the event
subprocess and on task `D` connected to the boundary event.

The job worker for task `C` failed to complete the job successfully. To skip the task and continue the process instance,
we modify it and terminate the element instance of the event subprocess.

As a result, the process instance terminates the event subprocess and the element instance of the task `C` that is
inside the event subprocess. Additionally, the process instance terminates the embedded subprocess because it doesn't
contain active element instances anymore.

Generally, the modification applies the following rules:

- If the terminating element instance is a subprocess, it terminates all active instances in the subprocess.
- If the terminating element instance is a call activity, it terminates the child process instance.
- If the terminating element instance was the last active instance inside a subprocess, it terminates the subprocess.
- If the terminating element instance was the last active instance of the process instance, it terminates the
  process instance.

If a terminating element instance is not active, the process instance doesn't apply the termination instruction
and rejects the command.

**Note**
The process instance can't terminate the last active element instance of a child process instance. As a result, the
process instance doesn't apply the termination instruction and rejects the command.

Instead, we can terminate the call activity that created the child process instance.

Terminating a user task via modification does not trigger its [`canceling` user task listener](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#trigger-a-user-task-listener).

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification
