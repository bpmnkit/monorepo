# Process instance migration — Change the active elements

Sometimes your requirements change so much that the currently active element no longer exists in the new process version.

Consider the following example: the process contains a completed exclusive gateway, taking the sequence flow to the service task `A` which is currently active.
It did not take the sequence flow to service task `B`, so it is inactive.

![The process instance is waiting at the active service task A while service task B is inactive.](assets/process-instance-migration/migration-active_before.png)

Due to changed requirements, our process model no longer contains the exclusive gateway, nor the service tasks `A` and `B`.
Instead, it only contains a new service task `C`.

![The target process only contains a service task C.](assets/process-instance-migration/migration-active-elements-target.png)

We can migrate the active service task `A` to this new service task `C` by providing a mapping instruction from source element ID `A` to target element ID `C`.

![After migrating the process instance, it is waiting at service task C.](assets/process-instance-migration/migration-active_after.png)

**Note**
You cannot map an element to an element of a different type.
An active service task of a process instance can only be mapped to a service task in the target process.
It cannot be mapped to a user task as this changes the element type.

Also note that the [jobs, expressions, and input mappings](#jobs-expressions-and-input-mappings) are not recreated.
So, while service task `C` is active in the target process, the associated job still has the job type from when it was associated to service task `A`.

**Tip**
If you need to adjust the job type to its new element, you can use [process instance modification](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification) to recreate the service task.
Simply cancel the service task instance, and add a new instance of the service task.

![The process instance can be modified to recreate the service task's job.](assets/process-instance-migration/migration-active_after-modification.png)

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
