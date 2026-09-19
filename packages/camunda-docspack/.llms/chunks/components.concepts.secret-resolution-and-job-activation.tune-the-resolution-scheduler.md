# Secret resolution and job activation — Tune the resolution scheduler

Configure the scheduler under `camunda.processing.engine.secrets`. The defaults are intended for stores that respond in less than a second. The separate `camunda.secrets.cache.ttl` setting controls how long a resolved value remains cached before the reference must be resolved again.

Under a steady stream of pending references, cycles run close to `wake-delay` apart, not `interval`: `interval` only bounds how long a scheduler with nothing to resolve waits before checking again, growing there from `wake-delay` in geometric steps rather than jumping straight to it.

| Property                 | Default | Change it when                                                                                                                                                                                        |
| :----------------------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wake-delay`             | `50ms`  | Jobs that reference secrets take too long to activate under a steady stream of requests. A shorter delay reduces that latency at the cost of polling the stores more often.                           |
| `interval`               | `5s`    | A scheduler that is genuinely idle takes too long to notice a newly pending reference, or you want its idle ceiling to be different. Under load this value is rarely reached; see `wake-delay` above. |
| `batch-resolution-limit` | `20`    | A backlog of pending references builds up faster than it clears. A higher limit clears it faster at the cost of more concurrent load on the stores.                                                   |
| `retry-max-attempts`     | `3`     | You want to tolerate brief store outages before raising incidents.                                                                                                                                    |
| `retry-initial-delay`    | `1s`    | You need a longer or shorter delay before the first retry.                                                                                                                                            |
| `retry-backoff-factor`   | `2`     | You want retry delays to increase more slowly. A value of `1` keeps the delay constant.                                                                                                               |
| `retry-max-delay`        | `30s`   | You want to retry an unavailable store sooner or less often.                                                                                                                                          |

The retry settings apply to an unavailable store as a whole. A secret the store reports as missing or forbidden is never retried, because that failure is permanent.

See the [property reference](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties) for the full description of each property and its environment variable form.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
