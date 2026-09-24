# Core Concepts — Parsing and Serializing — Round-trip fidelity

`Bpmn.parse()` → `Bpmn.export()` preserves the document. Content the SDK models round-trips
through its typed fields; content it does not model is kept verbatim and re-emitted:

- **Unmodelled attributes** land in `unknownAttributes` on the element that carried them.
- **Unmodelled children** of `definitions`, a `process`, a `collaboration`, a flow node, a
  sequence flow, a `multiInstanceLoopCharacteristics` or a data association land in
  `unknownChildren` — so
  `bpmn:import`, `bpmn:itemDefinition`, `bpmn:ioSpecification`, `bpmn:correlationKey`,
  `bpmn:potentialOwner`, `bpmn:complexBehaviorDefinition` and vendor elements outside
  `extensionElements` all survive, including their nested content.
- **`extensionElements`** are kept as raw `XmlElement` trees wherever BPMN allows them,
  including on root-level `message`, `error`, `escalation` and `signal` elements — which is
  what carries `zeebe:subscription` correlation keys — and on data associations.
- **Diagram interchange from other tools** survives too: `BPMNLabelStyle` fonts, attributes
  on `BPMNDiagram`, `BPMNPlane`, `BPMNLabel` and waypoints, and DI elements that omit the
  optional `id` or `bpmnElement` (read as `""` and written back absent).
- **Namespaces are kept as the file declared them.** A model that puts BPMN in the default
  namespace — common in files from Signavio, Trisotech and Visio add-ins — is written back
  with unprefixed names, not rewritten to `bpmn:`.

`semanticHash(definitions)` gives you this as a check you can run yourself: it hashes the
model with the diagram excluded, so `semanticHash(applyAutoLayout(defs))` equals
`semanticHash(defs)`, and any difference means the model changed rather than the layout.

A corpus of BPMN documents is round-tripped on every build and compared structurally —
element counts, per-element attribute names, parent/child nesting and text content, keyed by
namespace rather than prefix — by a scanner written independently of the parser, so a
regression fails CI rather than reaching a release. The corpus includes all 22 reference
models of the [OMG BPMN Model Interchange test suite](/docs/getting-started/conformance#bpmn-model-interchange-miwg).
See `packages/core/tests/roundtrip-corpus.test.ts`.

A second gate works from the other direction. The corpus can only find losses in documents
somebody wrote; this one asks the BPMN, DI and Zeebe schema descriptors what exists at all,
builds a document containing each of the 151 types they define, and requires it to come back
out — as a typed field or verbatim. A descriptor bump that widens the specification fails the
build instead of quietly widening the loss. See
`packages/core/tests/descriptor-coverage.test.ts`, or run
`pnpm --filter @bpmnkit/core check:descriptors` for the report.

**Deliberate normalisations.** The output is not byte-identical to the input, and two rewrites
are intentional:

- `isExecutable`, `isSequential`, `isForCompensation` and `isCollection` are written only
  when true. BPMN treats the absent attribute as false, so this is stable and changes
  nothing.
- Empty `<extensionElements/>` elements are dropped, and whitespace and attribute order are
  not preserved.

**Still not preserved.** Unmodelled *children* are captured on the containers listed above
only. On other elements — lanes, artifacts, root-level messages and errors —
`documentation` and `extensionElements` round-trip, but any other unrecognised child does
not. A second `<documentation>` on the same element is also dropped;
only the first is kept, with its attributes. If you need one of these, open an issue rather
than working around it.

`exportPreserving` goes further than `Bpmn.export`: it writes the model into the original
file's own bytes, so an unchanged model comes back byte for byte — including a coordinate
spelled `30.0` and an empty `<extensionElements/>`, which a plain export normalises.

---
Source: https://bpmnkit.com/docs/getting-started/concepts
