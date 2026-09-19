# Scope resolution — Resolution priority

From highest to lowest priority, the cluster variable resolution order is:

1. Process variables.
2. Tenant-scope cluster variables.
3. Global-scope cluster variables.

Resolution priority is the same for every [variable kind](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types#variable-kinds). The `camunda.vars.env`, `camunda.vars.tenant`, and `camunda.vars.cluster` namespaces select a `SECRET_REFERENCE`-kind variable exactly as they select a `JSON`-kind one. The kind of the variable that wins is what decides whether its `camunda.secrets.<name>` references are resolved.

### Process variables

Variables defined on the process instance always take precedence over cluster variables. This includes:

- Variables set during instantiation.
- Variables created or updated during execution.
- Variables passed from parent to child processes.

**Note**
If you create a process variable with a key that matches a cluster variable path (for example, `camunda.vars.env.API_URL`), the process variable will shadow the cluster variable completely.

### Tenant-scope cluster variables

When multi-tenancy is enabled, tenant-scoped variables:

- Override global scope variables with the same key.
- Are visible only to processes in that tenant.
- Enable tenant-specific customization without affecting other tenants.

### Global-scope cluster variables

Global cluster variables provide cluster-wide defaults and baseline configuration. These variables:

- Are accessible to all processes across all tenants.
- Serve as fallbacks when no tenant-specific override exists.
- Provide consistent defaults for new tenants.

### Resolution examples

#### Basic scope override

```
GLOBAL:  { API_TIMEOUT: 5000 }
TENANT:  { API_TIMEOUT: 10000 }
PROCESS: (none)

Result when accessing camunda.vars.env.API_TIMEOUT:
→ 10000 (TENANT value)
```

#### Partial override

```
GLOBAL:  { API_CONFIG: { timeout: 5000, retry: 3, url: "https://api.global.com" } }
TENANT:  { API_CONFIG: { timeout: 10000 } }
PROCESS: (none)

Result when accessing camunda.vars.env.API_CONFIG.timeout:
→ 10000 (TENANT value)

Result when accessing camunda.vars.env.API_CONFIG.retry:
→ null (TENANT defined API_CONFIG as a different object)
```

**Warning**
When you override a key at the tenant scope, the entire value at that key is replaced, not merged.
Partial object merging does not occur.

#### Process variable override

```
GLOBAL:  { MAX_AMOUNT: 1000 }
TENANT:  { MAX_AMOUNT: 5000 }
PROCESS: { camunda.vars.env.MAX_AMOUNT: 10000 }

Result when accessing camunda.vars.env.MAX_AMOUNT:
→ 10000 (PROCESS variable)
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/scope-and-priority
