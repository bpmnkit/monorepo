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
- A plugin rule (`acme/no-foo`), an unknown rule, or a `plugin:` config in `extends`
  cannot be applied without bpmnlint. BPMN Kit says so rather than ignoring it silently. The
  exception is `bpmnlint-plugin-camunda-compat`: BPMN Kit has its own
  [Camunda version check](#camunda-version-compatibility) and uses it in place of the plugin.

bpmnlint is never a dependency of BPMN Kit. It is loaded with a dynamic `import()` from your
project, only when your project has it, the same way editor integrations load a project's
own ESLint.

## `casen lint`

```sh
casen lint lint diagrams/order.bpmn
```

```text
→ Using /work/project/.bpmnlintrc (BPMN Kit's equivalents of its rules).
→ Not applied — no BPMN Kit equivalent: plugin:acme/recommended (a plugin config — install bpmnlint in the project to use it).
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

- **Plugin rules and configs.** Everything from `bpmnlint-plugin-*`, except the
  `bpmnlint-plugin-camunda-compat` rules listed as covered below. Install bpmnlint in the
  project and they run.
- **Unknown rule names.** These are reported as unknown, the same as bpmnlint would report
  them.

Where the native equivalents check connections, they read the sequence flows, not the
`<bpmn:incoming>`/`<bpmn:outgoing>` children. Real bpmnlint reads the children. For files a
modeler wrote, the two are the same. For hand-written XML that leaves the children out,
bpmnlint sees no connections at all, and BPMN Kit sees the flows.

## Camunda version compatibility

Camunda Modeler checks a diagram against the Camunda 8 version it targets. The version is in
`modeler:executionPlatformVersion` on `<bpmn:definitions>`, and the rules come from
`@camunda/linting`, which runs `bpmnlint-plugin-camunda-compat`. BPMN Kit does the same check
itself, in the `compat` category. It runs in `casen lint`, in `optimize()`, in the editor's lint
panel and in the VS Code extension, on every model that names a Camunda Cloud / Camunda 8
platform and version. A model without them gets no `compat` findings.

```text
✖ [compat] [tools] Ad-hoc sub-process "Tools" needs Camunda 8.7 or newer; this model targets Camunda 8.6.
✖ [compat] [notify] Signal end event "Notify" needs Camunda 8.3 or newer; this model targets Camunda 8.2.
✖ [compat] [wait] Timer intermediate catch event "wait" has timeDuration "5 minutes", which is not an ISO 8601 duration (PT15M).
```

Each finding is `compat/<rule>`, named after the plugin rule it reproduces, and has the
plugin's severity. Two kinds of problem are reported:

- **Something the target version cannot run.** An element or event definition that is newer
  than the target (inclusive gateways 8.1, `bpmn:task` 8.2, escalation and link events 8.2,
  signal events 8.2/8.3, compensation 8.5, ad-hoc sub-processes 8.7, conditional events 8.9),
  or one no version runs (complex gateway, transaction). Also Zeebe extensions and properties:
  `zeebe:properties` (8.1), candidate users, task schedule and `propagateAllParentVariables="false"`
  (8.2), start event forms (8.3), `formId` and collapsed sub-processes (8.4), `zeebe:userTask`
  (8.5), execution listeners, `bindingType`, version tags and task priority (8.6), task listeners
  (8.8), and business ids, job priority and `beforeAll`/`cancel` listeners (8.10). A cron timer
  cycle needs 8.1, and a `timeDate` on a boundary or intermediate event needs 8.3.
- **A property the target version requires.** A job type, called decision or script, a called
  process id, a message name and correlation key, a timer value that parses as ISO 8601 or
  cron, an error code, an escalation code, a signal name, a multi-instance input collection,
  a condition on each non-default flow out of a gateway, and listener types.

From 8.2 on, processes that are not marked executable are skipped, as Modeler skips them. A
version newer than the table is checked as the newest version the table has (8.10). Later
versions only remove restrictions.

The version table is data (`CAMUNDA_COMPAT_RULES` in `@bpmnkit/core`), taken from
`bpmnlint-plugin-camunda-compat` 2.61.0 (`@camunda/linting` 3.57.0). BPMN Kit does not
report a problem twice. When a `deploy/*` check already reports it on the same element, only
that finding stays. For example, `deploy/service-task-no-type` stands in for
`compat/implementation`.

### With a `.bpmnlintrc`

`extends: "plugin:camunda-compat/camunda-cloud-8-6"` (or the `bpmnlint-plugin-camunda-compat`
spelling, and any `camunda-cloud-1-0` to `camunda-cloud-8-10`) runs this check against 8.6,
whatever version the model names. This also works on a model that names no platform. The
config's rules take the plugin's levels. `camunda-compat/<rule>` entries under `rules` change
the level or turn a rule `off`, and the finding shows the rule name. Like the plugin's configs,
it also turns on `start-event-required`. When your project's own bpmnlint runs the plugin,
BPMN Kit's `compat` findings step aside. `camunda-platform-7-*` configs are not mapped.

### What is covered

| Plugin rules | Coverage |
|---|---|
| `element-type`, `implementation`, `timer`, `called-element`, `message-reference`, `error-reference`, `escalation-reference`, `escalation-boundary-event-attached-to-ref`, `signal-reference`, `no-expression`, `event-based-gateway-target`, `inclusive-gateway`, `loop-characteristics`, `sequence-flow-condition`, `no-multiple-none-start-events`, `collapsed-subprocess`, `io-mapping`, `duplicate-task-headers`, `no-template` | Covered |
| `no-zeebe-properties`, `no-candidate-users`, `no-propagate-all-parent-variables`, `no-task-schedule`, `task-schedule`, `no-signal-event-sub-process`, `start-event-form`, `start-event-form-embedded`, `user-task-form`, `user-task-definition`, `no-zeebe-user-task`, `zeebe-user-task`, `wait-for-completion` | Covered |
| `no-binding-type`, `no-execution-listeners`, `execution-listener`, `duplicate-execution-listeners`, `no-priority-definition`, `priority-definition`, `no-version-tag`, `version-tag`, `ad-hoc-sub-process`, `no-interrupting-event-subprocess`, `no-task-listeners`, `task-listener` | Covered |
| `no-business-id`, `no-execution-listener-headers`, `no-before-all-execution-listener`, `before-all-execution-listener`, `no-cancel-execution-listener`, `cancel-execution-listener`, `no-job-priority-definition` | Covered |
| `subscription` | Covered, with one difference. A `zeebe:subscription` on the catch element instead of on its `bpmn:message` is a warning in BPMN Kit. The plugin reports it as an error on the message. BPMN Kit's builder writes the key on the element, and Reebe reads it there. |
| `executable-process`, `feel`, `agent-tool-documentation` | Reported by an existing finding: `deploy/process-not-executable` (which reports every non-executable process), `feel-syntax/parse-error`, `agentic/tool-no-description` |
| `feel-compatibility`, `agent-fromai-contract`, `agent-tool-output-key`, `variable-name` | Not covered. They need a FEEL analyzer and Camunda's per-version FEEL function table. |
| `no-loop`, `link-event`, `secrets`, `unresolvable-secret-reference`, `connector-properties`, `duplicate-execution-listener-headers` | Not covered. Configured, they are listed as not applied. |

Checked against the plugin: the test suite has two fixture diagrams that trigger all 52 covered
rules. It compares BPMN Kit's findings with what the real plugin reported for them under every
`camunda-cloud-*` config. The findings match element for element. The 25 process templates
in `@bpmnkit/patterns` give the same result as the plugin too, except for the `subscription`
difference above.

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
