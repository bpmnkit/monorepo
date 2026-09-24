# bpmnlint Compatibility — From your own code

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

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
