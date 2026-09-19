# Process instance modification — Set variables

We can use the modification command to set one or more variables together by activating an element of the process.
Consider the following example:

![The process instance waits on task. We use the modification command to activate a task inside a non-interrupting message event subprocess.](assets/process-instance-modification/process-instance-modification-set-variables.png)

The process instance completed the first task `A` and waited on task `B`. Task `C` is embedded in a non-interrupting
message event subprocess. An external system will publish the message, but it is not available.

To correct the state of the process instance, we modify it and activate the task `C` inside the non-interrupting message
event subprocess. Additionally, we add variable instructions to the modification to set variables that should be
provided by the message.

The process instance sets the variables before activating the given element. As a result, the variables are available
when applying the input variable mappings and creating the event subscriptions of the element.

A variable instruction can define the [scope](https://docs.camunda.io/docs/next/components/concepts/variables#variable-scopes) of the variables. If a scope is defined, the process instance sets the variables as **local** variables in the given scope. For example, set the message variables
as local variables of the event subprocess. The scope must be a flow scope of the activating element.

If no scope is defined, the process instance sets the variables **globally** in the root scope of the process instance.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification
