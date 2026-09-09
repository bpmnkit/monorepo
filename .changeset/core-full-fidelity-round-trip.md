---
"@bpmnkit/core": minor
---

Full-fidelity BPMN round-trip and a model layer measured against the moddle descriptors.

`Bpmn.parse()` → `Bpmn.export()` previously lost data on 11 of 12 real Camunda 8 blueprints,
including `zeebe:subscription` correlation keys — a silent corruption of message correlation.
The model now covers what it dropped, and anything it still does not name survives as
unmodelled content instead of disappearing.

- **Round-trip fidelity**: `bpmn:category`/`categoryValue`, data input/output associations,
  process-level documentation and other previously dropped constructs are preserved. A
  round-trip corpus test and a descriptor coverage gate (`check:descriptors`) fail on any type
  or property the model starts dropping again.
- **`Bpmn.continueProcess(definitions, processId)`**: extend a parsed model in place. Other
  processes, the collaboration, lanes, diagram interchange and unmodelled content survive —
  the input is not mutated.
- **`applyBpmnOperations(definitions, operations, options)`** and **`reconcileCompact()`**:
  apply edits to the full model rather than to the lossy compact projection, and report
  operations that were skipped instead of dropping them in silence.
- **`@bpmnkit/core/node` subpath**: `writeBpmn()` writes a file and reads it back to verify it,
  throwing `WriteError`/`WriteVerificationError`. The root entry point stays free of `node:`
  builtins, so it keeps working in browsers, workers and edge runtimes.
- **`semanticHash()`, `projectSemantics()`, `diffSemantics()`, `sha256Hex()`**: compare models
  by meaning, so a moved shape no longer reads as a changed process.
- **Zeebe placement**: `ensureZeebeExtension()`, `assertZeebePlacement()`,
  `isZeebePlacementAllowed()` and the generated `ZEEBE_PLACEMENT` table refuse extensions on
  elements that cannot carry them, with `ZeebePlacementError`.
- **`DiagramBuilder` collaborations**: pooled diagrams can now be built, not only parsed —
  participants, message flows and lanes.
- **`BuildOptions.explicitJoins`**: refuse inferred join gateways and name the ones that would
  have been added. `strict` keeps working and is deprecated in its favour.
