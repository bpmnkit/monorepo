---
title: bpmnlint Compatibility
description: Keep your .bpmnlintrc. casen lint and the VS Code extension read it, map bpmnlint's rules onto BPMN Kit's findings, and run your project's own bpmnlint for bpmnlint-plugin-* rules. Includes the rule-by-rule mapping table.
sidebar:
  order: 14
---

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

## `casen lint`

```sh
casen lint lint diagrams/order.bpmn
```

```text
→ Using /work/project/.bpmnlintrc (BPMN Kit's equivalents of its rules).
→ Not applied — no BPMN Kit equivalent: plugin:camunda-compat/camunda-cloud-8-6 (a plugin config — install bpmnlint in the project to use it).
→ ⚠ [pattern] [Error_payment] Global error "Error_payment" is not referenced by any element. (global)
→ ✖ [pattern] [End_done] Element "End_done" has no diagram information (BPMNDI). (no-bpmndi)
```

The rule name in parentheses is the bpmnlint rule the finding was reported under. With
bpmnlint installed, the first line reads `(bpmnlint 11.14.0)` and bpmnlint's own findings
appear as `[bpmnlint]`.

| Flag | Effect |
|---|---|
| `--no-bpmnlintrc` | Ignore any `.bpmnlintrc`. The report is the same as without one. |
| `--categories flow,naming` | Leaves out real bpmnlint. Its findings belong to the `bpmnlint` category, so it only runs when `--categories` is not given or includes `bpmnlint`. BPMN Kit's equivalents stand in for it. |
| `--format json` | stdout stays a JSON array of findings. A finding governed by the config has a `bpmnlintRule` field. Notices go to stderr. |

The exit code works as before: the command fails when an error-level finding remains. Your
config can change that in both directions. It can raise a warning to `error`, or lower an
error to `warn`. A `.bpmnlintrc` that is not valid JSON, or has a rule level that is not
`off`, `warn`, `error`, `info` or `0`–`3`, stops the command with the file's path in the
message.

Unlike the `bpmnlint` command, which reads `.bpmnlintrc` from the current directory only,
BPMN Kit starts at the diagram's folder. Running `casen lint` from anywhere therefore gives
the same result. Plugins and `moddleExtensions` resolve from the `.bpmnlintrc`'s folder.

## VS Code

The Problems panel honours the same file, found the same way. A finding from real bpmnlint
shows `bpmnlint` as its source and the rule as its code. A finding BPMN Kit reports under a
bpmnlint rule has the rule name at the end of its message. If some configured rules could not
be applied, one information-level problem at the top of the file lists them. A broken
`.bpmnlintrc` shows as an error there too.

Editing a `.bpmnlintrc` re-analyses the open diagrams. Set `bpmnkit.lint.bpmnlintrc` to
`false` to ignore the file. Only diagrams saved on disk are checked against a `.bpmnlintrc`,
because an untitled buffer has no folder.

## Rule mapping

These are the 28 rules bpmnlint 11.14 ships. **Exact** means the rule has the same semantics
as bpmnlint's, and BPMN Kit reports the same elements. We checked this with a test for each
rule, and by running both linters against every `.bpmn` file in the BPMN Kit repository under
`bpmnlint:all`. That corpus is small (16 files), so treat it as evidence, not proof.
**Approximate** means the finding covers the same
concern but not the same set of elements. The notes say how they differ. "Native" marks a
check BPMN Kit added for this compatibility layer. It runs only when your config enables the
rule.

