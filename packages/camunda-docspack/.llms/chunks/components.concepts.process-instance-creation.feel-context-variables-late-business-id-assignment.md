# Process instance creation — FEEL context variables — Late Business ID assignment

You can assign a business ID to a running process instance that has none. This is useful when the domain identifier (for example, an order number or case reference) is not available at instance creation time.

**Note**
Late assignment requires business ID uniqueness to be **disabled**. See [uniqueness control](#uniqueness-control) for details.

| Constraint              | Detail                                                                                                                                |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| Single and irreversible | Once set, the business ID cannot be changed or removed.                                                                               |
| Root instances only     | Call-activity children are always rejected.                                                                                           |
| No re-assignment        | Any attempt to assign to an instance that already has a business ID — whether the value matches or differs — returns `INVALID_STATE`. |
| Max length              | 256 characters.                                                                                                                       |

**Propagation is forward-only.** Only artifacts created after the assignment carry the business ID: future jobs, user tasks, decision instances, message subscriptions, and call-activity children. Pre-existing artifacts retain an empty `businessId`. An instance in this state shows a mixed view — older artifacts have no business ID, newer ones do.

**API surfaces:**

| Surface        | Details                                                                                                                                 |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| REST           | `POST /process-instances/{processInstanceKey}/business-id-assignment`                                                                   |
| gRPC           | `AssignProcessInstanceBusinessId`                                                                                                       |
| Job completion | Include `businessId` in the `CompleteJob` request. If assignment fails, the entire complete is rejected — the job is **not** completed. |

**Rejection contract:**

| Failure                                                      | Rejection                    |
| :----------------------------------------------------------- | :--------------------------- |
| Instance not found or wrong tenant                           | `NOT_FOUND`                  |
| Target is a call-activity child                              | `INVALID_STATE`              |
| Business ID uniqueness is enabled                            | `INVALID_STATE`              |
| Instance already has a business ID (same or different value) | `INVALID_STATE`              |
| Value fails validation (for example, exceeds 256 characters) | `INVALID_ARGUMENT`           |
| Not authorized                                               | `UNAUTHORIZED` / `FORBIDDEN` |

Required permission: `UPDATE_PROCESS_INSTANCE` on the process definition.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
