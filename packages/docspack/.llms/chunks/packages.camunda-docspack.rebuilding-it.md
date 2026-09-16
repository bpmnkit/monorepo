# @bpmnkit/camunda-docspack — Rebuilding it

A weekly workflow (`.github/workflows/camunda-docspack.yml`) rebuilds the pack
from upstream. By hand you need a camunda-docs checkout:

```sh
node packages/camunda-docspack/dist/cli.js --camunda-docs ../camunda-docs
```


## API Reference

The published artefact is the `.llms/` payload; these exports are the build that
produces it.

| Export | Purpose |
| --- | --- |
| `build(options)` | Stage a camunda-docs checkout and write the `.llms/` payload |
| `stage(options)` | Run the staging transforms only, to a directory |
| `bpmnToText(xml)` | Render a BPMN diagram as a compact flow description |
| `readOperations(entry)` | Read one digest per operation from an OpenAPI document |
| `stripMdx(source, options)` | Reduce Camunda's MDX to indexable Markdown |
| `absoluteLinks(markdown, slug)` | Rewrite relative links to `docs.camunda.io` URLs |
| `notice(commit)` | The CC BY-SA 3.0 attribution written on every build |

---
Source: https://bpmnkit.com/docs/packages/camunda-docspack