| bpmnlint rule | recommended | BPMN Kit finding | Match | Notes |
|---|---|---|---|---|
| `ad-hoc-sub-process` | error | `flow/ad-hoc-start-end-event` (native) | Exact | |
| `conditional-event` | — | `flow/conditional-event-no-condition` (native) | Exact | |
| `conditional-flows` | error | `feel/empty-condition` | Approximate | Only flows leaving an exclusive or inclusive split gateway are checked. They are checked even when no sibling flow has a condition, which bpmnlint does not do. |
| `end-event-required` | error | `flow/no-end-event`, `flow/sub-process-no-end-event` (native) | Exact | |
| `event-based-gateway` | error | `flow/event-gateway-invalid` (native) | Exact | |
| `event-sub-process-typed-start-event` | error | `flow/event-sub-process-untyped-start` (native) | Exact | |
| `fake-join` | warn | `flow/multi-incoming-task` | Approximate | Top-level process scope only. |
| `global` | warn | `pattern/global-element` (native) | Exact | Also reports a global element with no `name` attribute. bpmnlint only reports an empty name. |
| `label-required` | error | `naming/unlabeled-task`, `naming/unlabeled-start-event`, `naming/unlabeled-end-event`, `naming/split-gateway-no-label`, `naming/missing-flow-condition` | Approximate | Covers tasks, call activities, start and end events, exclusive and inclusive split gateways and the flows leaving them, in the top-level scope. Does not check intermediate and boundary events, elements inside sub-processes, pools or lanes. |
| `link-event` | error | `flow/link-event-mismatch` (native) | Exact | |
| `no-bpmndi` | error | `pattern/missing-di` (native) | Exact | |
| `no-complex-gateway` | error | `pattern/complex-gateway` (native) | Exact | |
| `no-disconnected` | error | `flow/disconnected` (native) | Exact | |
| `no-duplicate-sequence-flows` | error | `flow/duplicate-sequence-flow` (native) | Exact | One finding for each duplicate flow, which names the flow, its source and its target. bpmnlint reports these three separately. |
| `no-gateway-join-fork` | error | `flow/mixed-gateway` | Approximate | Top-level process scope only. |
| `no-implicit-end` | error | `flow/dead-end` | Approximate | Top-level scope only. Does not exempt link throw events, compensation handlers or event sub-processes. Also reports data objects and data stores. |
| `no-implicit-split` | error | `flow/implicit-split` (native) | Exact | |
| `no-implicit-start` | error | `flow/unreachable` | Approximate | Reports every element that cannot be reached from a start event: the element without incoming flows and everything after it. Top-level scope only. Also reports event sub-processes, data objects and data stores. |
| `no-inclusive-gateway` | warn | `pattern/inclusive-gateway` (native) | Exact | |
| `no-overlapping-elements` | warn | `pattern/overlapping-elements` (native) | Exact | |
| `single-blank-start-event` | error | `flow/multiple-blank-start-events` (native) | Exact | |
| `single-event-definition` | error | `flow/multiple-event-definitions` (native) | Exact | |
| `standard-size` | — | `pattern/non-standard-size` (native) | Exact | Accepts the same per-type options, for example `["warn", { "bpmn:Task": { "width": 120, "height": 80 } }]`. |
| `start-event-required` | error | `flow/no-start-event`, `flow/sub-process-no-start-event` (native) | Exact | |
| `sub-process-blank-start-event` | error | `flow/sub-process-typed-start` (native) | Exact | |
| `superfluous-gateway` | warn | `flow/redundant-gateway` | Approximate | Top-level process scope only. |
| `superfluous-label` | warn | `naming/superfluous-flow-label` (native) | Exact | |
| `superfluous-termination` | warn | `flow/superfluous-termination` (native) | Exact | |

`bpmnlint:recommended`, `bpmnlint:all` and `bpmnlint:correctness` expand to bpmnlint 11.14's
presets. Rule names are normalised the way bpmnlint normalises them, so
`bpmnlint/label-required` and `label-required` are the same rule.

Rules that have no equivalent without bpmnlint installed:

- **Plugin rules and configs.** Everything from `bpmnlint-plugin-*`, including
  `bpmnlint-plugin-camunda-compat`. Install bpmnlint in the project and they run.
- **Unknown rule names.** These are reported as unknown, the same as bpmnlint would report
  them.

Where the native equivalents check connections, they read the sequence flows, not the
`<bpmn:incoming>`/`<bpmn:outgoing>` children. Real bpmnlint reads the children. For files a
modeler wrote, the two are the same. For hand-written XML that leaves the children out,
bpmnlint sees no connections at all, and BPMN Kit sees the flows.

## From your own code

The configuration and mapping are plain functions in `@bpmnkit/core`, with no filesystem
access, so they work in a browser too:

```typescript
import { Bpmn, lintDiagram, parseBpmnlintConfig, resolveBpmnlintConfig } from "@bpmnkit/core"

const config = resolveBpmnlintConfig(parseBpmnlintConfig(rcText))
const report = lintDiagram(Bpmn.parse(xml), { bpmnlint: config })
report.diagnostics      // governed findings carry `bpmnlintRule`
report.bpmnlintUnsupported // what the config asked for that could not be applied
```

In Node, `@bpmnkit/core/node` finds the file and runs the project's bpmnlint:

```typescript
import { applyBpmnlintConfig, Bpmn, optimize } from "@bpmnkit/core"
import { prepareBpmnlint } from "@bpmnkit/core/node"

const setup = await prepareBpmnlint(filePath, xml) // undefined when no .bpmnlintrc applies
if (setup) {
  const defs = Bpmn.parse(xml)
  const { findings, unsupported } = applyBpmnlintConfig(defs, optimize(defs).findings, setup.config, {
    delegated: setup.delegated, // true when real bpmnlint ran; its reports are in setup.reports
  })
}
```

`BPMNLINT_RULE_MAP` exports the table above as data.
