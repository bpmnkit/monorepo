# Clusters — Free Trial clusters

Free Trial clusters have the same functionality as a production cluster, but are of a Basic type and 1x size, and only available during your trial period. You cannot convert a Free Trial cluster to a different type of cluster.

Once you sign up for a Free Trial, you are able to create one production cluster for the duration of your trial.

When your Free Trial plan expires, you are automatically transferred to the Free plan. This plan allows you to model BPMN and DMN collaboratively, but does not support execution of your models. Any cluster created during your trial is deleted, and you cannot create new clusters.

### Auto-pause

Free Trial clusters are automatically paused after a period of inactivity. Auto-pause occurs regardless of cluster usage.

You can resume a paused cluster at any time, which typically takes five to ten minutes to complete. See [resume a cluster](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-cluster#resume-a-cluster).

- Clusters tagged as `dev` (or untagged) auto-pause eight hours after the cluster is created or resumed from a paused state.
- Clusters auto-pause if there is no cluster activity for 48 hours.
- Cluster disk space is cleared when a trial cluster is paused.
  - You will need to redeploy processes to the cluster once it is resumed from a paused state.
  - Cluster configuration settings (for example, API Clients, connector secrets, and IP allowlists) are saved so you can easily resume a cluster.

**Tip**
To prevent auto-pause, [upgrade your Free Trial plan](https://camunda.com/pricing/) to an Enterprise plan.

---
Source: https://docs.camunda.io/docs/next/components/concepts/clusters
