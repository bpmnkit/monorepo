# Run benchmarks — Run your own benchmarks

Use the [Camunda 8 Benchmark project (c8b)](https://github.com/camunda-community-hub/camunda-8-benchmark), a Spring Boot application, to run load tests against your cluster.

### Key features

- Starts process instances at a configurable rate and **automatically adjusts based on backpressure**.
- Completes tasks that appear in the process instances.
- **Bring your own BPMN process model and payload**, which can be provided as URLs, such as GitHub Gists.
- **Automatic job type discovery** from BPMN files.
- Configurable **task completion delay** to simulate real worker behavior.
- Built-in **Prometheus metrics and Grafana dashboards** for observability.

### Quick start

Run the following command against your cluster:

```bash
mvn spring-boot:run
```

With Docker:

```bash
docker run camundacommunityhub/camunda-8-benchmark:main
```

Customize it with your own process and payload:

```bash
benchmark.bpmnResource=url:https://your-gist-url/your-process.bpmn
benchmark.payloadPath=url:https://your-gist-url/your-payload.json
benchmark.processInstanceStartRate=25
benchmark.taskCompletionDelay=200
```

**Important**
To run meaningful benchmarks, use a **properly sized environment**. SaaS trial clusters and local developer machines have limited resources and will hit bottlenecks too early. Use either a correctly sized Camunda SaaS cluster (with help from your Camunda representative) or a properly provisioned Self-Managed Kubernetes environment.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-benchmarks
