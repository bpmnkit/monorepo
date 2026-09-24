---
"@bpmnkit/proxy": patch
---

The MCP servers no longer write a diagram they have not checked. `bpmn_create` and
`bpmn_update` in the AIKit server (`casen proxy mcp`) parse the model's XML and write it
through `writeBpmn`, which verifies the file reads back as the same model and replaces it
atomically; XML that does not parse is refused and the file is left alone, and
`bpmn_update` now reports how many elements it added, removed and changed. The editing MCP
server writes its BPMN, DMN and form files atomically too.
