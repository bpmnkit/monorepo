# Introduction to Camunda 8

Learn how Camunda 8 components work together to orchestrate and automate business processes, including the platform architecture and storage roles.

Use [Camunda 8](https://camunda.io) to orchestrate and automate complex business processes that include people, AI agents, systems, and devices.


## About Camunda 8

You can deploy Camunda 8 in two ways:

- **Camunda 8 SaaS**: A fully managed cloud service for rapid deployment and minimal operational overhead.
- **Camunda 8 Self-Managed**: A self-hosted solution for organizations requiring full control over their infrastructure.

Camunda 8 combines powerful execution engines for BPMN processes and DMN decisions with tools for collaborative modeling, operations, and analytics. Camunda 8 [components](https://docs.camunda.io/docs/next/components/components-overview) work together to form the complete Camunda 8 experience, allowing you to design, automate, and improve your business processes.

Camunda 8 separates runtime execution data from analytical and operational data by using distinct storage roles.

### Storage architecture

In the diagram above, storage systems appear in two distinct roles:

- **Primary storage**: The authoritative store for runtime execution state used by the [Orchestration Cluster](https://docs.camunda.io/docs/next/reference/glossary#orchestration-cluster) to execute, recover, and replicate workflows. This includes partition logs and snapshots and is tightly coupled to process execution. See [primary storage](https://docs.camunda.io/docs/next/reference/glossary#primary-storage).
- **Secondary storage**: Systems used for indexing, search, analytics, operational views, and long-term retention. Data is populated from primary storage and optimized for querying rather than execution. See [secondary storage](https://docs.camunda.io/docs/next/reference/glossary#secondary-storage).

#### Secondary storage implementations

Camunda 8 supports multiple secondary storage backends, depending on the deployment model and configuration:

- **Embedded H2**: A bundled secondary storage option for local development and lightweight setups. See [H2](https://docs.camunda.io/docs/next/reference/glossary#h2).
- **External RDBMS**: A user-managed relational database used as secondary storage in Self-Managed deployments. See [RDBMS](https://docs.camunda.io/docs/next/reference/glossary#rdbms).
- **Elasticsearch / OpenSearch**: Search-optimized backends commonly used for analytics and operational visibility. See [Elasticsearch/OpenSearch](https://docs.camunda.io/docs/next/reference/glossary#elasticsearchopensearch).

For deployment and configuration guidance, see the Self-Managed documentation:

- [About Self-Managed](https://docs.camunda.io/docs/next/self-managed/about-self-managed)
- [Helm quick install](https://docs.camunda.io/docs/next/self-managed/deployment/helm/install/quick-install)

**Info**

- Want to migrate your Camunda 7 process solutions to run on Camunda 8? See our [Camunda 7 migration guide](https://docs.camunda.io/docs/next/guides/migrating-from-camunda-7/index).
- Deployment guides for Camunda 8 components are available in the [Self-Managed section](https://docs.camunda.io/docs/next/self-managed/about-self-managed).

---
Source: https://docs.camunda.io/docs/next/components/concepts/concepts-overview
