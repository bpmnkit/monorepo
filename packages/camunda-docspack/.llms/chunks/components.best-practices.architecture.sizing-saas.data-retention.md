# Size your SaaS cluster — Data retention

The maximum throughput numbers should be considered peak loads, and the data retention configuration considered when defining the amount of data kept for completed instances in your cluster. See [Camunda 8 SaaS data retention](https://docs.camunda.io/docs/next/components/saas/data-retention) for the default retention times for Zeebe, Tasklist, Operate, and Optimize.

- If process instances are completed and older than the configured retention time for an application, the data is removed.
- If a process instance is older than the configured retention time but still active and incomplete, it continues to function at runtime and is _not_ removed.

Camunda can adjust data retention on request (up to certain limits). Consider retention time adjustments and/or storage capacity increases if you plan to run more than \[max PI stored in ES\] / \[configured retention time\].

**Note: Why is the total number of process instances stored that low?**
This is related to the limited resources provided to Elasticsearch, which can cause performance problems when too much data is stored there. By increasing the available memory for Elasticsearch, you can also increase that number. At the same time, even with this rather low number, you can always guarantee the throughput of the core workflow engine during peak loads, as this performance is not affected. You can also increase memory for Elasticsearch later if needed.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-saas
