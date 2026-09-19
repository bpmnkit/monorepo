# Process instance creation — Tags

Process instance tags are lightweight, immutable labels you can attach when creating a process instance via the API or clients. Tags are inherited by all jobs created from that instance. They help downstream workers and external systems make quick routing or decision choices without inspecting full variable payloads.

### Tag format and constraints

- A tag is a case-sensitive string.
- Format (regex): `^[A-Za-z][A-Za-z0-9_\-:.]{0,99}$`
  - Must start with a letter (A–Z or a–z).
  - Remaining characters may be alphanumeric, underscore (`_`), hyphen (`-`), colon (`:`), or dot (`.`).
- Length: 1–100 characters.
- Maximum of 10 unique tags per process instance (duplicates are ignored).
- Order is not guaranteed; treat the set as unordered.
- Tags cannot be modified after creation

If validation fails during process instance creation (for example, too many tags, invalid pattern, or length), the create request is rejected with a 4xx error.

### Semantics

- Tags are included in process instance search responses and in activated job payloads.
- Tags are immutable after creation - cannot be added, changed, or removed after process instance has been created.
- Search filtering uses AND semantics: an instance must contain all requested tags (it may contain additional tags). Partial or wildcard matching is not supported.
- Tags are exported with the process instance and with job entities starting in 8.8 by the default exporters.
- Tags are not shown in web applications (such as Operate and Tasklist) — they are API/client-only metadata.

### Use cases

- Routing and prioritization (for example, `priority:high`)
- Business or domain identifiers from internal or third-party systems (for example, `reference:1234`, `team:accounting`, `origin:crm`)
- Cross-system correlation keys without exposing full variable payloads (for example, `trace-id:abcd-1234`, `crm-id:3004`)
- Analytics segmentation (for example, `region:emea`, `channel:web`)
- Feature rollout or experiment grouping (for example, `experiment:checkout-v2`)

### Guidelines

- Do not store secrets or PII; tags propagate with jobs and exports.
- Prefer concise `key:value` or `key` patterns for consistency.
- Use variables (not tags) for mutable or large data.
- Establish internal naming conventions (for example, prefixes like `env:` or `dept:`) for governance.

### Examples

Create with tags:

```bash
curl -L 'http://localhost:8080/v2/process-instances' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "processDefinitionId": "order-process",
    "processDefinitionVersion": 3,
    "tags": ["channel:web", "reference:1234", "region:emea"],
    "variables": { "orderId": "1234" }
  }'
```

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
