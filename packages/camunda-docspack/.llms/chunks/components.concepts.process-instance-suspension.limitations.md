# Process instance suspension — Limitations

The following known limitations apply to process instance suspension.

### Instance size limit

Under the default 4 MB `maxMessageSize` [configuration](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation#resolved-values-exceed-the-message-size), suspension may fail if a single process instance has:

- More than 4,000 active jobs
- More than 7,000 active message subscriptions
- A mix of active jobs and subscriptions that together exceed the limit

### Suspension vs. banning

Suspension is processed through the normal engine command pipeline, which means it isn't applied instantaneously. The suspend command is queued and processed in order behind other pending commands. If the engine is under high backpressure (for example, because a process instance is executing a tight loop or processing a very large input collection), the suspend command may be delayed significantly or rejected entirely.

As a result, suspension isn't a reliable mechanism for immediately stopping a process instance that is causing high cluster load. In situations where a runaway instance must be halted urgently, cancellation is more appropriate and should be preferred over suspension. For context on how the engine handles runaway instances internally, see [banned process instances](https://docs.camunda.io/docs/next/components/zeebe/technical-concepts/internal-processing#banned-process-instance).

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-suspension
