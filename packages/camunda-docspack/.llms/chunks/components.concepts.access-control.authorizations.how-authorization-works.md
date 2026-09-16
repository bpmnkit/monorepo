# Orchestration Cluster authorization — How authorization works

The authorization system is built on the principle of least privilege.

- When enabled, no access is granted by default, and all permissions must be explicitly assigned.
- There are no "deny" rules – if a permission is not explicitly granted, access is denied.

This model is enforced across both web components and API requests.

### Owners, resources, and permissions

At its core, an authorization grants an owner specific permissions on a resource. For example:

- User `john.doe` can be authorized to create new users.
- Group `devOps` can be authorized to delete the group `sales`.
- Role `processOwner` can be authorized to deploy and run all processes.

#### Owners

An **owner** is an entity that receives permissions. An authorization can be assigned to any of the following owner types:

- User
- Group
- Role
- Client
- Mapping rule

#### Resources

A resource is an object that users interact with and that needs to be secured. Each resource has a unique set of permissions that can be granted.

Examples of resources:

- Process Definition
- Decision Definition
- System
- User

#### Permissions

A permission is a specific action that an owner is allowed to perform on a resource. Permissions are unique to each resource type.

For example, a `Process Definition` resource has a `CREATE_PROCESS_INSTANCE` permission, while a `User` resource has a `DELETE` permission.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
