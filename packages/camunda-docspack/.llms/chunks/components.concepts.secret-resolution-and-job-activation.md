# Secret resolution and job activation

Learn how the broker resolves secret references before job activation and injects resolved values when it hands a job to a worker.

Secret resolution lets job workers use secret values at runtime without storing those values in job variables or configuration.

A job whose variables contain an [Orchestration Cluster secret reference](https://docs.camunda.io/docs/next/reference/glossary#secret-reference-orchestration-cluster) is handed to a worker only after every reference has been resolved. The resolved values reach the worker without being written to any record, runtime state, or log.

The broker resolves secret references in the background rather than while processing a command. It injects the resolved values into the job only when handing the job to a worker. As a result, secret resolution can affect when a job becomes available for activation.

A cluster whose process models contain no `camunda.secrets.<name>` reference is unaffected by any of this. A model that does use a reference behaves differently depending on whether a secret store is configured: on a cluster with no store configured, every reference fails permanently as not found, and the job gets a [secret resolution error incident](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents#resolve-secret-lookup-failures) rather than a delay.

This page describes an alpha feature and may change in future releases. See [alpha features](https://docs.camunda.io/docs/next/components/early-access/alpha/alpha-features).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
