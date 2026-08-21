# casen generate — Modify-existing mode (`--input`)

Load an existing `.bpmn` file and patch it — add elements and flows, then re-apply auto-layout.
The default output overwrites the input file.

### Inspect the current state

Use `--dump-compact` to print the file's CompactDiagram JSON. Use this to discover existing
element IDs before writing a patch.

```sh
casen generate bpmn --input order.bpmn --dump-compact
```

Output is a `CompactDiagram` JSON object — the same format accepted by `--definition`.

### Add elements and flows

```sh
# Add a rejection path to an existing gateway with id "gw"
casen generate bpmn --input order.bpmn \
  --patch '{"elements":[
    {"id":"notify",     "type":"serviceTask","name":"Notify Customer","jobType":"notify-worker"},
    {"id":"end-reject", "type":"endEvent",   "name":"Rejected"}
  ],"flows":[
    {"id":"fn1","from":"gw",     "to":"notify",     "condition":"= not approved","name":"No"},
    {"id":"fn2","from":"notify", "to":"end-reject"}
  ]}'
```

Patch mode appends to the **first process** in the file. Flows in the patch can reference existing
element IDs — they are not required to be new.

### Pipe a patch from AI output

```sh
# AI generates the patch JSON, pipe it in
echo '{"elements":[...],"flows":[...]}' | casen generate bpmn --input order.bpmn
```

### Normalize layout

Run `--input` without `--patch` to re-apply auto-layout without changing the process model:

```sh
casen generate bpmn --input messy.bpmn --output clean.bpmn
```

### Flags for `--input` mode

| Flag | Description | Default |
|---|---|---|
| `--input` / `-f` | Existing `.bpmn` file to load | — |
| `--patch` | JSON patch: `{"elements":[...],"flows":[...]}` | — |
| `--dump-compact` | Print CompactDiagram JSON of `--input` and exit | — |
| `--output` / `-o` | Output path (`-` for stdout) | Overwrites `--input` file |

---
Source: https://docs.bpmnkit.com/cli/generate/
