# bpmnlint Compatibility — `casen lint`

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

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
