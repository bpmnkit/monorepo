---
"@bpmnkit/core": minor
"@bpmnkit/cli": minor
"bpmnkit": minor
---

A team's `.bpmnlintrc` is honoured. `casen lint` and the VS Code Problems panel use the nearest `.bpmnlintrc`, starting in the diagram's folder. They apply its rule levels, including `off`, to BPMN Kit's equivalent findings. When the project has `bpmnlint` and `bpmn-moddle` installed, they run the project's own bpmnlint instead, so `bpmnlint-plugin-*` rules work too. BPMN Kit does not show its own finding a second time for any rule that bpmnlint ran.

`@bpmnkit/core` adds `parseBpmnlintConfig`, `resolveBpmnlintConfig`, `applyBpmnlintConfig`, `normalizeBpmnlintRuleName`, `bpmnlintRuleForFinding` and `BPMNLINT_RULE_MAP`, all pure and dependency-free. `lintDiagram` accepts `bpmnlint` and `bpmnlintDelegated`. `LintDiagnostic` and `OptimizationFinding` gain an optional `bpmnlintRule` field, and `LintReport` gains an optional `bpmnlintUnsupported` field. `@bpmnkit/core/node` adds `findBpmnlintrc`, `readBpmnlintrc`, `runBpmnlint` and `prepareBpmnlint`. bpmnlint is loaded with a dynamic `import()` from the project and is never a dependency.

All 28 bpmnlint built-in rules are mapped. 19 of them are new native checks, which run only when a `.bpmnlintrc` enables them, so the default report is unchanged. Rules that cannot be applied (plugin rules, unknown rules, `plugin:` configs without bpmnlint installed) are reported, not ignored.

`casen lint` gains `--no-bpmnlintrc` and prints the rule name for each governed finding. The VS Code extension gains the `bpmnkit.lint.bpmnlintrc` setting.
