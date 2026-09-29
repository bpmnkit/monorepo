# Secrets

Use secrets to keep sensitive values out of process models, variables, and configuration. Learn how to reference a secret, where values are stored, how references resolve, and how access is controlled.


## About

You can use and manage secrets to keep keep sensitive values such as API keys, passwords, and tokens, out of your process models, job variables, and configuration files.

Instead of writing a value into a model, you reference a secret stored in a secret store by name. Camunda resolves that reference to its value at runtime. The value is supplied only where it is needed, so it is never stored in the process itself.

<!-- Source diagram: https://miro.com/app/board/uXjVHjBNPcc=/?share_link_id=404465590432 -->

1. Use a stored secret (for example, `MY_SECRET`) in a model as a secret reference (`camunda.secrets.MY_SECRET`).
1. Once deployed and when the process instance starts, the Orchestration Cluster logs, stores, and exports the secret reference.
1. Once the job is activated, the secret reference is resolved and replaced with the actual secret value from the secret store.

**Tip: Terminology**
For precise definitions of secret-related terms, see the [secret reference](https://docs.camunda.io/docs/next/reference/glossary#secret-reference) glossary entries.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secrets
