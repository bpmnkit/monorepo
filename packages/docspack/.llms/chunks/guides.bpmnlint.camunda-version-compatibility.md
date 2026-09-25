# bpmnlint Compatibility — Camunda version compatibility

Camunda Modeler checks a diagram against the Camunda 8 version it targets. The version is in
`modeler:executionPlatformVersion` on `<bpmn:definitions>`, and the rules come from
`@camunda/linting`, which runs `bpmnlint-plugin-camunda-compat`. BPMN Kit does the same check
itself, as `compat/…` findings in the `deploy` category. It runs in `casen lint`, in `optimize()`, in the editor's lint
panel and in the VS Code extension, on every model that names a Camunda Cloud / Camunda 8
platform and version. A model without them gets no `compat` findings.

```text
✖ [deploy] [tools] Ad-hoc sub-process "Tools" needs Camunda 8.7 or newer; this model targets Camunda 8.6.
✖ [deploy] [notify] Signal end event "Notify" needs Camunda 8.3 or newer; this model targets Camunda 8.2.
✖ [deploy] [wait] Timer intermediate catch event "wait" has timeDuration "5 minutes", which is not an ISO 8601 duration (PT15M).
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

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
