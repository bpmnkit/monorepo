# Process instance migration — Limitations

Not all process instances can be migrated to another process definition.
In the following cases, the process instance can't apply the migration plan and rejects the migration command.

- Process instance migration can only migrate active process instances, i.e. existing process instances that have not yet been completed, terminated, or banned.
- All active elements require a mapping.
- The number of active elements cannot be changed. You can use [process instance modification](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification) to achieve this instead.
- The target process definition must exist in Zeebe, i.e. it must be deployed and not yet deleted.
- The migration plan can only map each `sourceElementId` once.
- A mapping instruction's `sourceElementId` must refer to an element existing in the process instance's process definition.
- A mapping instruction's `targetElementId` must refer to an element existing in the target process definition.
- Catch event limitations:
  - A mapping instruction cannot detach a catch event from an active element.
    For example, a service task `A` has timer boundary event `T1` and will be migrated to the service task `B` has timer boundary event `T2`.
    If a mapping instruction between `A` -> `B` is provided, a mapping instruction for `T1` can only refer to `T2`.
  - Each catch event can only be the target of a mapping instruction once.
  - Two catch events in the source cannot be mapped to the same catch event in the target.
  - A catch event in the source cannot be mapped to a different type of catch event in the target.
  - The message subscription for the message catch event in the source process instance needs to be fully distributed before the migration.
- Multi-instance body limitations:
  - Each child instance of a multi-instance body should be migrated separately because they belong to another process instance.
  - It is not possible to migrate a parallel multi-instance body to a sequential multi-instance body and vice versa.
- Scope limitations:
  - You cannot migrate an active embedded subprocess to an event subprocess. See [migrate active elements inside subprocesses](#migrate-active-elements-inside-subprocesses).
  - You cannot change the scope of a subprocess during migration.
  - Changing the scope of an ad-hoc subprocess during migration is not possible. See [migrate active elements inside ad-hoc subprocesses](#migrate-active-elements-inside-ad-hoc-subprocesses).
- Mapping instructions can only change the user task implementation from a job-worker user task to a Camunda user task, but not vice versa.
- You cannot migrate embedded forms when migrating a job worker user task to a Camunda user task. The migration uses the form defined in the target user task definition. See [migrate job worker user tasks to Camunda user tasks](#migrate-job-worker-user-tasks-to-camunda-user-tasks).
- Provide a mapping instruction between catch events to migrate message catch events when the target catch event has the same message name. You cannot re-create a message catch event with the same message name in the target process definition. See [deal with catch events](#deal-with-catch-events).

The following limitations exist that may be supported in future versions:

- Only [supported BPMN elements](#supported-bpmn-elements) can be migrated.
- The following scenarios cannot be migrated:
  - An element that becomes nested in a newly added subprocess
  - An element that was nested in a subprocess is no longer nested in that subprocess
- Mapping instructions cannot change the element type
- The process instance must be in a wait state, i.e. waiting for an event or external input like job completion. It may not be taking a sequence flow or triggering an event while migrating the instance.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
