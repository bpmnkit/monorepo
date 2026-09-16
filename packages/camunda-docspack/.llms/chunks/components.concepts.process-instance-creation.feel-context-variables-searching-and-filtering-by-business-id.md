# Process instance creation — FEEL context variables — Searching and filtering by business ID

Starting in 8.10, `businessId` is available across multiple entity types. Searchability varies by entity:

| Entity                | Searchable | Visible | Notes                                                                               |
| :-------------------- | :--------- | :------ | :---------------------------------------------------------------------------------- |
| Process instances     | Yes        | Yes     | Available since 8.9.                                                                |
| Decision instances    | Yes        | Yes     | Available since 8.10.                                                               |
| User tasks            | Yes        | Yes     | Available since 8.10.                                                               |
| Messages              | Yes        | Yes     | API only. Not shown in the Operate process instance details view.                   |
| Message subscriptions | Yes        | Yes     | API only.                                                                           |
| Jobs                  | No         | Yes     | Visible in job activation response. Not searchable, filterable, or shown in the UI. |

#### Advanced filter operators

The API supports the following operators for `businessId`. Operate and Tasklist expose a subset in their filter UI.

| Operator  | Description                 | Wildcards                           | UI label  |
| :-------- | :-------------------------- | :---------------------------------- | :-------- |
| `$eq`     | Exact match                 | —                                   | Equals    |
| `$neq`    | Does not match              | —                                   | API only  |
| `$exists` | Field is set or absent      | —                                   | API only  |
| `$like`   | Pattern match               | `*` (multi-char), `?` (single-char) | Contains  |
| `$in`     | Matches any value in a list | —                                   | Is one of |
| `$notIn`  | Matches no value in a list  | —                                   | API only  |

#### API reference

| Entity                | Endpoints                                                                                                                                                                                              |
| :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Process instances     | [Get](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-instance.api) · [Search](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-process-instances.api)   |
| Decision instances    | [Get](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-decision-instance.api) · [Search](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-decision-instances.api) |
| User tasks            | [Get](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-user-task.api) · [Search](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-user-tasks.api)                 |
| Message subscriptions | [Search](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-correlated-message-subscriptions.api)                                                                                    |
| Jobs (visible only)   | [Search](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-jobs.api) · [Activate](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/activate-jobs.api)                  |

#### Retroactive visibility

Business IDs assigned to process instances in 8.9 remain traceable because the business ID is stored on the process instance record. However, related artifacts — user tasks, decision instances, jobs, and message subscriptions — snapshot the business ID at their own creation time. Artifacts created before business ID visibility shipped for that entity type are not retroactively enriched and carry no `businessId` value.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
