# Process instance migration — Process definitions and versions

So far, we've only discussed migrating a process instance to a new version of its process definition.

You are free to migrate your process instance:

- From an older version to a newer version of the same process definition.
- From a newer version to an older version of the same process definition.
- To a different process definition altogether.

**Note**
You do not have to provide a mapping instruction from the process instance's process ID to the target process ID.


## Jobs, expressions, and input mappings

We do not recreate jobs, reevaluate expressions, and reapply input mappings of the active elements.
We also don't adjust any static values if they differ between the two process definitions.
Any existing variables, user tasks, and jobs continue to exist with the same values as previously assigned.

Let's consider an active service task that created a job when it was activated with type `send_mail`.
In the target process definition, the job type expression is changed as follows:

```feel
= order.next_step
```

However, on migrating the process instance this new job type expression is not evaluated.
Instead, the job keeps all properties it had before the migration, including the job type.

**Tip**
You can use [process instance modification](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification) to terminate and activate the service task if you want to create the job according to the new service task's definitions.
This results in new keys for the service task as well as the job.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
