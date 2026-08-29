---
title: casen generate
description: Generate BPMN files from built-in templates, CompactDiagram JSON, or by patching an existing file.
sidebar:
  order: 2
---

`casen generate bpmn` produces BPMN 2.0 files without the interactive TUI. It has three operating
modes: template, definition (full JSON), and modify-existing (patch). Auto-layout is applied in all modes.

## Commands

```
casen generate
└── bpmn    — generate or modify a BPMN file
```

## Template mode

Pick a built-in template by name. Use `--process-id` and `--name` to customise the identifiers.

```sh
casen generate bpmn --template minimal --process-id order --name "Order Processing"
casen generate bpmn --template approval --process-id leave-request
casen generate bpmn --template parallel --process-id enrichment --name Enrichment
casen generate bpmn --template timer-start --process-id nightly-sync
```

| Template | Pattern |
|---|---|
| `empty` | Start event only — bare skeleton |
| `minimal` | Start → service task → end |
| `user-task` | Start → user task → end |
| `call-activity` | Start → call activity → end |
| `business-rule` | Start → business rule task → end |
| `approval` | Start → user task → XOR gateway → approve/reject paths |
| `parallel` | Start → parallel fork → 2 service tasks → join → end |
| `inclusive` | Start → inclusive gateway → 2 conditional tasks → merge → end |
| `timer-start` | Timer start event → service task → end |
| `message-start` | Message start event → service task → end |
| `error-boundary` | Service task with error boundary → two end events |
| `subprocess` | Start → embedded sub-process → end |
| `event-subprocess` | Process with a non-interrupting error event sub-process |

### Flags

| Flag | Short | Description | Default |
|---|---|---|---|
| `--template` | | Template name (see table above) | `minimal` |
| `--process-id` | `-i` | Process element ID | `process` |
| `--name` | `-n` | Process display name | — |
| `--output` | `-o` | Output file path (`-` for stdout) | `<process-id>.bpmn` |

## Definition mode (AI / scripting path)

Pass a full **CompactDiagram** JSON object directly. This covers all 23 BPMN element types, all event
definition types, boundary events, sub-processes, and Zeebe extensions.

```sh
# Inline JSON
casen generate bpmn --definition '{"id":"Definitions_order","processes":[...]}'

# Pipe from a file or AI output
cat definition.json | casen generate bpmn --output order.bpmn

# Write to stdout
echo '{"id":"Defs","processes":[...]}' | casen generate bpmn --output -
```

### Print the JSON schema

Run `--help-schema` to print the full CompactDiagram reference — element types, event types,
field descriptions, and a worked example — formatted for quick AI consumption:

```sh
casen generate bpmn --help-schema
```

### CompactDiagram structure

```json
{
  "id": "Definitions_my-process",
  "processes": [{
    "id": "my-process",
    "name": "My Process",
    "elements": [
      { "id": "start",  "type": "startEvent",      "name": "Start" },
      { "id": "task1",  "type": "serviceTask",      "name": "Do Work", "jobType": "my-worker" },
      { "id": "gw",     "type": "exclusiveGateway", "name": "OK?" },
      { "id": "end-ok", "type": "endEvent",         "name": "Done" },
      { "id": "end-err","type": "endEvent",         "name": "Failed", "eventType": "error" }
    ],
    "flows": [
      { "id": "f1", "from": "start",  "to": "task1" },
      { "id": "f2", "from": "task1",  "to": "gw" },
      { "id": "f3", "from": "gw",     "to": "end-ok",  "condition": "= ok",      "name": "Yes" },
      { "id": "f4", "from": "gw",     "to": "end-err", "condition": "= not ok",  "name": "No" }
    ]
  }]
}
```

**Element types** — all 23 BPMN types supported:

- Tasks: `serviceTask` `userTask` `scriptTask` `businessRuleTask` `callActivity` `sendTask` `receiveTask` `manualTask` `task`
- Events: `startEvent` `endEvent` `intermediateCatchEvent` `intermediateThrowEvent` `boundaryEvent`
- Gateways: `exclusiveGateway` `parallelGateway` `inclusiveGateway` `eventBasedGateway` `complexGateway`
- Containers: `subProcess` `adHocSubProcess` `eventSubProcess` `transaction`

**Event types** (`eventType` field on event elements):
`timer` `message` `signal` `error` `escalation` `terminate` `cancel` `conditional` `link` `compensate`

**Zeebe extensions:**

| Field | Applies to | Effect |
|---|---|---|
| `jobType` | `serviceTask`, `sendTask` | Sets `zeebe:taskDefinition.type` |
| `taskHeaders` | `serviceTask`, `sendTask` | Sets `zeebe:taskHeaders` key/value pairs |
| `resultVariable` | `serviceTask`, `businessRuleTask` | Maps connector response to a variable |
| `calledProcess` | `callActivity` | Sets `zeebe:calledElement.processId` |
| `formId` | `userTask` | Sets `zeebe:formDefinition.formId` |
| `decisionId` | `businessRuleTask` | Sets `zeebe:calledDecision.decisionId` |

**HTTP connector shorthand:**

```json
{
  "id": "http1",
  "type": "serviceTask",
  "name": "Call API",
  "jobType": "io.camunda:http-json:1",
  "taskHeaders": {
    "url": "https://api.example.com/orders",
    "method": "POST"
  },
  "resultVariable": "apiResponse"
}
```

## Modify-existing mode (`--input`)

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

## Typical AI workflow

```sh
# 1. Inspect the existing file — AI learns element IDs
casen generate bpmn --input order.bpmn --dump-compact

# 2. Check the schema if needed
casen generate bpmn --help-schema

# 3. AI generates patch JSON and pipes it in
echo '{"elements":[...],"flows":[...]}' | casen generate bpmn --input order.bpmn

# 4. Verify the result
casen view bpmn order.bpmn
```
