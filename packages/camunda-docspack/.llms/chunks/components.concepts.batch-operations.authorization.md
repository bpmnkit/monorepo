# Batch operations — Authorization

When executing a batch operation, there are two sets of permissions involved:

- Batch operation permissions.
- Item-level, or process definition, permissions.

To create a batch operation, you always need both the permission to create batch operations as well as permissions to read process instances and execute specific operations on each targeted process instance.

To suspend, resume, or cancel an operation, you only need the relevant batch operation permissions.

The system stores authorization claims with the batch operation and uses them throughout its lifecycle.

**Info**
Read more about [authorizations](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations) and [how to create them in the Admin UI](https://docs.camunda.io/docs/next/components/admin/authorization).

---
Source: https://docs.camunda.io/docs/next/components/concepts/batch-operations
