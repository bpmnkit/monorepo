# Process instance suspension — Impact on Connectors

**Inbound connectors** publish messages to correlate with waiting process instances. Because message correlation is suppressed during suspension, data from an inbound connector that arrives while the instance is suspended is permanently lost for that instance.

**Outbound connectors** run as service task jobs. Job handout is suppressed during suspension, so new outbound connector jobs aren't activated. A connector job already running in a worker when suspension occurs is not interrupted, but any completion or failure during suspension is rejected and the job re-executes on resume. If the connector action is not idempotent (for example, sending a message or charging a card), it may run more than once.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-suspension
