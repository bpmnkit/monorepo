# Process instance migration — Migrate active elements inside subprocesses

Active elements located inside subprocesses can be migrated as part of a process instance migration.

Let's consider an example where we want to migrate an active element that is located in a subprocess.

![The service task A is inside the subprocess A.](assets/process-instance-migration/migration-subprocess_before.png)

After migrating active element `A` to `B` and `Subprocess A` to `Subprocess B`, the process instance will look like this:

![After migrating the process instance, it is waiting at service task B inside the Subprocess B.](assets/process-instance-migration/migration-subprocess_after.png)

**Note**
A mapping instruction must be provided from the process instance's subprocess ID to the target subprocess ID to migrate subprocesses.

**Note**
You cannot migrate an active embedded subprocess to an event subprocess.
Additionally, changing the scope of a subprocesses during migration is not possible.

### Call activities and called process instances

Active call activities can be migrated like any other element.
The called process instance is not changed when migrating the call activity.

You can migrate a called process instance in the same way as a regular process instance.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
