# Variables — Input/output variable mappings — Secret references in input mappings (2)

**Note**
A secret reference can also come from a [cluster variable](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types) of kind `SECRET_REFERENCE`. An input mapping that selects such a variable, for example `=camunda.vars.env.MY_CONFIG`, resolves the `camunda.secrets.<name>` references embedded in its value the same way. See [resolve secret references in a cluster variable](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/usage-guide#resolve-secret-references-in-a-cluster-variable).

**Note**
Avoid using `camunda` as a process variable name. A process variable literally named `camunda` takes precedence over the secret namespace, so `camunda.secrets.<name>` resolves against that variable and no secret is injected.

#### Escape secret names with special characters

A secret name containing a character FEEL doesn't allow in a bare identifier (most commonly a dash) must be backtick-escaped, the same way any other FEEL name with special characters is:

```feel
=camunda.secrets.`db-password`
```

Without the backticks, `camunda.secrets.db-password` parses as a subtraction (`db` minus `password`). FEEL reads the left operand as a reference named `db`, which is not a valid secret reference, so the deployment fails at evaluation.

**Note**
When a reference is written directly in an input mapping source, backtick escaping accepts any name, including a name your secret store accepts but the [`/v2/secrets`](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/list-secrets.api) endpoints do not. Those endpoints list and resolve only names matching `[\p{Alnum}_-]+`. A name outside that set, such as `tls.crt`, can be backtick-escaped and resolved from a process model (``=camunda.secrets.`tls.crt` ``) if your secret store holds it under that name, but the same secret cannot be listed or resolved through `/v2/secrets`. This applies to references written directly in an input mapping source, not to references embedded in a [`SECRET_REFERENCE`-kind cluster variable value](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types#where-references-can-appear-in-a-value), whose names follow the restricted cluster-variable character set.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables
