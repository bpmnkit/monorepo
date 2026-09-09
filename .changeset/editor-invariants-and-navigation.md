---
"@bpmnkit/core": patch
"@bpmnkit/canvas": minor
"@bpmnkit/plugins": minor
---

Keyboard navigation, go-to-reference, and a namespace the writer was forgetting.

**`@bpmnkit/plugins/flow-navigation`** — Tab follows a sequence flow out, Shift+Tab follows it
back, and at a fan-out Tab picks between the outgoing flows rather than guessing. Enter follows
the selected flow or drills into a collapsed sub-process; `u` drills back out. The canvas binds
Tab itself, to document order, so this intercepts in the capture phase and only stops the event
when it has somewhere to go — a dead end still falls through rather than trapping the user.

**`@bpmnkit/plugins/model-navigation`** — jump from a Call Activity to its process, a Business
Rule Task to its decision, a User Task to its form. The plugin reads what an element points at;
an injected `ReferencePort` decides whether that resolves and what opening it means, so the
same plugin serves the studio, a drop and an editor extension without knowing what a file is.
Availability is optimistic and then corrected, and a resolve that lands after the diagram
changed is discarded rather than applied.

**`CanvasApi` gains `getPlanes()` and `showPlane()`.** `BpmnCanvas` had both; plugins could not
reach them, so no plugin could drill into a sub-process.

**A serializer fix, found while verifying that an engine-neutral model stays engine-neutral.**
The writer emitted only the namespaces a model was parsed with, so giving a neutral diagram a
`zeebe:taskDefinition` — which is what applying a connector template does — exported a prefix
bound to nothing. That document is not namespace-well-formed and a conforming reader may reject
it. Extension prefixes the document uses are now declared, and one the model already bound
anywhere — including on a nested element — is left alone. Scoped to extension namespaces on
purpose: the structural ones the serializer emits itself are a separate gap, recorded on the
roadmap, because repairing them here would change the model a round trip produces.

The invariant itself held and is now covered: opening a neutral model and writing it back never
stamps `modeler:executionPlatform` on it, and a model that does name an engine keeps it verbatim.
