---
"@bpmnkit/core": patch
---

The DMN preserving write now preserves the file.

`exportDmnPreserving` shipped with the first cut of the preserving writer and did not deliver
what it claimed. Measured on two real Camunda decisions — a risk score and a loan eligibility
table, each with a `dmndi:DMNDI` diagram section — a save that changed nothing came back with
**six and eighteen lines rewritten**, whichever way the file was indented. Both are **0** now,
and editing a single rule changes **two** lines instead of between 12 and 90.

Two defects, neither of which the existing tests could see, because they used a hand-written
decision with no diagram section and one hit policy:

- **`preserveFormatting` refused to pair an element carrying an `id` in the file and none in
  the update.** The rule was there to stop a deliberate *move* being undone, and it was too
  broad: two elements can only have been matched by id in the first place if they both carry
  one, so one side lacking an id means there is no move to preserve — it is simply the
  everyday case where the model does not hold an id the file does. DMN is exactly that case:
  `DMNDiagram` and `DMNShape` are named in the file and not in the model, so a decision's
  entire `DMNDI` block was deleted and written out again on every save. Narrowed to "leave the
  pair alone only when *both* sides have an id".
- **`serializeDmn` dropped `hitPolicy="UNIQUE"` as the schema default while `parseDmn` read
  it**, so `parse(export(m))` no longer equalled `m`. A preserving write checks itself against
  exactly that comparison before it uses anything it kept, so one omitted attribute cost the
  file *every* other thing the write was preserving. `hitPolicy` is now written whenever the
  model has one. This is the only change visible to a caller that does not use the preserving
  writer: `serializeDmn` emits an attribute on `decisionTable` that it previously left out,
  and the value is the one the model already carried.

BPMN was re-measured with the narrowed pairing rule in place: no regression.
