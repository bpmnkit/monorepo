# bpmnlint Compatibility — Camunda version compatibility — With a `.bpmnlintrc`

`extends: "plugin:camunda-compat/camunda-cloud-8-6"` (or the `bpmnlint-plugin-camunda-compat`
spelling, and any `camunda-cloud-1-0` to `camunda-cloud-8-10`) runs this check against 8.6,
whatever version the model names. This also works on a model that names no platform. The
config's rules take the plugin's levels. `camunda-compat/<rule>` entries under `rules` change
the level or turn a rule `off`, and the finding shows the rule name. Like the plugin's configs,
it also turns on `start-event-required`. When your project's own bpmnlint runs the plugin,
BPMN Kit's `compat` findings step aside. `camunda-platform-7-*` configs are not mapped.

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
