---
"@bpmnkit/core": minor
"@bpmnkit/plugins": minor
"@bpmnkit/cli": minor
---

Static analysis reaches the canvas, and stops accusing engine-neutral diagrams.

`casen lint` has had five categories of rules for a while and none of them were visible while
modelling. `@bpmnkit/plugins/lint` puts them on the diagram: a marker on every offending
element (worst severity wins, so a task with an error and three warnings reads as an error), a
control in the corner counting them, and clicking it steps through them one at a time. It
re-lints after an edit, debounced, so typing a name does not re-run the analysis per keystroke.

**`lintDiagram(defs, options)` in `@bpmnkit/core`** is the seam a host needs. Two things it adds
over calling `optimize` directly, both about handing findings somewhere else:

- The result is **serialisable**. An `OptimizationFinding` carries an `applyFix` function, so it
  cannot cross a `postMessage` or a JSON boundary; a `LintDiagnostic` says `fixable: true` and
  leaves the fix where it can still be called. It also names the diagram plane each finding is
  on, since a viewer shows one plane at a time.
- The **rules match the model**. A diagram that names no `modeler:executionPlatform` is no longer
  judged against Camunda 8 deployability. This was measured, not assumed: on an engine-neutral
  model every other category either stays quiet or reports something structural that holds
  regardless, while `deploy` calls a plain service task an **error** for having no
  `zeebe:taskDefinition` — a demand its author never signed up for.

**`casen lint` changes behaviour** to match: on a model with no execution platform it skips the
`deploy`, `connector` and `agentic` categories and says why. `--profile deploy` forces them back
on, since asking for the deploy gate is asking for those rules. Both surfaces ask
`lintCategories` the same question rather than each keeping their own list.
