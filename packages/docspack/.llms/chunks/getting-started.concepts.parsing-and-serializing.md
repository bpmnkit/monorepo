# Core Concepts — Parsing and Serializing

Parse BPMN 2.0 XML into a typed object, modify it in TypeScript, and export it back:

```typescript
import { Bpmn, findProcess } from "@bpmnkit/core";

// Parse XML into a typed object
const definitions = Bpmn.parse(xmlString);

// Access the first process, or look one up by id
const process = definitions.processes[0];
const approval = findProcess(definitions, "approval-flow");

// Export back to XML
const newXml = Bpmn.export(definitions);
```

### Round-trip fidelity

`Bpmn.parse()` → `Bpmn.export()` preserves the document. Content the SDK models round-trips
through its typed fields; content it does not model is kept verbatim and re-emitted:

- **Unmodelled attributes** land in `unknownAttributes` on the element that carried them.
- **Unmodelled children** of `definitions`, a `process`, a `collaboration`, a flow node, a
  `multiInstanceLoopCharacteristics` or a data association land in `unknownChildren` — so
  `bpmn:import`, `bpmn:itemDefinition`, `bpmn:ioSpecification`, `bpmn:correlationKey`,
  `bpmn:potentialOwner`, `bpmn:complexBehaviorDefinition` and vendor elements outside
  `extensionElements` all survive, including their nested content.
- **`extensionElements`** are kept as raw `XmlElement` trees wherever BPMN allows them,
  including on root-level `message`, `error`, `escalation` and `signal` elements — which is
  what carries `zeebe:subscription` correlation keys.

`semanticHash(definitions)` gives you this as a check you can run yourself: it hashes the
model with the diagram excluded, so `semanticHash(applyAutoLayout(defs))` equals
`semanticHash(defs)`, and any difference means the model changed rather than the layout.

A corpus of BPMN documents is round-tripped on every build and compared structurally —
element counts, per-element attribute names, parent/child nesting and text content — by a
scanner written independently of the parser, so a regression fails CI rather than reaching a
release. See `packages/core/tests/roundtrip-corpus.test.ts`.

A second gate works from the other direction. The corpus can only find losses in documents
somebody wrote; this one asks the BPMN, DI and Zeebe schema descriptors what exists at all,
builds a document containing each of the 151 types they define, and requires it to come back
out — as a typed field or verbatim. A descriptor bump that widens the specification fails the
build instead of quietly widening the loss. See
`packages/core/tests/descriptor-coverage.test.ts`, or run
`pnpm --filter @bpmnkit/core check:descriptors` for the report.

**Deliberate normalisations.** The output is not byte-identical to the input, and two rewrites
are intentional:

- `isExecutable="false"` and `isSequential="false"` are written only when true. BPMN treats
  the absent attribute as false, so this is stable and changes nothing.
- Empty `<extensionElements/>` elements are dropped, and whitespace and attribute order are
  not preserved.

**Still not preserved.** Unmodelled *children* are captured on the containers listed above
only. On other elements — lanes, artifacts, root-level messages and errors —
`documentation` and `extensionElements` round-trip, but any other unrecognised child does
not. A second `<documentation>` on the same element is also dropped;
only the first is kept. If you need one of these, open an issue rather than working around it.

---
Source: https://bpmnkit.com/docs/getting-started/concepts
