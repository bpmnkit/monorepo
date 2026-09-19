# Process instance deletion — Eventual consistency

Process instance deletion runs asynchronously. Depending on how many process instances you delete, it can take time for the data to be removed and for the process instance to disappear from Operate.


## Technical details

This section explains how process instance deletion is handled internally to help you understand timing and consistency behavior.

Deleting one or more process instances uses [batch operations](https://docs.camunda.io/docs/next/components/concepts/batch-operations).

The Zeebe engine queries [secondary storage](https://docs.camunda.io/docs/next/self-managed/concepts/secondary-storage/index) for process instances to delete. For each instance found, the engine writes a delete command to the log, which results in a deleted event.

Exporters consume the deleted event and write a record to secondary storage to mark the process instance for deletion. An asynchronous scheduled task then deletes all data associated with each marked process instance.

```mermaid
sequenceDiagram
    V2 API->>+Engine: Delete process instances with filter
    Engine->>Engine: Create batch operation
    Engine->>-V2 API: Batch operation create response
    Engine->>+Secondary storage: Query process instances
    activate Engine
    Secondary storage->>-Engine: Return process instance keys
    loop for each process instance key
    Engine->>Engine: Write DELETED event for each process instance key
    Engine->>+Exporter: Export DELETED event
    deactivate Engine
    Exporter->>-Secondary storage: Mark process instance for deletion
    end
    note over V2 API,Deletion job: Everything below this note happens asynchronously.
    Deletion job->>+Secondary storage: Retrieve marked process instance keys
    activate Deletion job
    Secondary storage->>-Deletion job: Return process instance keys
    loop for each process instance key
    Deletion job->>Deletion job: Delete associated data
    end
    deactivate Deletion job
```

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-deletion
