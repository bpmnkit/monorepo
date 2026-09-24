# casen CLI — Generate BPMN files

`casen generate bpmn` creates BPMN files from the command line — no interactive menu required.
Choose a built-in template, supply a full CompactDiagram JSON definition, or patch an existing file.

```sh
casen generate bpmn --template approval --process-id leave-request
casen generate bpmn --input order.bpmn --dump-compact   # inspect as JSON for AI
casen generate bpmn --input order.bpmn --patch '{"elements":[...],"flows":[...]}'
```

`casen gen types` turns BPMN files into TypeScript types for job workers — job types, their
variables, output and headers, message names and error codes — and can check that every job type has
a worker:

```sh
casen gen types processes/ --out src/generated/bpmn-types.ts
casen gen types processes/ --check-workers "src/**/*.ts" --strict
```

See [casen generate](/docs/cli/generate) for full documentation.

---
Source: https://bpmnkit.com/docs/cli/casen
