# Secret resolution and job activation — Secret resolution across physical tenants

The secret store, its cache, and the resolution scheduler's retry state are all scoped per [physical tenant](https://docs.camunda.io/docs/next/self-managed/concepts/physical-tenants/configuration-reference). A multi-tenant cluster resolves each tenant's `camunda.secrets.<name>` references against that tenant's own store: two tenants never share a cache entry, and one tenant's store outage does not affect another tenant's resolution.

`camunda.secrets.*` configures the store and cache defaults every physical tenant inherits. Override them for one tenant under `camunda.physical-tenants.<tenant-key>.secrets.*`. The tenant still supports only one store, under the same `default` id.


## Monitor secret resolution

A store that is slow or unavailable shows up as jobs that do not activate, and the job worker does not indicate the cause. The cluster emits meters for secret resolution and secret caches. Use these meters to distinguish a cold cache from a store that is not responding. To scrape and interpret cluster meters, see the [metrics reference](https://docs.camunda.io/docs/next/self-managed/operational-guides/monitoring/metrics#secret-resolution-and-cache-metrics).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
