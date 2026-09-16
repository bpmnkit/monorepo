# @bpmnkit/camunda-docspack — A note on the pack's name

A vendor that redistributes somebody else's documentation needs a second pack, so
this one is `@bpmnkit/camunda-docspack` rather than a second `@bpmnkit/docspack`.
The name is still a pure check inside a scope BPMN Kit owns, so the pack carries
the same trust as `@bpmnkit/docspack`.

The docspack spec originally named one pack per npm scope, and `bpmnkit-docs`
read the `-docspack` suffix ahead of it. Upstream adopted the shape in
**`docspack@1.2.0`**, so both readers now find this pack — but a `docspack` CLI
older than 1.2.0 will not, and will answer Camunda questions out of
`@bpmnkit/docspack` instead. `bpmnkit-docs` has no such floor.

---
Source: https://bpmnkit.com/docs/packages/camunda-docspack
