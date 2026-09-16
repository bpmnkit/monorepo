# Process instance migration — Deal with catch events — Migrate catch events

Catch events can be migrated by providing a mapping instruction between the source and the target catch event.
Providing a mapping between catch events ensures that the event subscription in the source process is preserved after the migration.
In the following section we will discuss situations where mapping a catch event may or may not be useful.
Let's explain both mapping and non-mapping scenarios with examples.

#### A mapping instruction is provided between the catch events

An active user task has been waiting for a timer boundary event.
The timer boundary event is defined as a duration of one week.
The user task has not been completed and has already spent five days waiting for the timer.

![The process instance is waiting at the active user task A with a timer boundary event attached.](assets/process-instance-migration/migration-catch-event-source.png)

Now we want to [change an inactive part of the process](#change-the-process-instance-flow-for-inactive-parts) by adding a user task after the timer boundary event.
Instead of waiting for the full time defined by the target process' timer boundary event, we only want to wait for the remaining two days.
To achieve this for the example above, the mapping between active user tasks `A` -> `A` and timer boundary events `Timer1` -> `Timer2` must be provided.
This ensures the timer is migrated (_the associated subscription is migrated_) and the duration is preserved.
Assuming that the timer boundary event is defined as 2 weeks duration in the target process, the process instance will look as follows after the migration:

![The process instance is waiting at the active user task A with the migrated timer boundary event attached.](assets/process-instance-migration/migration-catch-event-different-target.png)

Mapping catch events applies to other event types as well.
For example, if you want to keep the message name the same for a message event subprocess, you should map the start event of the event subprocess when migrating the process instance.
Another example would be to preserve a signal name for an intermediate signal catch event attached to an event-based gateway. In this case, you should map the signal catch event to the one in the target while migrating the process instance.

#### No mapping instruction is provided between the catch events

Before moving forward with the example, there are two important scenarios to consider because they affect the output after the migration:

- The catch event in the source process is identical to the catch event in the target process.
- There are changes between these catch events, for example, the message name is different in the target.

Let's consider again the same example above:

An active user task has been waiting for a timer boundary event.
The timer boundary event is defined as a duration of one week.
The user task has not been completed and has already spent five days waiting for the timer.

![The process instance is waiting at the active user task A with a timer boundary event attached.](assets/process-instance-migration/migration-catch-event-source.png)

In the first scenario, the catch event in the source process is identical to the catch event in the target process:

This time we want to reset the timer and wait for the full week again.
To achieve this for the example above, only a mapping between active user tasks `A` -> `A` must be provided.
This will cancel the timer (_associated subscription is closed_) and create a new one (_a new subscription is opened_).
After the migration the process instance will look like following:

![The process instance is waiting at the active user task A with a new timer boundary event attached.](assets/process-instance-migration/migration-catch-event-identical-target-trigger-updated.png)

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
