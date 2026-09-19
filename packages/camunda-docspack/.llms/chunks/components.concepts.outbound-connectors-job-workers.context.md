# Outbound connectors vs. job workers — Context

Every job worker implementation defines on its own how to handle input data, validating and transforming it.
Plus, there is no unified modeling experience for job workers. There can be an element template for the worker, but that template might look completely different for every job worker.

Secrets are the exception. The Orchestration Cluster resolves `camunda.secrets.<name>` references in a job's variables and injects the values when it activates the job. The job worker receives the sensitive values at runtime without storing them in its own configuration, regardless of its implementation language or deployment location. See [secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation).

In contrast, connectors provide these capabilities out of the box, along with built-in secret management that lets you provide secrets in different ways.
Element templates, called [Connector templates](https://docs.camunda.io/docs/next/components/connectors/custom-built-connectors/connector-templates), are a vital part of a connector. There are standardized best practices for developing those.
Having used one connector template will make it easy for you to use the next one just the same.

---
Source: https://docs.camunda.io/docs/next/components/concepts/outbound-connectors-job-workers
