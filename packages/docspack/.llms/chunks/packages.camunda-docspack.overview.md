# @bpmnkit/camunda-docspack — Overview

`@bpmnkit/camunda-docspack` packages the **Camunda 8 documentation** as a
[docspack](https://docspack.dev/spec) pack you can search offline: BPMN and FEEL
references, engine concepts, the best-practice pages, and one digest per
Orchestration Cluster API operation.

It is the companion to [`@bpmnkit/docspack`](/docs/packages/docspack), and the
split is the point. Ask ours how to *drive the library*; ask this one what the
*engine* does — gateway semantics, FEEL syntax, job activation, permissions.
Those are different questions and the right answer to one is the wrong answer to
the other.

> **This is Camunda's documentation, not BPMN Kit's.** The content is the work of
> Camunda Services GmbH and copyright in it remains with them. This package adds
> only the tooling that stages, chunks and indexes it. It is redistributed under
> **CC BY-SA 3.0**, the licence Camunda publishes it under — which is why this
> package is CC BY-SA 3.0 rather than MIT like the rest of BPMN Kit. BPMN Kit is
> not affiliated with, endorsed by or sponsored by Camunda. For canonical and
> current documentation prefer [docs.camunda.io](https://docs.camunda.io).

It is built from the `docs/` tree of
[camunda/camunda-docs](https://github.com/camunda/camunda-docs) — the unreleased
**8.10** documentation — plus the Orchestration Cluster API specification, and
rebuilt weekly.

---
Source: https://bpmnkit.com/docs/packages/camunda-docspack
