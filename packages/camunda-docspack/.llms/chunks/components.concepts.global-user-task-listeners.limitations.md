# Global user task listeners — Limitations

The [same limitations as model-level user task listeners](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#limitations) apply.

In addition to the above:

- **No tenant-specific configuration**: Configuration is cluster-wide, not per tenant. Payloads include `tenantId` for downstream handling.
- **Restart required**: Changes made through Unified Configuration take effect only after a cluster restart. This limitation does not apply when you manage listeners through the Orchestration Cluster API.

---
Source: https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners
