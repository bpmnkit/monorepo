# Configure global user task listeners — Configure via Orchestration Cluster API

**Note**
You need [specific authorizations](https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners/access-control) to manage global listeners through the API.

Read more about [authorizations](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations) and [how to create them in the Admin UI](https://docs.camunda.io/docs/next/components/admin/authorization).

The [Orchestration Cluster API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview) provides CRUD operations to manage global user task listeners at runtime. This allows you to create, update, and delete listeners without restarting the cluster.

When you create or update a listener through the API, provide the properties described in [global listener definition](https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners#global-listener-definition). The `source` property is set automatically to `API`.

Changes take effect immediately after the API call for new lifecycle events on running and new instances, without requiring model redeployments or a cluster restart.

---
Source: https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners/configuration
