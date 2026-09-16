# Multi-tenancy — How multi-tenancy works

Camunda 8 implements multi-tenancy using tenant identifiers within a single installation. All tenant data is stored in the same database, with isolation enforced by appending a tenant identifier to each data object, such as process definitions, process instances, and jobs.

### Tenant identifier

The tenant identifier is added to all data created in Camunda 8. By default, all data is assigned to the `<default>` tenant identifier.

**Note**
The `<default>` tenant identifier is reserved and cannot be changed by users.

Organizations can create additional tenants. Tenant identifiers must meet the following requirements:

- Use only alphanumeric characters, dashes (`-`), underscores (`_`), or dots (`.`).
- Be no longer than 31 characters.

### Multi-tenancy checks

Multi-tenancy checks enforce tenant-based access control.

By default, multi-tenancy checks are **disabled**. This means that although tenants can be created and assigned, the system does not restrict access based on those assignments. All data is associated with the `<default>` tenant.

When **enabled**, the system verifies that users can only access resources associated with their assigned tenants. Users, groups, and roles not assigned to a tenant lose access to resources scoped to that tenant.

**Warning**
Before you enable multi-tenancy checks, assign all users, groups, and roles that need access to their tenants **and** to the `<default>` tenant. Once checks are enforced, any principal not assigned to a tenant loses access to the resources scoped to that tenant.

### Inherited tenant ownership

Tenant ownership in Camunda 8 is hierarchical. A user can only deploy resources to authorized tenants. Any data created by those resources inherits the same tenant identifier.

---
Source: https://docs.camunda.io/docs/next/components/concepts/multi-tenancy
