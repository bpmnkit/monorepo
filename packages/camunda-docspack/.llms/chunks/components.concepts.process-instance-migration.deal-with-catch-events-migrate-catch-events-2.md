# Process instance migration — Deal with catch events — Migrate catch events (2)

In the second scenario, there are changes between these catch events:

Now, we want to reset the timer and wait for two weeks as in the target process definition.
To achieve this for the example above, only a mapping between active user tasks `A` -> `A` must be provided.
This will cancel the timer (_associated subscription is closed_) and create a new one (_a new subscription is opened_).
After the migration the process instance will look as follows:

![The process instance is waiting at the active user task A with a new timer boundary event attached.](assets/process-instance-migration/migration-catch-event-different-target-trigger-updated.png)

Same as above, omitting the mapping instruction for catch events applies to other event types as well.
For example, if you want to change the message name for a message event subprocess start event, you must omit mapping the message start event when migrating the process instance.
Another example would be to update a signal name for an intermediate signal catch event, you must omit mapping the signal catch event when to the one in the target while migrating the process instance.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
