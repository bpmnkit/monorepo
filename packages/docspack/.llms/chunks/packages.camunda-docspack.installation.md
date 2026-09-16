# @bpmnkit/camunda-docspack — Installation

```sh
pnpm add -D @bpmnkit/camunda-docspack
```

There is no second CLI to learn: `bpmnkit-docs`, from
[`@bpmnkit/docspack`](/docs/packages/docspack), reads every pack installed.


## Asking it

```sh
npx bpmnkit-docs ask "how should I name an exclusive gateway" \
  --pack @bpmnkit/camunda-docspack
npx bpmnkit-docs ask "POST /jobs/activation" --pack @bpmnkit/camunda-docspack
npx bpmnkit-docs ask "what permissions does creating a process instance need" \
  --pack @bpmnkit/camunda-docspack
```

`--pack` both disambiguates and pays for itself: the index is built by reading
every chunk off disk, so narrowing to one pack is roughly 150ms against 650ms
across both. Leave it off when you do not know which pack answers.

Confirm it is installed before relying on it:

```sh
npx bpmnkit-docs list
```

```
@bpmnkit/camunda-docspack@0.0.0  1054 chunks
@bpmnkit/docspack@0.0.4  205 chunks
```

A pack missing from that list is a pack no answer can come from. See
[Using BPMN Kit with AI](/docs/guides/using-bpmnkit-with-ai) for the paragraph to
put in `AGENTS.md` or `CLAUDE.md` so an agent knows to ask both.

---
Source: https://bpmnkit.com/docs/packages/camunda-docspack
