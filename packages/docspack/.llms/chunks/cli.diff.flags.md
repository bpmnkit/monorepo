# casen diff — Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--format` | `text` | `text` or `json` |
| `--exit-code` | off | Exit non-zero when the two diagrams differ |
| `--ascii` | off | Also render both diagrams as ASCII art |

### As a pipeline gate

```sh
casen diff bpmn main/order.bpmn branch/order.bpmn --exit-code
```

Exits non-zero when anything differs, so a job can fail — or a review can be requested —
whenever a pull request touches the shape of a process rather than only its formatting.

### Machine-readable

```sh
casen diff bpmn old.bpmn new.bpmn --format json
```

```json
{
  "added": ["Activity_1x8fj2"],
  "removed": [],
  "changed": ["Activity_0p2ktn"],
  "moved": ["Gateway_09sd1a"],
  "total": 3,
  "planes": [{ "id": "order-process", "total": 3, "added": 1, "removed": 0, "changed": 1, "moved": 1 }]
}
```

### Alongside the picture

```sh
casen diff bpmn old.bpmn new.bpmn --ascii
```

Prints both diagrams as ASCII art above the summary — the same rendering
[`casen view`](/docs/cli/view) produces, and the same one the VS Code extension copies into a
pull request.

---
Source: https://bpmnkit.com/docs/cli/diff
