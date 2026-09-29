# Try with Swagger — Prerequisites

Before using Swagger UI, ensure you have:

- **A running Camunda 8 Orchestration Cluster:** SaaS or Self-Managed
- **Appropriate [access permissions](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations)** to the resources you want to manage via the API (if authorizations are enabled).


## Accessing Swagger UI

### SaaS

For SaaS clusters, Swagger UI is accessible through your cluster's dedicated endpoint.

1. Open Camunda Hub.
1. In the left navigation under **Clusters**, select a cluster.
1. If the cluster is paused, you must [resume](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-cluster#resume-a-cluster) it before accessing the Swagger UI.
1. Under **Cluster Details**, click **Open Swagger UI**.

**Note**
Swagger UI is protected with CSRF. If you are logged into Camunda Hub, you can access Swagger UI directly. If not, you may need to log in first.

### Self-Managed

For Self-Managed deployments, Swagger UI is available at your configured [Zeebe Gateway](https://docs.camunda.io/docs/next/reference/glossary#zeebe-gateway) endpoint.

**Default setup:**
`http://localhost:8080/swagger`

**Custom configuration:**
Use the host and path defined for your Zeebe Gateway in the [configuration guide](https://docs.camunda.io/docs/next/self-managed/deployment/helm/configure/ingress/ingress-setup), then append `/swagger`.

**Example with custom domain:**
`https://your-zeebe-gateway.company.com/swagger`

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-swagger
