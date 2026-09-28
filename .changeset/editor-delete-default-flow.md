---
"@bpmnkit/editor": patch
---

Deleting a gateway's or an activity's default flow now clears its `default` attribute, so the exported XML no longer points at a flow that is gone.
