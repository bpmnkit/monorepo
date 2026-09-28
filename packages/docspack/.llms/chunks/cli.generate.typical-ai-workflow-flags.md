# casen generate — Typical AI workflow — Flags

| Flag | Description | Default |
|---|---|---|
| `--out` | Write the generated source to this file (its directory is created) | stdout |
| `--check` | Exit 1 when `--out` is missing or stale; write nothing | — |
| `--check-workers` | Comma-separated globs or directories of worker sources to compare | — |
| `--strict` | With `--check-workers`: exit 1 on any mismatch | — |
| `--format` | `json` prints the `--check-workers` report as JSON | `text` |

---
Source: https://bpmnkit.com/docs/cli/generate
