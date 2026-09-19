# Orchestration Cluster authorization — Available resources — Secret authorizations don't cover broker-side resolution

`SECRET:READ` and `SECRET:REVEAL` gate only the `/v2/secrets` API endpoints (`POST /v2/secrets/list` and `POST /v2/secrets/resolve`, respectively). They don't gate the broker resolving `camunda.secrets.<name>` references for job activation. Any process model may reference any configured secret, and any worker that receives a job with a resolved reference sees the value in plaintext, with no `SECRET` grant involved anywhere in that path. See [secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation).

The resource key for `SECRET` is the full reference, including the `camunda.secrets.` prefix (for example, `camunda.secrets.MY_KEY`). Only an exact match or `*` is supported, so a prefix such as `camunda.secrets.*` matches nothing.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
