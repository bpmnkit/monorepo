# Batch operations

Get an overview of batch operations in Camunda 8.

A high-level overview of batch operations in Camunda 8.


## About batch operations

If a single process instance encounters an incident, or you need to update the instance for any other reason, you can perform an instance operation. However, if you need to perform the same operation on multiple instances, a batch operation:

- Optimizes the performance of operations that need to be performed across many process instances.
- Provides insights into the progress of the operation across all affected instances.
- Gives you control over operation execution, with the ability to suspend, resume, and cancel operations.

A **batch operation** is an operation on a selection, or batch, of process instances. Instead of manually operating on each instance, you can specify filter criteria and automatically identify and process matching instances across your cluster in parallel. The individual operation in the batch applied to a process instance is called a [**batch item**](https://docs.camunda.io/docs/next/components/zeebe/technical-concepts/batch-operations#batch-operation-components).

Example use cases include:

- Many process instances have encountered a critical bug.
- You need to skip an activity across multiple instances.
- There was in issue when executing a process that corrupted many or all instances of that process.

---
Source: https://docs.camunda.io/docs/next/components/concepts/batch-operations
