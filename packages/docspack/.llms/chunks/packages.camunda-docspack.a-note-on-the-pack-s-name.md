# @bpmnkit/camunda-docspack — A note on the pack's name

The docspack spec names one pack per npm scope, `@<vendor>/docspack`. A vendor
that also redistributes somebody else's documentation has nowhere to put it under
that rule, so this pack is `@bpmnkit/camunda-docspack` and `bpmnkit-docs` reads
the `-docspack` suffix as well as the bare name. It stays a pure name check
inside a scope BPMN Kit owns, so the pack carries the same trust as
`@bpmnkit/docspack`. A spec-strict reader — the upstream `docspack` CLI — will
only see `@bpmnkit/docspack`, so use `bpmnkit-docs` for this one.

---
Source: https://bpmnkit.com/docs/packages/camunda-docspack
