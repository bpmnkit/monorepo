# bpmnlint Compatibility — Camunda version compatibility — What is covered

| Plugin rules | Coverage |
|---|---|
| `element-type`, `implementation`, `timer`, `called-element`, `message-reference`, `error-reference`, `escalation-reference`, `escalation-boundary-event-attached-to-ref`, `signal-reference`, `no-expression`, `event-based-gateway-target`, `inclusive-gateway`, `loop-characteristics`, `sequence-flow-condition`, `no-multiple-none-start-events`, `collapsed-subprocess`, `io-mapping`, `duplicate-task-headers`, `no-template` | Covered |
| `no-zeebe-properties`, `no-candidate-users`, `no-propagate-all-parent-variables`, `no-task-schedule`, `task-schedule`, `no-signal-event-sub-process`, `start-event-form`, `start-event-form-embedded`, `user-task-form`, `user-task-definition`, `no-zeebe-user-task`, `zeebe-user-task`, `wait-for-completion` | Covered |
| `no-binding-type`, `no-execution-listeners`, `execution-listener`, `duplicate-execution-listeners`, `no-priority-definition`, `priority-definition`, `no-version-tag`, `version-tag`, `ad-hoc-sub-process`, `no-interrupting-event-subprocess`, `no-task-listeners`, `task-listener` | Covered |
| `no-business-id`, `no-execution-listener-headers`, `no-before-all-execution-listener`, `before-all-execution-listener`, `no-cancel-execution-listener`, `cancel-execution-listener`, `no-job-priority-definition` | Covered |
| `subscription` | Covered. A `zeebe:subscription` on the catch element instead of on its `bpmn:message` is an error, as in the plugin. BPMN Kit's builders put it on the message. |
| `feel-compatibility`, `variable-name`, `secrets`, `unresolvable-secret-reference`, `connector-properties`, `duplicate-execution-listener-headers`, `no-loop` | Covered, with the plugin's messages. FEEL is read by BPMN Kit's own parser, so an expression only one of the two parsers accepts can be judged differently. |
| `agent-fromai-contract`, `agent-tool-output-key` | Covered, with the plugin's messages |
| `link-event` | Covered, with the plugin's messages. Where bpmnlint's `link-event` also runs, its `flow/link-event-mismatch` finding stays instead. |
| `executable-process`, `feel`, `agent-tool-documentation` | Reported by an existing finding: `deploy/process-not-executable` (which reports every non-executable process), `feel-syntax/parse-error`, `agentic/tool-no-description` |

All 65 rules of the plugin's `camunda-cloud-*` configs are covered: 62 are reproduced, and
3 are reported by existing findings. Checked against the plugin: the test suite has four
fixture diagrams that trigger all 62 reproduced rules. It compares BPMN Kit's findings with
what the real plugin reported for them under every `camunda-cloud-*` config. The findings
match element for element, and message for message where the table says so. The 25 process templates in `@bpmnkit/patterns` give the same result as the plugin
too.

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
