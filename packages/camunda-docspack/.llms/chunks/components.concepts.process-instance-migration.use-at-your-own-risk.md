# Process instance migration — Use at your own risk

Process instance migration is a powerful tool to change your process instances. However, use it with care.
You can migrate the process instance to create situations that are not reachable by the regular execution.
Consider the following example:

![The process instance waits on a task after a parallel joining gateway.](assets/process-instance-migration/migration-use-at-your-own-risk.png)

The process instance completed the first tasks `A` and `B` and waits on task `C`.

We could apply the following migrations, but the process instance may end up in an unintended situation:

- If we map task `C` to `A` or `B`, the process instance is stuck on the parallel gateway.
- If we map task `C` to `D`, the variables that would be provided by the message are not set, the task `D` could be processed with the wrong input.

The process instance doesn't detect these situations. It is up to you to apply suitable migrations.

When in doubt, we recommend testing your migration on a non-production cluster or using [Camunda Process Test](https://docs.camunda.io/docs/next/apis-tools/testing/getting-started).

**Tip**
Often it's safer to migrate in multiple smaller steps rather than in one big migration.
For example, you can start by migrating the process instance introducing changes to the inactive parts only to keep the current situation unchanged.

In some cases it's useful to prepare the process instance before migrating.
If your process needs specific variables immediately after migrating, you can set these before migrating the process instance.
Both global and local variables are migrated automatically.
Before migrating, you can also use process instance modification [activating an element](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification#activate-an-element)
to avoid the process instance getting stuck on a parallel gateway, or [terminate an element instance](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification#terminate-an-element-instance) to get rid of a parallel flow.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
