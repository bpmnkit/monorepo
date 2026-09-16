# Scope resolution

Learn how cluster variable scope resolution works, the available scopes, and how to access and use them.

Learn how cluster variable scope resolution works, the available scopes, and how to access and use them.


## About

Cluster variables use a scope priority process to determine which value is used when the same key exists at multiple levels.

This guide helps you understand this scope resolution to predict values in your processes and avoid unexpected behavior.


## Scope levels

Cluster variables exist at the **global** and **tenant** scope levels.

### Global scope

Variables defined at the global scope are available across the entire cluster and accessible by all processes, regardless of tenant context.

**Info**
Global-scope cluster variables are ideal for cluster-wide defaults and shared configuration.

They have lowest priority in variable resolution and are managed via the global cluster variables API.

### Tenant scope

Variables defined at the tenant scope are specific to a particular tenant and only accessible within that tenant's context.

**Note**
Tenant-scope cluster variables are ideal for tenant-specific customization and overrides.

They have higher priority than global-scope ones in variable resolution and are managed via the tenant-specific cluster variables API.

**Important**
They are available only when multi-tenancy is enabled.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/scope-and-priority
