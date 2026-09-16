# Using BPMN Kit with AI — Asking

```sh
npx bpmnkit-docs ask "what does compactify drop from a diagram"
```

```
## @bpmnkit/docspack@0.0.4/packages.core.installation-compactify-definitions

Projects a `BpmnDefinitions` object onto a `CompactDiagram` — a small JSON
object suitable for LLM prompts. **Lossy:** it keeps topology, names …

---
cost: 204 tokens, capped at 3,000
```

Every answer names the pack, the version and the chunk, and closes with what it
cost — so an agent can quote the chunk id back when a passage turns out to be
wrong.

Ask the engine's documentation with `--pack`:

```sh
npx bpmnkit-docs ask "what happens when no exclusive gateway condition is true" \
  --pack @bpmnkit/camunda-docspack
```

`--pack` is worth using even when you are not disambiguating. Building the index
reads every chunk off disk, so narrowing to one pack is the difference between
roughly 150ms and 650ms per question. A name that is not installed is an error
listing what is, never an empty answer — an empty answer would read as "the
documentation does not cover this", which is a different claim.

`search` ranks without printing the content, and `list` shows what was found:

```sh
npx bpmnkit-docs search "exclusive gateway condition"
npx bpmnkit-docs list
```

```
@bpmnkit/camunda-docspack@0.0.0  1054 chunks
@bpmnkit/docspack@0.0.4  206 chunks
```

---
Source: https://bpmnkit.com/docs/guides/using-bpmnkit-with-ai
