# casen migrate — Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--out <dir>` | beside the input | Write converted files to this directory |
| `--check` | off | Report only. Write nothing, and exit 1 if any `manual` or `unsupported` finding remains |
| `--format` | `text` | `text` or `json` |
| `--force` | off | Overwrite converted files that already exist |

Put the flags after the file names: `casen migrate c7 models/*.bpmn --check`.

### As a pipeline gate

```sh
casen migrate c7 models/*.bpmn --check --format json
```

The JSON is an array with one entry per file: `file`, `output` (`null` with `--check`),
`counts`, and `findings`. Each finding has `elementId`, `elementType`, `processId`,
`construct`, `severity`, `message`, `suggestion`, and `applied`. `applied` tells you if the
converter wrote a Camunda 8 equivalent. A file that already targets Camunda 8, or that cannot
be read, is reported with an `error` and makes the command exit 1.

---
Source: https://bpmnkit.com/docs/cli/migrate
