# @bpmnkit/operate

`@bpmnkit/operate` is a small, Operate-like web UI for a Camunda 8 cluster. Mount it in
any element to get a dashboard and lists of process definitions, decisions, process
instances, incidents, jobs and user tasks, with detail pages that draw the BPMN diagram.
It is built for development clusters, [Camunda 8 Run](https://docs.camunda.io/docs/self-managed/quickstart/developer-quickstart/c8run/)
and SaaS trial clusters. It is not a replacement for Camunda Operate in production.

The UI does not call the cluster itself. It talks to the BPMN Kit proxy
(`@bpmnkit/proxy`, started with `casen proxy start`). The proxy holds your connection
profiles and credentials, and adds the auth header to each Camunda request.

```
browser (Operate)  ──fetch──▶  BPMN Kit proxy :3033  ──REST + auth──▶  Orchestration Cluster API /v2
```

---
Source: https://bpmnkit.com/docs/packages/operate
