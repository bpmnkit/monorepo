---
"@bpmnkit/core": patch
---

Two silent drops in the builders: form component layout, and start event documentation

- **`FormBuilder` defaults `layout` on every component.** The component builders set
  `layout` only when the caller passed one, so a form built without naming a layout on
  each field serialised with no `layout` attribute at all. Camunda's Desktop Modeler and
  the `form-js` importer read a missing `layout` as a legacy schema and backfill a
  `row`/`columns` pair when the form is opened — a freshly built form therefore came back
  dirty on first open, with a diff on every component and no content change behind it. It
  is now filled the way the component `id` already was: a generated `Row_…` when no row is
  given, `columns: null` when no span is, and the caller's own values untouched when they
  supply them. Each component lands in its own row, and a partial layout keeps its span
  while gaining a row. `GroupBuilder` does the same, so nested children and the group
  component itself are covered.

- **`documentation` reaches a start event.** `ProcessBuilder.startEvent()` hand-builds its
  options literal so it has somewhere to put a webhook start event's `zeebe:properties`,
  and that literal listed `name` and `extensionElements` only. `ElementOptions.documentation`
  was accepted by the typed API and dropped before the model was built, with no error. It
  bit hardest on the one element bpmnkit's own optimizer asks callers to document — a
  caller who followed the `pattern/start-no-documentation` suggestion through the builder
  got the same warning back. Start events nested in sub-processes and event sub-processes
  forward their options whole and were never affected.
