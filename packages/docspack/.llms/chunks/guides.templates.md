# Process Templates

The [template gallery](/templates) holds 25 Camunda 8 processes you can start from. Each one
is built with the `@bpmnkit/core` builder and laid out automatically. Job types, IO mappings,
correlation keys, timers and error codes are already set. It lints with no errors, and it
comes with test scenarios: a happy path and at least one alternative path.

The templates live in `@bpmnkit/patterns/templates`. The package's tests build every
template, lint it, round-trip it through XML and run each scenario on `@bpmnkit/engine`.
A template that stops passing fails the build.

---
Source: https://bpmnkit.com/docs/guides/templates
