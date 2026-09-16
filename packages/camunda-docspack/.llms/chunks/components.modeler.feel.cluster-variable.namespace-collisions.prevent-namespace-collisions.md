# Namespace collisions — Prevent namespace collisions

Avoid collisions by keeping structures consistent, separating fundamentally different data under different keys, and documenting what each key represents at each scope.

### Keep data structures consistent

Use the same data type and shape for a given key across all scopes.

#### Example

```
GLOBAL: {
  DATABASE_CONFIG: {
    host: "global-db.example.com",
    port: 5432,
    timeout_ms: 5000
  }
}

TENANT: {
  DATABASE_CONFIG: {
    host: "tenant-db.example.com",
    port: 5432,
    timeout_ms: 10000
  }
}
```

Both scopes use the same object structure, with tenant‑specific values.

### Use distinct keys

If the structures differ, store them under different keys to avoid type conflicts.

#### Example

```
GLOBAL: {
  DEFAULT_ENDPOINT: "https://api.global.com",
  DEFAULT_CONFIG: { timeout: 5000, retry: 3 }
}

TENANT: {
  TENANT_ENDPOINT: "https://api.tenant.com",
  TENANT_CONFIG: { timeout: 10000, retry: 5, custom_header: "value" }
}
```

### Detect collisions at runtime

Add simple guards when accessing nested properties to avoid nulls if a higher‑priority scope supplies a different type.

#### Example

```
if camunda.vars.env.CONFIG.nested_value != null
  then camunda.vars.env.CONFIG.nested_value
  else "default"
```

### Document your schema

Maintain a schema registry or documentation that specifies:

- Expected keys at each scope.
- Data type and structure for each key.
- Which keys can be overridden at the tenant scope.
- Deprecation notices for keys being phased out.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/namespace-collisions
