# Process instance migration — Deal with catch events — Add or remove catch events

You can also add or remove catch events.

Let's consider a process instance awaiting at a service task `A`.

![The process instance is waiting at the active service task A without any boundary events attached.](assets/process-instance-migration/migration-boundary-event_before.png)

You can migrate it to a process definition where a message event subprocess with message start event `M` is added to the process.
To do so, you only have to map element `A` to element `A` in the target process.
After migrating active element `A`, the process instance is newly subscribed to the message boundary event `M` (_a new subscription is opened_).

![After migrating, the process instance is subscribed to the newly introduced message event subprocess start event.](assets/process-instance-migration/migration-catch-event-target-added.png)

Likewise, you can migrate the process instance back to the previous process definition where no message event subprocess is defined.
To do so, you only have to map element `A` to element `A` again.
After migrating active element `A`, the process instance is no longer subscribed to the message start event `M` (_associated subscription is closed_).

![After migrating back, the process instance is no longer subscribed to the message boundary event](assets/process-instance-migration/migration-boundary-event_before.png)

Likewise, adding and removing catch events applies to all other supported catch event types as well.
For instance, an intermediate signal catch event can be added or removed in the same way as the message event subprocess in the example above.

**Tip**
Currently, a mapping instruction must be provided between catch events to migrate message catch events if the target catch event has the same message name.
Therefore, it is not possible to re-create message catch events with the same message name in the target process definition.
While we're working on resolving this, you can migrate this case by providing a mapping between the boundary events.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
