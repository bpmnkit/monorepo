# Process instance migration — Deal with catch events — Compensation boundary events

Compensation boundary events can be migrated similarly to other catch events, with one exception. If a compensation boundary event is added, a new compensation subscription is only opened for activity instances that are currently active, or haven't been started yet. For activity instances that have already finished, no new compensation subscription will be opened.

Consider the following example where the instance is waiting on service task `A`:

![The instance waiting on service task A.](assets/process-instance-migration/migration-compensation_before.png)

The target process definition contains a compensation boundary event attached to service task `A`:

![The target process definition contains a compensation boundary event attached to service task A.](assets/process-instance-migration/migration-compensation_after.png)

If the process instance is migrated by providing mapping instruction between service tasks `A` -> `A`, the compensation subscription will be created on completion of the element `A`.

However, if the process instance is migrated by providing mapping instruction between service tasks `A` -> `B`, then triggering compensation throw event afterward will not compensate `A`. This is because the subscription is only opened when completing a task with a compensation boundary event.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
