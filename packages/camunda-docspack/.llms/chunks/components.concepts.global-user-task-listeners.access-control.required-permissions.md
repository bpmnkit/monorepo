# Access control for global user task listeners — Required permissions

Global user task listeners use the `GLOBAL_LISTENER` resource type in the Orchestration Cluster authorization model. Only the wildcard resource ID `*` is supported. Authorizations for specific listener IDs are not evaluated.

To allow a user, group, role, or client to manage listeners through the Orchestration Cluster API or the Admin UI, grant authorizations on `GLOBAL_LISTENER` with resource ID `*` and the following permissions:

| Operation                                    | Required permission    | Related API endpoint                                                                                                                |
| :------------------------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| List or search global user task listeners    | `READ_TASK_LISTENER`   | [Search global user task listeners](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-global-task-listeners.api) |
| View a single global user task listener      | `READ_TASK_LISTENER`   | [Get global user task listener](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-global-task-listener.api)         |
| Create a new global user task listener       | `CREATE_TASK_LISTENER` | [Create global user task listener](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-global-task-listener.api)   |
| Update an existing global user task listener | `UPDATE_TASK_LISTENER` | [Update global user task listener](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/update-global-task-listener.api)   |
| Delete an existing global user task listener | `DELETE_TASK_LISTENER` | [Delete global user task listener](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-global-task-listener.api)   |

---
Source: https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners/access-control
