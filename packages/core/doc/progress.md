# Progress

## 2026-07-02 — XML: skip undefined attribute values instead of crashing the serializer

`escapeAttr()` had no runtime guard against a stray `undefined` value (declared type is `Record<string, string>`, but generated/untyped callers can leave a value unset). `writeElement()` now skips non-string attribute values rather than passing them through, so one bad attribute no longer crashes the whole `serializeXml()` call.

## 2026-07-02 — Layout: `layoutProcess` no longer throws on a residual label overlap

`assertNoOverlap()` was called unconditionally as the final step of `layoutProcess()`, so any cosmetic label overlap made `.build()` throw outright for an otherwise structurally valid process. Removed the automatic call — `assertNoOverlap` stays exported for callers who want a hard check (e.g. test fixtures), but production layout always returns a usable result.

## 2026-07-02 — Builder: tolerate reversed `subProcess`/`adHocSubProcess`/`eventSubProcess` args, complete the method mirror across builder contexts

Added `resolveSubProcessArgs()` — these three methods all take `(id, content, options?)`, an order not demonstrated anywhere in the SDK's docs, so generated code often guesses "options before callback" and gets a `content is not a function` crash. The three methods now accept either order. Also completed the "mirror `ProcessBuilder`" intent across `BranchBuilder` and `SubProcessContentBuilder`: both were missing several of `subProcess`/`adHocSubProcess`/`eventSubProcess`/`boundaryEvent`/`withBoundary` relative to their siblings.

## 2026-07-02 — Builder: add `BranchBuilder.subProcess`

`BranchBuilder` mirrors most of `ProcessBuilder`'s flow-node methods but was missing `subProcess()`, so `.branch(id, (b) => b.subProcess(...))` threw `TypeError: ... .subProcess is not a function`. Added `subProcess(id, content, options?)` to `BranchBuilder`, matching `ProcessBuilder.subProcess`'s implementation (nested flow content, multi-instance support) but wired through `BranchBuilder.addElement` instead of `ProcessBuilder.addFlowElement`.

## [0.0.24+] Fix illegal eventBasedGateway join (2026-06-28)

`insertJoinGateways()` now maps `eventBasedGateway` splits to an `exclusiveGateway` join instead of mirroring the split type. Event-based gateways are split-only constructs; the XOR join is semantically correct because exactly one branch fires.

## 2026-06-28 — Builder: emit root declarations for all event name/code refs

All event positions (`intermediateThrowEvent`, `intermediateCatchEvent`, `boundaryEvent`, `endEvent`, `startEvent`) now consistently emit root `<bpmn:signal>`, `<bpmn:message>`, `<bpmn:escalation>`, and `<bpmn:error>` elements under `<bpmn:definitions>` whenever a name/code ref option is set. Previously, intermediate and boundary events wrote the raw name/code string directly into `signalRef`/`messageRef`/`escalationRef`, producing dangling references rejected by `bpmnlint` and Camunda 8. Roots are de-duplicated: two events sharing the same `signalName` resolve to one `<bpmn:signal>` element. The `errorRef` option now creates a root error element (consistent with `errorCode`).

## 2026-06-26 — Builder: emit `<zeebe:userTask />` marker

Added `zeebeUserTask?: boolean` option to `UserTaskOptions`. When `true`, the builder emits `<zeebe:userTask />` inside `<bpmn:extensionElements>`, marking the task as a Camunda 8 native user task. Compatible with `formId`; `<zeebe:userTask />` appears before `<zeebe:formDefinition />`.
