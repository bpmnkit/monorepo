# Secret resolution — Cache behavior

Resolving is cache-first on both paths: the broker's background scheduler and the gateway's resolve endpoint each serve a reference from the store's cache when the cache already holds it, and only read the backing store for a reference the cache doesn't hold yet.

Listing is different by design. What a store's cache holds is the values it has resolved so far, not the tenant's full set of secrets. `/v2/secrets/list` always reads the configured stores directly rather than serving from the cache.


## Not currently supported

- More than one secret store per physical tenant. A reference always addresses the `default` store.
- Pinning an AWS Secrets Manager secret to a version stage other than `AWSCURRENT`, or a GCP Secret Manager secret to a version other than `latest`.
- Filtering or paginating a `POST /v2/secrets/list` response, see [Secrets](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-secrets#list-secrets).
- The general limitations that apply to every alpha feature, see [alpha features](https://docs.camunda.io/docs/next/components/early-access/alpha/alpha-features).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution
