# Identity and access management in Camunda 8 — Authentication vs. authorization

Authentication and authorization are the two fundamental concepts for access control in Camunda 8.

### Authentication

Authentication verifies who a user or client is.
For example, you log in with a username and password or through SSO.

### Authorization

Authorization determines what an authenticated user or client is allowed to access in Camunda 8 and which actions they can perform on those resources.

For example, a user's authorizations allow them to access Operate, view running or completed process instances, start new process instances, or claim and complete user tasks in Tasklist and through the Orchestration Cluster REST API.

| Identity type               | Authorization model              | Description                                                                                                                                                                      | Management interface                   |
| :-------------------------- | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| Orchestration Cluster Admin | Fine-grained permissions         | Controls access to applications, APIs, and runtime resources through specific permissions for each resource type and action (for example, `PROCESS_DEFINITION` and `USER_TASK`). | Camunda Admin UI or API                |
| Management Identity         | Role-based access control (RBAC) | Uses predefined roles and permissions for users and groups to manage Camunda Hub and Optimize.                                                                                   | Keycloak admin console or external IdP |

### How authentication and authorization work together

1. Authentication happens first: The system verifies identity.
2. Authorization happens next: The system verifies permissions.

A user must be both authenticated and authorized to access protected resources.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/access-control-overview
