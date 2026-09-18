# @bpmnkit/connectors — Stability

`@bpmnkit/connectors` carries the [1.0 stability promise](/docs/getting-started/stability):
its exports will not change shape without a major version.

Two things the promise does **not** freeze, because both track Camunda rather than this
package:

- **The catalog's contents.** Connectors are added, and upstream templates gain versions and
  properties. A changed `CAMUNDA_CONNECTOR_TEMPLATES` is a minor; the types describing it are
  covered as usual.
- **Template validation being strict about new upstream shapes.** A template that validates
  today will not start failing in a minor — that direction *is* covered.

---
Source: https://bpmnkit.com/docs/packages/connectors
