# Process instance migration — Deal with gateways

Process instance migration allows you to migrate several scenarios for gateways:

- An active exclusive gateway with an incident can be migrated like any other active element.
- Parallel and inclusive gateways can be involved in [additional scenarios](#migrate-joining-parallel-and-inclusive-gateways).

### Migrate joining parallel and inclusive gateways

Joining parallel and inclusive gateways with taken incoming sequence flows, and which are still waiting for more incoming sequence flows, require a mapping instruction similar to active elements.

For migrating joining gateways, the following conditions must be true:

- The joining gateway in the process instance must be mapped to the target gateway.
- The target gateway must have at least the same number of incoming sequence flows as the source gateway.

Consider the following example:
The process instance is waiting at the joining parallel gateway, with an incoming sequence flow `flow1`, taken after the element `A` completes. Element `B` is still active and waiting at the user task.

![The instance waiting on joining gateway.](assets/process-instance-migration/migration-joining-gateway-before.png)

Then, the process definition is updated to include element `C` before the joining gateway.

To migrate the process instance, provide the following mapping instructions:

- From the active element `B` to the target element `B`.
- From the joining parallel gateway instance `gateway1` to the target joining parallel gateway `gateway2`.
- From the sequence flow `flow1` to the target sequence flow `flow2`.

After the migration, the process instance will look like the following:

In the example above, another element `C` is added before the joining gateway in the target process definition.
After the migration, element `B` must still be completed for the process instance to continue through the gateway.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
