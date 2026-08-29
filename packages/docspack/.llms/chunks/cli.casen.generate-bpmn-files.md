# casen CLI — Generate BPMN files

`casen generate bpmn` creates BPMN files from the command line — no interactive menu required.
Choose a built-in template, supply a full CompactDiagram JSON definition, or patch an existing file.

```sh
casen generate bpmn --template approval --process-id leave-request
casen generate bpmn --input order.bpmn --dump-compact   # inspect as JSON for AI
casen generate bpmn --input order.bpmn --patch '{"elements":[...],"flows":[...]}'
```

See [casen generate](/docs/cli/generate) for full documentation.


## View BPMN, DMN, and Form files

`casen view` opens a local browser-based viewer. Accepts individual files, folders, or a mix.

```sh
casen view bpmn ./processes/     # all .bpmn files in a folder
casen view dmn routing.dmn       # DMN decision table
casen view open ./project/       # any mix of .bpmn/.dmn/.form
```

See [casen view](/docs/cli/view) for full documentation.

---
Source: https://bpmnkit.com/docs/cli/casen
