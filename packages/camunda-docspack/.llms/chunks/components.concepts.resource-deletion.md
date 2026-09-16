# Resource deletion

Delete process definitions and decision requirements graphs from Camunda.

Use resource deletion to remove resources from a cluster when they are no longer needed or should no longer be used.

Deleting resources:

1. **Frees storage space**, as Zeebe no longer needs to keep the definition in its state.
2. **Prevents new instances from being created**, which can help avoid usage of faulty process definitions.

The following resource types can be deleted:

1. [Process definitions](https://docs.camunda.io/docs/next/components/concepts/processes)
2. [Decision Requirements Graphs (DRG)](https://docs.camunda.io/docs/next/components/modeler/dmn/decision-requirements-graph)

Delete a resource using [Operate](https://docs.camunda.io/docs/next/components/operate/userguide/delete-resources) or by sending the [delete resource command](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#deleteresource-rpc) to the Zeebe API.

---
Source: https://docs.camunda.io/docs/next/components/concepts/resource-deletion
