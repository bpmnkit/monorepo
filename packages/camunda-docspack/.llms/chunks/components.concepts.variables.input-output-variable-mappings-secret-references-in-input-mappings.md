# Variables — Input/output variable mappings — Secret references in input mappings

An input mapping's `source` can reference a secret directly, without first storing it in a process variable. Write the reference as `camunda.secrets.<name>` in a FEEL expression.

This is part of an [alpha feature](https://docs.camunda.io/docs/next/components/early-access/alpha/alpha-features) and may be subject to change in future releases.

Using secret references requires a secret store that holds the secret. In SaaS, the store is provisioned for you. You can reference values from the cluster's **Cluster secrets** tab as `camunda.secrets.<name>` without additional setup. See [manage connector secrets](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-secrets#reference-connector-secrets-as-camundasecretsname). In Self-Managed, an operator must [configure a secret store](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#secrets). Without an available store, Camunda cannot resolve the reference.

| Process variables | Input mappings                                                                       | New variables                                                    |
| ----------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| -                 | **source:** `=camunda.secrets.API_TOKEN`**target:** `token`                     | `token` holds the secret's value when the job reaches the worker |
| -                 | **source:** `="Bearer " + camunda.secrets.API_TOKEN`**target:** `authorization` | `authorization` holds `"Bearer "` followed by the secret's value |

Secret references are only resolved in input mappings defined on elements that create a job for a job worker (for example, service tasks, business rule tasks, and ad hoc sub-processes). See [secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation) for how a reference is resolved and what the worker receives once the job is handed out. The stored process variable always holds the placeholder text `camunda.secrets.<name>`; resolution replaces it only in the payload handed to the worker, not in the variable kept in the process instance's state. Any other consumer of that variable sees the placeholder.

A reference must be an expression, and the reference itself must be exactly the three-segment path `camunda.secrets.<name>`. It can still take part in a supported expression, such as the concatenation shown above, but the following rejections apply:

- Writing the reference as a plain string, or quoting it inside an expression, is rejected at deployment rather than passed through as literal text:

  ```feel
  ="camunda.secrets.API_TOKEN"
  ```

  ```text
  Secret reference(s) 'camunda.secrets.API_TOKEN' must be used as an expression (e.g. '=camunda.secrets.<name>'), not as a string literal, in input mapping source '="camunda.secrets.API_TOKEN"'.
  ```

- A trailing path after the name, such as `camunda.secrets.API_TOKEN.length`, is not treated as a reference. It's evaluated as an ordinary FEEL path access instead.

- A reference placed inside a list, or inside a context built by an `if` branch, is rejected at deployment, because the reference is no longer a value the mapping assigns directly:

  ```feel
  =[camunda.secrets.API_TOKEN]
  ```

  ```text
  Input mapping source '=[camunda.secrets.API_TOKEN]' puts a secret reference inside a list, or inside a context built by an 'if' branch. Camunda can only replace a secret where the mapping assigns it directly to a value, so this secret would never be filled in. Assign each secret reference to its own input mapping instead.
  ```

Give each secret its own input mapping. A later mapping that reads the _variable_ created by an earlier one, rather than writing `camunda.secrets.<name>` itself, does not get the secret resolved:

| Input mappings                                                                                        | New variables                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **source:** `=camunda.secrets.API_TOKEN`**target:** `x`**source:** `=x`**target:** `y` | `x` exposes the resolved secret value to the worker; `y` holds the literal placeholder text, not the secret value |

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables
