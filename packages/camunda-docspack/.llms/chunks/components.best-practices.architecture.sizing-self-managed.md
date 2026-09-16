# Self-Managed resource planning

Provision Camunda 8 on your Self-Managed cluster with Kubernetes and Helm using these baseline configurations, then adjust sizing based on your workload.

Provisioning Camunda 8 on your Self-Managed cluster depends on several factors. Use [Kubernetes with Helm](https://docs.camunda.io/docs/next/self-managed/deployment/helm/index) to deploy and manage your Self-Managed cluster.

Use the configurations and guidance below as a baseline, then adjust based on your workload. For background on the factors that drive provisioning requirements, see [Size your environment](https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment).


## Camunda 8.8+ resource consumption

Camunda 8.8 introduced a streamlined architecture that consolidates the broker, gateway, Operate, Tasklist, and Identity into a single application, the [Orchestration Cluster](https://docs.camunda.io/docs/next/components/orchestration-cluster). This changes how you think about resource consumption compared to older versions.

If you are upgrading from a pre-8.8 version, expect different resource profiles:

- The Orchestration Cluster requires **more CPU per broker** compared to 8.7 (approximately 75% more CPU, for example, 2 to 3.5 cores, to maintain equivalent throughput).
- Throughput at the default 2 CPU cores drops ~35% compared to 8.7.x.
- With properly aligned resources (3.5 CPU cores), 8.8.x achieves similar throughput to 8.7.x with **significantly lower latency** (approximately a 2x improvement).
- The streamlined architecture reduces operational complexity (fewer pods to manage) but consolidates resource consumption into fewer, larger pods.

All components are clustered to provide high-availability, fault-tolerance, and resilience.

The Orchestration Cluster scales horizontally by adding more nodes (pods). This is limited by the [number of partitions](https://docs.camunda.io/docs/next/components/zeebe/technical-concepts/partitions) configured for a cluster, as the work within one partition cannot be parallelized by design. Hence, you need to define enough partitions to utilize your hardware. The [number of partitions can be scaled up](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/operations/cluster-scaling) after the cluster is initially provisioned, but not yet scaled down.

Camunda 8 runs on Kubernetes. Every component runs as a pod with assigned resources. These resources can be scaled vertically (assigned more or fewer resources dynamically) within certain limits. Vertical scaling does not always increase throughput, since the components depend on each other.

**Note**
Camunda licensing does not depend on the provisioned hardware resources, making it easy to size according to your needs.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-self-managed
