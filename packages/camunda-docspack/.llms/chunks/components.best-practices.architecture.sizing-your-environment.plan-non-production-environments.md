# Size your environment — Plan non-production environments

All clusters can be used for development, testing, integration, Q&A, and production.

For typical integration or functional test environments, you can usually deploy a small cluster even if your production environment is sized larger. This is typically sufficient, as functional tests run much smaller workloads.

Load or performance tests should ideally run on the same sizing configuration as your production cluster to yield reliable results.

A typical customer setup consists of:

- A production cluster.
- An integration or pre-production cluster (equal in size to your anticipated production cluster if you want to run load tests or benchmarks).
- A test cluster.
- Development clusters.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment
