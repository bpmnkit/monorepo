# Process instance creation — FEEL context variables

Starting in 8.10, the process instance properties are accessible in [FEEL expressions](https://docs.camunda.io/docs/next/components/concepts/expressions) via the `camunda.processInstance` context, resolvable in any FEEL expression across the process:

- `camunda.processInstance.key` — the process instance's system-generated key.
- `camunda.processInstance.businessId` — the process instance's [business ID](#business-id), or `null` if none is set.

These are the only `camunda.processInstance.*` context variables available in 8.10.


## Business ID

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
