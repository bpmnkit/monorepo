# @bpmnkit/docspack — The other pack

BPMN Kit publishes a second pack:
**[`@bpmnkit/camunda-docspack`](/docs/packages/camunda-docspack)**, the Camunda 8
documentation — BPMN and FEEL references, engine concepts, best practices and the
Orchestration Cluster API. `bpmnkit-docs` reads both, so ask this package how to
drive the library and that one what the engine does:

```sh
npx bpmnkit-docs ask "how should I name an exclusive gateway" --pack @bpmnkit/camunda-docspack
```

Install them together, and tell your agent about both — see
[Using BPMN Kit with AI](/docs/guides/using-bpmnkit-with-ai).


## Installation

```sh
pnpm add -D @bpmnkit/docspack @bpmnkit/camunda-docspack
```

---
Source: https://bpmnkit.com/docs/packages/docspack
