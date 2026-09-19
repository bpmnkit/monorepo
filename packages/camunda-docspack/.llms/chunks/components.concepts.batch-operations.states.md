# Batch operations — States

A batch operation can have one of the following statuses:

| Type                | Description                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Created             | The batch operation was created, but the filter hasn't been used yet to determine the affected process instances.     |
| Active              | The batch operation is actively being processed.                                                                      |
| Completed           | All items in the batch operation were processed, regardless of whether the individual operations succeeded or failed. |
| Partially completed | The batch operation successfully processed at least one partition and failed to process at least one partition.       |
| Suspended           | The batch operation was temporarily stopped. Suspended batch operations can be resumed.                               |
| Canceled            | The batch operation was permanently stopped. Canceled batch operations can't be resumed.                              |
| Failed              | The batch operation failed on all partitions.                                                                         |

**Info**
Learn more about batch partitions in our [implementation overview](https://docs.camunda.io/docs/next/components/zeebe/technical-concepts/batch-operations).

---
Source: https://docs.camunda.io/docs/next/components/concepts/batch-operations
