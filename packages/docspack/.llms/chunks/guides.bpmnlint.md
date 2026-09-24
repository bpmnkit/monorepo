# bpmnlint Compatibility

Teams coming from bpmn.io usually already have a lint configuration: a `.bpmnlintrc` next to
their diagrams, bpmnlint's built-in rules, and maybe a `bpmnlint-plugin-*` package or two.
BPMN Kit reads that file. You do not need to translate it.

`casen lint` and the [VS Code extension](/docs/guides/vscode) look for `.bpmnlintrc` in the
diagram's folder and then in each parent folder, and use the first one they find. What happens
next depends on whether your project has bpmnlint installed.


## Two ways a `.bpmnlintrc` is honoured

**Your project has bpmnlint installed** (`bpmnlint` and `bpmn-moddle` are in the
`node_modules` next to the `.bpmnlintrc` or above it). BPMN Kit loads that bpmnlint and runs
your configuration with it. Presets, `plugin:` configs, third-party plugin rules and rule
options all resolve exactly as they do for the `bpmnlint` command. The findings appear under
the `bpmnlint` category, named by their rule. BPMN Kit then drops its own findings for every
rule bpmnlint just ran, so no problem is reported twice.

**bpmnlint is not installed.** BPMN Kit applies the configuration to its own analysis:

- A finding that is BPMN Kit's equivalent of a bpmnlint rule (see the table below) takes the
  level your config gives that rule. `"off"` removes it.
- A rule your config enables, and that BPMN Kit implements natively for compatibility, runs.
  These rules never run without a `.bpmnlintrc`, so the default `casen lint` report does not
  change.
- A rule your config does not mention keeps BPMN Kit's default. The `.bpmnlintrc` overrides
  BPMN Kit where the two overlap. It does not switch off BPMN Kit's other checks (FEEL syntax,
  data flow, Camunda 8 deployability and so on).
- A plugin rule (`camunda-compat/timer`), an unknown rule, or a `plugin:` config in `extends`
  cannot be applied without bpmnlint. BPMN Kit says so rather than ignoring it silently.

bpmnlint is never a dependency of BPMN Kit. It is loaded with a dynamic `import()` from your
project, only when your project has it, the same way editor integrations load a project's
own ESLint.

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
