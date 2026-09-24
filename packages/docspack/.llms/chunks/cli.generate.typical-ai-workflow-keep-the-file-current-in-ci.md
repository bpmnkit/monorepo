# casen generate — Typical AI workflow — Keep the file current in CI

`--check` compares the generated source with the `--out` file and exits 1 when the file is missing or
out of date. It writes nothing.

```sh
casen gen types processes/ --out src/generated/bpmn-types.ts --check
```

---
Source: https://bpmnkit.com/docs/cli/generate
