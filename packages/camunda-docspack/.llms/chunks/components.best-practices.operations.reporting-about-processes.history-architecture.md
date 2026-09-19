# Reporting about processes — History architecture

It is useful to understand the architecture around history data in Camunda 8.

**Caution: Camunda 7**
Note that the history architecture is very different in Camunda 7.x, refer to [Camunda 7 User Guide](https://docs.camunda.org/manual/latest/user-guide/process-engine/history/).

![History architecture](reporting-about-processes-assets/history-architecture.png)

Camunda saves historical data not just when a process instance finishes, but on the go, while a process instance is active. By doing this, Camunda separates runtime data from history data. A growing history will not influence the runtime behavior, and you should never need to access runtime data for reporting purposes.

Historical data can be leveraged via three possible mechanisms:

- **Camunda tools**: Leverage Camunda Operate or Camunda Optimize. This is a very simple approach that works out-of-the-box and should satisfy many requirements already. Camunda Operate focuses on operational use cases ("Where is my process? Why did this fail?") whereas Camunda Optimize provides business intelligence about your processes. Optimize allows you to build reports and dashboards including setting alerts for thresholds. For processes containing AI agents, the [agentic control plane](https://docs.camunda.io/docs/next/components/optimize/userguide/agentic-control-plane) in Optimize adds agent-specific metrics such as token usage, reliability, and tool calls without additional setup.

- **Query API**: Using the public API (currently under development), this has the advantage that you can make use of the history data within your own applications.

- Pushing **events**: Pushing Camunda events by using [exporters](https://docs.camunda.io/docs/next/components/zeebe/technical-concepts/architecture#exporters). Note that you can only add own exporters in a Self-Managed setting, not in Camunda 8 SaaS. Exporters have the advantage that you can push the data into any infrastructure you have, and possibly even filter or enrich the data in that step.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/reporting-about-processes
