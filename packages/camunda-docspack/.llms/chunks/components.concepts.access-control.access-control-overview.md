# Identity and access management in Camunda 8

Understand the difference between authentication and authorization in Camunda 8, and how they work together to secure your orchestration cluster.

Use identity access control to provide secure access for authorized users and systems in Camunda 8.


## Identity types in Camunda 8

There are two types of identity in Camunda 8.

These identities serve different purposes: one controls access to process execution and runtime APIs, while the other controls access to management and modeling components.

    Orchestration Cluster Admin (formerly Orchestration Cluster Identity)
    Used for authenticating and authorizing users and systems that interact with the Orchestration Cluster (such as Zeebe, Operate, Tasklist, and the Orchestration Cluster REST API).Admin governs access to process execution, task management, and related runtime resources.

    Management Identity
    Used for managing the components Camunda Hub and Optimize.Management Identity is typically required for platform administrators and developers, and is separate from the identities used for process orchestration.

**Tip**
Understanding which identity is required for a given action helps you apply the correct access control policies.

**Note**
Identity object identifiers and names are limited to **256 characters**. This limit applies independently of the secondary storage backend used by the Orchestration Cluster.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/access-control-overview
