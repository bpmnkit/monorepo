# How to use cluster variables — Access using FEEL expressions

You can reference cluster variables anywhere Camunda Modeler supports FEEL expressions.
They are exposed through the following namespaces:

- `camunda.vars.cluster`
- `camunda.vars.tenant`
- `camunda.vars.env`

These namespaces correspond to the available scope levels. See [scope resolution](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/scope-and-priority) for more details.

**Tip**
Camunda recommends using the `camunda.vars.env` namespace for most use cases.

#### `camunda.vars.cluster`

Provides direct access **only** to global-scope variables. Tenant-scope variables are not accessible through this namespace.

**Use when:**

- You want to access only global variables.
- You need to bypass tenant-level overrides.
- You're debugging scope resolution.

For example:

```
camunda.vars.cluster.GLOBAL_DEFAULT_TIMEOUT
```

#### `camunda.vars.tenant`

Provides direct access **only** to tenant-scope variables. Global-scope variables are not accessible through this namespace.

**Use when:**

- You want to access only tenant variables.
- You need to check tenant-specific values.
- You're debugging scope resolution.

For example:

```
camunda.vars.tenant.TENANT_SPECIFIC_CONFIG
```

#### `camunda.vars.env`

Provides a merged view of both global- and tenant-scope variables, applying automatic priority resolution. This is the recommended namespace for most cases.

**Use when:**

- You want automatic scope resolution.
- You need the most specific value available.
- You're writing portable process definitions.

For example:

```
camunda.vars.env.API_ENDPOINT
camunda.vars.env.CONFIG.timeout
```

### Simple key access

Use dot notation after the namespace for simple key-value pairs. For example:

```
camunda.vars.env.API_URL
camunda.vars.env.MAX_RETRIES
camunda.vars.env.FEATURE_ENABLED
camunda.vars.env.TIMEOUT_SECONDS
```

### Nested object access

For cluster variables with nested object structures, use dot notation to access deeper levels.
For example:

```
camunda.vars.env.DATABASE_CONFIG.host
camunda.vars.env.DATABASE_CONFIG.port
camunda.vars.env.DATABASE_CONFIG.credentials.username

camunda.vars.env.API_SETTINGS.retry.max_attempts
camunda.vars.env.API_SETTINGS.retry.backoff_ms
camunda.vars.env.API_SETTINGS.timeout.connection
```

### Conditional access

Provide fallback values when cluster variables might not exist.
For example:

```
if camunda.vars.env.CUSTOM_TIMEOUT != null
  then camunda.vars.env.CUSTOM_TIMEOUT
  else 5000
```

### Dynamic key access

While dynamic key access is limited in FEEL, you can structure your variables to support configuration-driven behavior. For example:

```
camunda.vars.env.COUNTRY_CONFIGS[countryCode].tax_rate
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/usage-guide
