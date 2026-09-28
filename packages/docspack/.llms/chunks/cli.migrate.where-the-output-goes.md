# casen migrate — Where the output goes

- By default, each `name.bpmn` is written to `name.c8.bpmn` beside it. The Camunda 7 file is
  never changed.
- With `--out <dir>`, files are written to that directory under their own names. The
  directory is created if it does not exist.
- An existing output file is never overwritten unless you pass `--force`. The command
  reports the file and exits 1.

The output keeps the source file's formatting and element order, so a text diff against the
Camunda 7 file shows only what the migration changed.

---
Source: https://bpmnkit.com/docs/cli/migrate
