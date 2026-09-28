# VS Code Extension — Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `bpmnkit.lint.enabled` | `true` | Report findings in the Problems panel |
| `bpmnkit.lint.run` | `onType` | `onType` or `onSave` |
| `bpmnkit.lint.forceEngineRules` | `false` | Apply Camunda 8 rules to an engine-neutral diagram |
| `bpmnkit.lint.bpmnlintrc` | `true` | Honour the nearest `.bpmnlintrc`, and run the workspace's bpmnlint if installed |
| `bpmnkit.viewer.grid` | `true` | Dot grid behind the diagram |
| `bpmnkit.viewer.minimap` | `true` | Minimap in the BPMN viewer |
| `bpmnkit.simulation.enabled` | `true` | Offer step-through simulation in the preview |
| `bpmnkit.editing.enabled` | `true` | Let the diagram editor change the file |

Findings are reported for `.bpmn` files that are open; a file the editor has not loaded is
not analysed, same as every other linter in VS Code. Set `bpmnkit.editing.enabled` to `false`
for the same editors with editing switched off, when a diagram should be openable with no
chance of changing it.

---
Source: https://bpmnkit.com/docs/guides/vscode
