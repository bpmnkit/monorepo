# Namespace collisions — Process variable namespace best practices

### Avoid using `camunda.vars` namespace

To prevent shadowing cluster variables, avoid creating process variables that use the `camunda.vars` namespace.

For example, instead of:

```
Set process variable: camunda.vars.env.TIMEOUT = 5000
```

Do:

```
Set process variable: processTimeout = 5000
```

### When override is intentional

If you need to override a cluster variable at the process level, document the intent and scope in the process documentation so consumers understand why the override exists and where it applies.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/namespace-collisions
