# Orchestration Cluster authorization — Common authorization use cases

### Web component access

Users need specific permissions to access Orchestration Cluster web components:

- UI access: Resource type `Component` and a resource key identifying the component:
  - `operate` for Operate access
  - `tasklist` for Tasklist access
  - `admin` for Admin access
  - `identity` for Admin access (deprecated - please use `admin` instead)
  - `*` for access to all components
- Without these permissions, users cannot access the components.

#### Tasklist authorization model

Tasklist uses the Orchestration Cluster authorization model, including process-level permissions on `Process Definition` and task-level authorizations on `USER_TASK` (with property-based access control). For Tasklist-specific behavior and recommended patterns, see [User task authorization in Tasklist](https://docs.camunda.io/docs/next/components/tasklist/user-task-authorization).

**Note**
Tasklist V1 and its user task access restrictions (based on BPMN assignee, candidate users, and candidate groups) were removed in Camunda 8.10. If you're migrating from an earlier version, configure the appropriate `Process Definition` and `USER_TASK` authorizations to control who can see, claim, and complete tasks.

### Resource-level access

This section describes authorization for domain resources (such as process and decision definitions), not access to UI components or APIs. Users need additional permissions to access specific resources within web components:

- Process-related: Resource type `Process Definition`
  - `READ_PROCESS_DEFINITION` to view process models
  - `CREATE_PROCESS_INSTANCE` to start new processes
  - `UPDATE_PROCESS_INSTANCE` to update running instances
  - `MODIFY_PROCESS_INSTANCE` to modify running instances
  - `CANCEL_PROCESS_INSTANCE` to cancel running instances
  - `DELETE_PROCESS_INSTANCE` to delete completed instances

- Decision-related: Resource type `Decision Definition`
  - `READ_DECISION_DEFINITION` to view DMN models
  - `CREATE_DECISION_INSTANCE` to execute decisions

### API access

When implementing your own integrations (for example, using a Camunda client), consider the following:

- Job workers: Resource type `Process Definition`
  - `UPDATE_PROCESS_INSTANCE` to activate or complete jobs for the targeted process definitions

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
