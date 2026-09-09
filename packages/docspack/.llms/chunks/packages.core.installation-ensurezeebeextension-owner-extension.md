# @bpmnkit/core — Installation — `ensureZeebeExtension(owner, extension)`

Finds a Zeebe extension element on a flow element, creating it if absent, and refuses a
placement the Zeebe schema does not allow. Use it instead of pushing onto `extensionElements`
directly: the push cannot fail, so `zeebe:calledDecision` on a service task becomes a deploy
error in Camunda rather than a throw where it was written.

```typescript
import { ensureZeebeExtension, ZeebePlacementError } from "@bpmnkit/core";

ensureZeebeExtension(serviceTask, "zeebe:taskDefinition").attributes.type = "worker";
ensureZeebeExtension(serviceTask, "zeebe:calledDecision"); // throws ZeebePlacementError
```

`ZeebePlacementError` carries `ownerElement`, `extension` and `allowedOn`, so the message
names the elements that *would* have been valid.

`isZeebePlacementAllowed(ownerElement, extension)` answers the same question without throwing,
and `ZEEBE_PLACEMENT` is the table itself — extension name to the element names that may own it.

The table is generated from `zeebe.json`'s `meta.allowedIn` (`zeebe-bpmn-moddle`, MIT),
resolved against the BPMN type graph, so it states the schema's rules rather than ours. **An
extension the schema says nothing about is allowed**: the descriptor declares no owner for
`zeebe:subscription` or `zeebe:properties`, and inventing a rule there would reject valid
documents. Non-`zeebe:` extensions are not checked at all.

`applyBpmnOperations` runs the same check, and reports a misplaced extension as an ordinary
operation problem — checked before anything is written, so the element is left untouched and
the rest of the batch still applies.

---
Source: https://bpmnkit.com/docs/packages/core
