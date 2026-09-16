# Clusters

Learn more about the clusters available in your Camunda 8 plan.

A [cluster](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/create-cluster) is a provided group of production-ready nodes that run Camunda 8.

When [creating a cluster in SaaS](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/create-cluster), you can choose the cluster **type** and **size** to meet your organization's availability and scalability needs, and to provide control over cluster performance, uptime, and disaster recovery guarantees.


## Cluster type

The cluster type defines the level of availability and uptime for the cluster.

You can choose from three different cluster types:

- **Basic**: A cluster for non-production use, including experimentation, early development, and basic use cases that do not require a guaranteed high uptime.
- **Standard**: A production-ready cluster with guaranteed higher uptime.
- **Advanced**: A production-ready cluster with guaranteed minimal disruption and the highest uptime.

### Cluster availability and uptime

| Type                                                                        | Basic                                                                                  | Standard                                                  | Advanced                                                                              |
| :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| Usage                                                                       | Non-production use, including experimentation, early development, and basic use cases. | Production-ready use cases with guaranteed higher uptime. | Production-ready use cases with guaranteed minimal disruption and the highest uptime. |
| Uptime Percentage (Orchestration Cluster\*)           | 99%                                                                                    | 99.5%                                                     | 99.9%                                                                                 |
| RTO/RPO\*\*(Orchestration Cluster\*) | RTO: 8 hoursRPO: 24 hours                                                         | RTO: 2 hoursRPO: 4 hours                             | RTO: < 1 hourRPO: < 1 hour                                                       |

* Orchestration Cluster means the components critical for automating processes and decisions, such as Zeebe, Operate, Tasklist, Optimize, and connectors.
**  RTO (Recovery Time Objective) means the maximum allowable time that a system or application can be down after a failure or disaster before it must be restored. It defines the target time to get the system back up and running. RPO (Recovery Point Objective) means the maximum acceptable amount of data loss measured in time. It indicates the point in time to which data must be restored to resume normal operations after a failure. It defines how much data you can afford to lose. The RTO/RPO figures shown in the table are provided on a best-effort basis and are not guaranteed.

**Info**
See [Camunda Enterprise General Terms](https://legal.camunda.com/licensing-and-other-legal-terms#camunda-enterprise-general-terms) for term definitions for **Monthly Uptime Percentage** and **Downtime**.

---
Source: https://docs.camunda.io/docs/next/components/concepts/clusters
