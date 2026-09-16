# Namespace collisions — Collision types

The examples below show you common patterns and how to reason about them.

### Process variable shadowing

If you create a process variable using the cluster variable namespace, it completely shadows cluster variables.

#### Scenario

```
GLOBAL: { API_ENDPOINT: "https://api.global.com" }

Process Variable Created:
camunda.vars.env.API_ENDPOINT = "https://api.override.com"
```

#### Result

```
camunda.vars.env.API_ENDPOINT → "https://api.override.com"
```

#### Why this happens

Process variables [have the highest priority](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/scope-and-priority) in the resolution hierarchy. When you namespace a process variable under `camunda.vars.env`, it takes precedence over cluster variables.

This allows intentional, runtime overrides of cluster configuration when necessary.

**Tip**
Use sparingly and document clearly. Prefer a different namespace for process variables to avoid confusion.

### Structural collisions across scopes

It happens when you define the same key with different data types or structures at different scopes.

**Note**
This is the most common source of unexpected behavior.

#### Scenario

```
TENANT: { CONFIG_KEY: "simple string value" }
GLOBAL: { CONFIG_KEY: { nested: "object", with: "properties" } }
```

#### Result

```
camunda.vars.env.CONFIG_KEY → "simple string value" (TENANT wins)
camunda.vars.env.CONFIG_KEY.nested → null (trying to access property on string)
```

#### Why this happens

Tenant scope has higher priority and returns a string, so the global object is never evaluated. Accessing properties on a string yields null.

### Kind collisions across scopes

A kind collision happens when the same key is defined at both scopes with a different [variable kind](https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types#variable-kinds).

#### Scenario

```
GLOBAL: { API_CREDENTIALS: "camunda.secrets.PAYMENT_API_KEY" }  (kind SECRET_REFERENCE)
TENANT: { API_CREDENTIALS: "camunda.secrets.PAYMENT_API_KEY" }  (kind JSON)
```

#### Result

When an input mapping on a service task reads the key:

```
camunda.vars.env.API_CREDENTIALS
→ the literal text "camunda.secrets.PAYMENT_API_KEY" (TENANT wins, kind JSON)

camunda.vars.cluster.API_CREDENTIALS
→ the resolved secret value (GLOBAL, kind SECRET_REFERENCE)
```

#### Why this happens

Tenant scope has higher priority, so `camunda.vars.env` selects the tenant variable, and only that variable's kind is considered. A `JSON`-kind value is ordinary text, so its references are not resolved. The global variable's references are reachable only through `camunda.vars.cluster`, which bypasses tenant scope.

This assumes the tenant variable has a non-empty value. If it's empty, `camunda.vars.env` skips it and falls through to global instead, so the global `SECRET_REFERENCE` variable wins — the opposite of the outcome above.

To avoid this, give a key the same kind at every scope where you define it.

### Detailed collision example

#### Scenario

```
GLOBAL scope:
{
  KEY_1: {
    KEY_2: "hello world",
    KEY_3: "goodbye world"
  }
}

TENANT scope:
{
  KEY_1: "tenant value"
}
```

#### Results

```
camunda.vars.env.KEY_1
→ "tenant value"
✓ Works as expected, TENANT priority

camunda.vars.env.KEY_1.KEY_2
→ null
✗ Unexpected! Trying to access property on string

camunda.vars.cluster.KEY_1.KEY_2
→ "hello world"
✓ Bypasses TENANT scope, accesses GLOBAL directly

camunda.vars.tenant.KEY_1
→ "tenant value"
✓ Direct TENANT access

camunda.vars.tenant.KEY_1.KEY_2
→ null
✓ Correctly returns null (KEY_1 in TENANT is string)
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/namespace-collisions
