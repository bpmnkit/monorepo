# Process instance migration — Deal with catch events

An exception to changing the process instance state is specific to catch events.
This is necessary to ensure that the process instance can be executed according to the new process definition.
It allows you to add or remove catch events from an active element.
At the same time, you can leave an existing catch event unchanged.
This section explains how to deal with catch events when migrating a process instance.

You decide what happens to the associated event subscription through the mapping instructions for the catch events:

- Migrate catch events: if a catch event is mapped, the associated subscription is migrated.
- Remove catch events: if a catch event in the source process is not mapped, then the associated subscription is closed during migration.
- Add catch events: if a catch event of the target process is not the target of a mapping instruction, then a new subscription is opened during migration.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
