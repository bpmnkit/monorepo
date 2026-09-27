# Secret resolution

Learn about secret resolution references, resolution paths, and where resolution is scoped and cached.


## About

Secret resolution replaces a `camunda.secrets.<name>` reference, known as a [secret reference (Orchestration Cluster)](https://docs.camunda.io/docs/next/reference/glossary#secret-reference-orchestration-cluster), with the value a configured secret store holds for it, without that value being written into a process model, a job variable literal, or a configuration file.

- This is a separate mechanism from the connector runtime's `{{secrets.<name>}}` syntax, now named "Secret reference (legacy)".
- By default, the two forms are resolved independently by different components, and each reads only its own store or providers.
- Optionally, if the connector runtime is configured for it (`camunda.connector.secret-resolver.legacy.mode` set to `FALLBACK`), a legacy reference the runtime cannot find in its providers falls back to the `camunda.secrets.<name>` store. See [Using `camunda.secrets.*` references](https://docs.camunda.io/docs/next/components/connectors/use-connectors/index#using-camundasecrets-references).

**Note**
The legacy form was the subject of [security notice 61](https://docs.camunda.io/docs/next/reference/notices#notice-61), where an unscoped reference could resolve outside the field it was written in. The secret filter that notice introduces applies only to the legacy form. `camunda.secrets.<name>` resolution isn't affected: the broker records each reference's position in the job variables and replaces only that position, so a reference can't resolve at a field where it wasn't written.

**Tip**
Desktop Modeler and Camunda Hub flag legacy secret usage when the diagram's selected engine supports `camunda.secrets.<name>`. Use that hint to guide your migration to the new syntax.

### Availability

Secret resolution is available in both SaaS and Self-Managed.

- See [availability](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation#availability) for what each offering provides and what you configure.
- For an overview of how secrets work in Camunda, including where values are stored and created, see [secrets](https://docs.camunda.io/docs/next/components/concepts/secrets).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution
