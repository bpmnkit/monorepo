---
"@bpmnkit/core": minor
"@bpmnkit/cli": minor
"bpmnkit": minor
---

Lint now checks a diagram against the Camunda 8 version it targets, as Camunda Modeler does with `@camunda/linting`. Its findings (`compat/…`, in the existing `deploy` category) read `modeler:executionPlatformVersion` and report two kinds of problem. The first is a construct the target version cannot run, for example `Ad-hoc sub-process "Tools" needs Camunda 8.7 or newer; this model targets Camunda 8.6.` The second is a property the target version requires, such as a timer value that does not parse or an error without an error code. The version table comes from `bpmnlint-plugin-camunda-compat` 2.61.0: 62 of its 65 rules are reproduced, and the other 3 are covered by existing findings. A problem that a `deploy/*` check already reports on the same element is not repeated. The check runs with the `deploy` category in `optimize()`, `lintDiagram()`, `casen lint`, the editor's lint panel and the VS Code Problems panel. A model with no Camunda 8 version gets no `compat` findings.

A `.bpmnlintrc` that extends `plugin:camunda-compat/camunda-cloud-X-Y` now runs this check against version X.Y and is no longer reported as "not applied". `camunda-compat/<rule>` entries re-level or turn off its findings. When the project's own bpmnlint runs the plugin, BPMN Kit's findings step aside.

`@bpmnkit/core` adds `analyzeCamundaCompat`, `splitCamundaCompatConfig`, `applyCamundaCompatConfig`, `normalizeCamundaVersion`, `CAMUNDA_COMPAT_RULES`, `CAMUNDA_COMPAT_VERSIONS` and `CAMUNDA_COMPAT_PLUGIN_VERSION`. `isCamundaCompatFinding` tells these findings apart. `OptimizeOptions` gains `camundaVersion`; `OptimizationCategory` is unchanged, since widening a union the API returns would be a major change.
