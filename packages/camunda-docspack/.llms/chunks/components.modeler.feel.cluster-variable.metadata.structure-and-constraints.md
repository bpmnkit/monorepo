# Metadata — Structure and constraints

When you add metadata to a cluster variable, it must meet the following requirements:

- Keys must be strings.
- Values must be **scalars (strings or numbers only)**. You cannot use booleans, arrays, or objects.
- Metadata is limited to **100 entries** and and must not exceed the configurable maximum serialized size. By default, each key can contain up to 256 characters, and each value can contain up to 8,192 characters.

The API rejects requests that exceed these limits or contain unsupported value types.


## Metadata is not part of the runtime value

Metadata is never exposed as part of the FEEL-accessible value. When a process evaluates `camunda.vars.env.<name>` (or the `cluster`/`tenant` namespaces), the expression resolves only to the variable's `value` field.
Metadata keys are not included. See [how to use cluster variables](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/usage-guide) for FEEL access patterns.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/metadata
