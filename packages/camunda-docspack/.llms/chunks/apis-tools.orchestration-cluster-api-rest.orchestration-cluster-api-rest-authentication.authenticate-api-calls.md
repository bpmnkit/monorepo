# Authentication — Authenticate API calls

### No authentication (local development)

By default, Camunda 8 Run and Docker Compose expose the Orchestration Cluster REST API without authentication for local development. You can make API requests directly:

```shell
curl http://localhost:8080/v2/topology
```

### Basic Authentication

Basic Authentication uses username and password credentials.

**For Camunda 8 Run:**  
Enable Basic Auth by configuring authentication in your `application.yaml`. See [Camunda 8 Run documentation](https://docs.camunda.io/docs/next/self-managed/quickstart/developer-quickstart/c8run/configuration#enable-authentication-and-authorization) for details.

**For Helm:**  
Basic Auth is enabled by default for the Orchestration Cluster API.

Include your username and password in each API request:

```shell
curl --user username:password \
     http://localhost:8080/v2/topology
```

**Note**
Basic Authentication checks the password with every request, limiting the number of requests per second. It may not be suitable for production.  
See [Camunda components troubleshooting](https://docs.camunda.io/docs/next/self-managed/operational-guides/troubleshooting)

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication
