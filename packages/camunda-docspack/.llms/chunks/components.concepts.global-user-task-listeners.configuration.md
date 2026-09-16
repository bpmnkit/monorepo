# Configure global user task listeners

Configuration methods for global user task listeners.

You can configure global user task listeners at the cluster level:

- [Through the Unified Configuration](#configure-through-unified-configuration).
- [Via the Orchestration Cluster API](#configure-via-orchestration-cluster-api).
- [Via the Admin UI](#configure-via-admin-ui), which uses the Orchestration Cluster API.

Use the Unified Configuration if:

- You want to define a static set of global listeners that are always active in the cluster.
- You want to use versioning tools to keep track of configuration changes.

Use the Orchestration Cluster API if:

- You want to dynamically manage listeners without restarting the cluster.
- You want to manage permissions for who can create, update, or delete global listeners through API access control.

You can use both methods at the same time. After a cluster restart:

- Listeners defined through Unified Configuration are recreated, even if they were deleted through the API before restart.
- API-defined listeners remain active in addition to configuration-defined listeners.
- If an `id` conflict occurs, the listener from Unified Configuration takes precedence and replaces the API-defined listener.

---
Source: https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners/configuration
