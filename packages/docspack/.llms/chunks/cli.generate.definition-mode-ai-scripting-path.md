# casen generate — Definition mode (AI / scripting path)

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

---
Source: https://docs.bpmnkit.com/cli/generate/
