# Secret resolution and job activation — Resolve references before activation

The broker resolves secret references on a background scheduler, not on the processing path, so a slow or unavailable secret store cannot stall processing.

Each physical tenant supports exactly one secret store, and that store's id must be `default`. A `camunda.secrets.<name>` reference always addresses it. `camunda.physical-tenants.<tenant-key>.secrets.*` can override which store backs a given tenant, but never adds a second store alongside it.

When the broker creates a job, it records each secret reference together with its position in the job variables. The variable value itself keeps the placeholder text `camunda.secrets.<name>`. Nothing is read from a secret store at this point.

The scheduler then works through the references that are still pending:

1. Each cycle collects up to `camunda.processing.engine.secrets.batch-resolution-limit` pending references and groups them by store.
2. The scheduler requests each store's group of references in one call. The store's local cache holds successfully resolved values for the next activation.
3. References beyond the limit stay pending and are collected by a later cycle. When a cycle reaches the limit and makes progress, the next cycle starts immediately instead of waiting for `camunda.processing.engine.secrets.interval`.

Resolution records carry no secret values. Only the store's cache holds a value, and only for as long as its cache entry lives.

A cached value expires a fixed time after it is written, regardless of when it was last read. The store can also evict the value earlier if its cache is full. If the value is no longer cached when the broker tries to activate a job, the broker parks the job and resolves the reference again.

Resolving the reference again also makes rotated secrets available to workers without a restart. Configure the store's cache lifetime and size under [`camunda.secrets.cache`](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#camundasecretscache).

Two kinds of failure are treated differently:

| Failure                                                      | Behavior                                                                                                                                                                                     |
| :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The store reports a secret as missing, forbidden, or invalid | Treated as permanent. The reference fails immediately, with no retry and no cache write.                                                                                                     |
| The store itself is unavailable                              | Treated as transient. The broker retries the store with exponential backoff. After `retry-max-attempts` consecutive failures, the broker fails every reference still pending for that store. |

The broker tracks retry state for its store rather than per secret and holds it in memory only. The retry state resets when the broker restarts or the partition changes leader. During backoff, the scheduler skips the store, so its references do not consume batch capacity that a healthy store can use.

A reference that fails permanently, or whose store never recovers, raises an incident for the jobs waiting on it. See [resolve secret lookup failures](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents#resolve-secret-lookup-failures) for the incident message, how to tell the causes apart, and what resolving it does.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
