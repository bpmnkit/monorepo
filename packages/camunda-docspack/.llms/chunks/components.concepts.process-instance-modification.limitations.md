# Process instance modification — Limitations

Currently, we can't modify the process instance in all possible ways. In the following cases, the process instance can't
apply the modification instructions and rejects the modification command.

- If the activating element is a BPMN element of the type:
  - A start event of a process or a subprocess
  - A boundary event
  - An event that belongs to an event-based gateway
  - A sequence flow
- If the modification terminates all active instances of a child process instance.


## Use at your own risk

Process instance modification is a powerful tool to repair a process instance. However, use it with care. You
can modify the process instance to create situations that are not reachable by the regular execution. Consider the
following example:

![The process instance waits on a task after a parallel joining gateway.](assets/process-instance-modification/process-instance-modification-use-at-your-own-risk.png)

The process instance completed the first tasks `A` and `B` and waits on task `C`.

We could apply the following modifications, but the process instance may end up in an unintended situation:

- If we activate task `A` again, the process instance is stuck on the parallel gateway.
- If we activate task `D` and don't set all variables that would be provided by the message, the task `D` could be
  processed with the wrong input.
- If we activate task `E` inside the interrupting event subprocess, the process instance doesn't interrupt task `C`
  and the processing of the tasks could override variables.

The process instance doesn't detect these situations. It is up to you to apply suitable modifications.

When in doubt, we recommend testing your modification on a non-production cluster or using [Camunda Process Test](https://docs.camunda.io/docs/next/apis-tools/testing/getting-started).

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification
