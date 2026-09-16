# Orchestration Cluster authorization — Default roles

Camunda provides predefined roles to simplify access management:

| Role ID              | Purpose                                                               | Typical authorizations                                                                                                                                                                                                                                                                            |
| :------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**            | Full control over all Orchestration Cluster resources and components. | All permissions for all resources: `READ`, `CREATE`, `UPDATE`, `DELETE`, including `ACCESS` to all web components and `REVEAL` on `SECRET`.                                                                                                                                                       |
| **app-integrations** | Technical role for executing app integration calls.                   | `READ_PROCESS_DEFINITION` on Process Definition (`*`), `CREATE_PROCESS_INSTANCE`, `READ_PROCESS_INSTANCE`, `UPDATE_PROCESS_INSTANCE` on Process Definition (`*`), `READ_USER_TASK`, `UPDATE_USER_TASK`, `CLAIM_USER_TASK`, `COMPLETE_USER_TASK` on Process Definition (`*`), `CREATE` on Document |
| **connectors**       | Technical role for executing connector calls.                         | `READ_PROCESS_DEFINITION` on Process Definition (`*`), `UPDATE_PROCESS_INSTANCE` on Process Definition (`*`), `CREATE` on Message (`*`), `CREATE`, `READ`, and `DELETE` on Document                                                                                                               |
| **readonly-admin**   | Audit-focused users who need read-only access across the cluster.     | `READ` for all resources, including `READ_PROCESS_DEFINITION`, `READ_PROCESS_INSTANCE`, `READ_USER_TASK`, etc. Does not include `REVEAL` on `SECRET`.                                                                                                                                             |
| **rpa**              | Role for RPA workers.                                                 | `READ` on Resource (`*`), `UPDATE_PROCESS_INSTANCE` on Process Definition (`*`)                                                                                                                                                                                                                   |
| **task-worker**      | Default role for task workers to handle their own user tasks.         | Property-based `User Task` authorizations on properties `assignee`, `candidateUsers`, `candidateGroups` with permissions `READ`, `CLAIM`, `COMPLETE` (one authorization per property).                                                                                                            |

### Role assignment in SaaS

- **admin**: Automatically assigned to organization owner and admin.
- **connectors**: Automatically assigned to Connector Runtime in cluster deployment.
- **app-integrations**: Automatically assigned to app integration clients in cluster deployment.
- **readonly-admin**: Automatically assigned to Camunda Support agents for support cases.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
