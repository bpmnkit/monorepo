# Cluster variables

Manage configuration values centrally across your Camunda cluster with cluster variables.

Manage configuration values centrally across your Camunda cluster with cluster variables.


## About

Within your Camunda cluster, you can define [variables](https://docs.camunda.io/docs/next/components/concepts/variables) at two levels: globally for the entire cluster, or at the tenant level when multi-tenancy is enabled.

Cluster variables allows you to maintain environment-specific configurations, API endpoints, feature flags, and other shared values without hardcoding them into individual process definitions.

### Why use

Cluster variables provide **centralized**, **flexible**, and **environment-aware configuration** for your processes. They allow you to:

- Define configuration once and reuse it across multiple processes.
- Use different values for development, staging, and production without changing BPMN models.
- Support multi-tenant setups with tenant-specific overrides on top of global defaults.
- Promote processes across environments without modifying process definitions.
- Update configuration at runtime without redeploying.
- Manage shared settings such as API endpoints and service URLs, feature flags, and integration credentials.

### When not to use

Consider alternatives for the following use cases:

| Use case                                       | Recommended alternative          |
| ---------------------------------------------- | -------------------------------- |
| Process instance-specific data                 | Process variables                |
| Values that change frequently during execution | Process variables                |
| Sensitive credentials                          | Secrets management               |
| Large payloads                                 | External storage with references |

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/overview
