# Secret resolution

Understand camunda.secrets.<name> references, the two paths that resolve them, and where resolution is scoped and cached.

Secret resolution replaces a `camunda.secrets.<name>` reference, known as a Secret reference (Orchestration Cluster), with the value a configured secret store holds for it, without that value being written into a process model, a job variable literal, or a configuration file.

This is a separate mechanism from the connector runtime's `{{secrets.<name>}}` syntax, now called Secret reference (legacy). The two forms are resolved independently and are never mixed: a reference written in one form is never satisfied by a store or provider configured for the other.

The legacy form was the subject of [security notice 61](https://docs.camunda.io/docs/next/reference/notices#notice-61), where an unscoped reference could resolve outside the field it was written in. The secret filter that notice introduces applies only to the legacy form. `camunda.secrets.<name>` resolution isn't affected: the broker records each reference's position in the job variables and replaces only that position, so a reference can't resolve at a field where it wasn't written.

**Tip**
Desktop Modeler and Web Modeler flag legacy secret usage when the diagram's selected engine supports `camunda.secrets.<name>`. Use that hint to guide your migration to the new syntax.

This page describes an alpha feature and may change in future releases. See [alpha features](https://docs.camunda.io/docs/next/components/early-access/alpha/alpha-features).

Secret resolution is available in both SaaS and Self-Managed. See [Availability](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation#availability) for what each offering provides and what you configure.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution
