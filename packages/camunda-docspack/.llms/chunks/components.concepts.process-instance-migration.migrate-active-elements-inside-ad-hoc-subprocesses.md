# Process instance migration — Migrate active elements inside ad-hoc subprocesses

Active elements located inside ad-hoc subprocesses can be migrated as part of a process instance migration.

Consider the following example, where you want to migrate an active element that is located in an ad-hoc subprocess:

![The service task A is inside the ad-hoc subprocess A.](assets/process-instance-migration/migration-adhoc-subprocess_before.png)

After migrating active element `A` to `B` and `Ad-Hoc Subprocess A` to `Ad-Hoc Subprocess B`, the process instance will look like this:

![After migrating the process instance, it is waiting at service task B inside the Ad-Hoc Subprocess B.](assets/process-instance-migration/migration-adhoc-subprocess_after.png)

**Important**
To migrate ad-hoc subprocesses, you must provide a mapping instruction from the process instance’s ad-hoc subprocess ID to the target ad-hoc subprocess ID.

Changing the scope of ad-hoc subprocesses during migration is not possible.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
