# Orchestration Cluster REST API — Getting started

This section helps you get up and running in minutes.

### Prerequisites

- **A Camunda 8 Orchestration Cluster**
  - For local development, use [Camunda 8 Run](https://docs.camunda.io/docs/next/self-managed/quickstart/developer-quickstart/c8run) or [Docker Compose](https://docs.camunda.io/docs/next/self-managed/quickstart/developer-quickstart/docker-compose), which expose the API without requiring credentials or tokens by default.
  - For production or advanced development, use [Helm/Kubernetes](https://docs.camunda.io/docs/next/self-managed/deployment/helm/install/quick-install) or [manual installation](https://docs.camunda.io/docs/next/self-managed/deployment/manual/install).
  - Alternatively, sign up for a free [Camunda 8 SaaS trial](https://accounts.camunda.io/signup) to get a managed cluster with the API enabled.

- **A client to send API requests**
  - Quick testing: Use the [Swagger](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-swagger) interface
  - Programmatic access: Use the [Java client](https://docs.camunda.io/docs/next/apis-tools/java-client/getting-started) or [Camunda Spring Boot Starter](https://docs.camunda.io/docs/next/apis-tools/camunda-spring-boot-starter/getting-started)
  - Custom client: [Download the OpenAPI spec](https://github.com/camunda/camunda/blob/main/zeebe/gateway-protocol/src/main/proto/rest-api.yaml) to generate your own client
  - Universal client: [Postman collection](https://www.postman.com/camundateam/camunda-8-postman/collection/apl78x9/camunda-8-api-rest)

### Authentication

Authentication for the Orchestration Cluster REST API depends on your environment and how you deploy Camunda 8. Authenticate your Client requests based on your setup.

**Supported authentication methods**

- No authentication – For local development only
- Basic authentication – Username/password for simple setups
- OIDC-based authentication – Use OAuth2/OIDC tokens for production environments

**Quick reference**

- See the [authentication support matrix](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication#authentication-support-matrix) for details on supported methods by deployment type
- If you're using the Java or Spring clients, token management is handled automatically. See [client authentication configuration](https://docs.camunda.io/docs/next/apis-tools/camunda-spring-boot-starter/getting-started#configuring-the-camunda-8-connection)

For detailed authentication setup, follow the step-by-step guide in [Authentication](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication) based on your deployment type.

### Test your connection

Once you're set up, verify your connection works by making your first API call:

#### Using curl

Local (Camunda 8 Run / Docker Compose):

```bash
curl http://localhost:8080/v2/topology
```

SaaS, public connectivity:

```bash
curl https://${REGION_ID}.api.camunda.io/${CLUSTER_ID}/v2/topology
```

SaaS, secure connectivity (AWS PrivateLink):

```bash
curl https://${CLUSTER_ID}.${REGION_ID}.privateconnectivity.camunda.io/api/v2/topology
```

Replace the placeholders with the values for your environment.
See [Base URLs](#base-urls) for details on SaaS (public and secure connectivity) and self-managed setups.

#### Using Postman

Try the [get cluster topology](https://www.postman.com/camundateam/camunda-8-postman/request/en495q6/get-cluster-typology) request or browse the full collection.

This request returns information about your cluster topology, confirming that your setup is working correctly.

### Try your first workflow

If you're just getting started with process automation, try this simple workflow:

1. **Model a process** – Create a simple BPMN process with a user task using [Camunda Modeler](https://camunda.com/download/modeler/)
2. **Deploy the process** – Use [`POST /deployments`](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-deployment.api) to deploy your BPMN file
3. **Start a process instance** – Use [`POST /process-instances`](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-process-instance.api) to create a new process instance
4. **Complete a user task** – Use [`POST /user-tasks/{userTaskKey}/completion`](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/complete-user-task.api) to complete the task

For a complete walkthrough with code examples, see our [Getting Started Tutorial](https://docs.camunda.io/docs/next/guides/getting-started-example).

### Explore the API

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview
