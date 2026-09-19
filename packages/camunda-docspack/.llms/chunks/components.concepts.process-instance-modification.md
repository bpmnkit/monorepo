# Process instance modification

Use process instance modification to repair a running process instance.

Process instance modification is a powerful feature for repairing a running process instance. For example, a process instance may be stuck at an element, waiting for an event, or following an unintended path because an external system is unavailable or doesn't respond as expected.

Use the [modification command](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#modifyprocessinstance-rpc) to skip or repeat a step in the
process. Consider the following example:

![The process instance is stuck in the message catch event.](assets/process-instance-modification/process-instance-modification-example-1.png)

The process contains two service tasks and a message catch event in between. The process instance completed the first
task `A` and waits on the message catch event `B`. An external system will publish the message, but the external
system is not available and can't continue the process. The process instance is stuck.

![We use the modification to skip the event and continue on the next task.](assets/process-instance-modification/process-instance-modification-example-2.png)

We use the modification to repair the process instance. We "move the token" from the catch event `B` to the next
task `C`. This operation is presented by two instructions in the modification command:

- Terminate the instance of the catch event `B`.
- Activate the element `C`.

![After the modification is applied, the message catch event is terminated and the next task is active.](assets/process-instance-modification/process-instance-modification-example-3.png)

As a result of the command, the process instances terminated the instance of catch event `B` and activated the task `C`.
Now, the process instance is not stuck anymore and can continue in the process.

Generally, the process instance modification command can contain multiple instructions:

- To activate an element of the process.
- To terminate an active instance of an element.

Read more about the behavior of the instructions in the following sections.

**Note**
Use the process instance modification only in exceptional cases to repair the process instance. It is not
recommended using it as a part of the regular flow of the process; find additional details [here](#use-at-your-own-risk).
Instead, model all possible cases
explicitly in your process.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification
