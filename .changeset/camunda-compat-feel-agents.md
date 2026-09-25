---
"@bpmnkit/core": patch
---

The Camunda version check now covers every rule of `bpmnlint-plugin-camunda-compat` 2.61.0: 62 of its 65 rules are reproduced, and 3 are reported by existing findings. New are `compat/feel-compatibility` (a FEEL built-in newer than the target, from `@camunda/feel-builtins`), `compat/variable-name`, `compat/secrets`, `compat/unresolvable-secret-reference`, `compat/connector-properties`, `compat/duplicate-execution-listener-headers`, `compat/link-event`, `compat/no-loop`, and the agent rules `compat/agent-fromai-contract` and `compat/agent-tool-output-key`. These keep the plugin's messages. A `.bpmnlintrc` that configures them no longer lists them as not applied. When bpmnlint's own `link-event` runs, its `flow/link-event-mismatch` finding stands in for `compat/link-event` on the same element.
