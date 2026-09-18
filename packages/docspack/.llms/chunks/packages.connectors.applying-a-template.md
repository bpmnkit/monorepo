# @bpmnkit/connectors — Applying a template

Applying does not mutate an element. It turns a template plus your values into the **builder
options** for whichever element kind the template applies to, which you hand to
`@bpmnkit/core`:

```typescript
import { applyConnectorTemplate } from "@bpmnkit/connectors";
import { Bpmn } from "@bpmnkit/core";

const { serviceTask, problems } = applyConnectorTemplate("io.camunda.connectors.Slack.v1", {
  token: "=secrets.SLACK_TOKEN",
  "data.channel": "#alerts",
  "data.text": "=message",
});

// serviceTask = {
//   name: "Slack connector",
//   taskType: "io.camunda:slack:1",
//   ioMapping: { inputs: [...], outputs: [] },
//   modelerTemplate: "io.camunda.connectors.Slack.v1",
//   modelerTemplateVersion: "1",
//   modelerTemplateIcon: "data:image/svg+xml;utf8,...",
// }

Bpmn.createProcess("alerting").startEvent("in").serviceTask("notify", serviceTask).build();
```

`applyElementTemplate(template, values)` is the same operation against a template object
rather than a catalog id — the path a workspace template takes.

The result carries exactly one populated element key, so the template decides what it applies
to rather than the caller guessing:

```typescript
interface ApplyResult {
  serviceTask?: ServiceTaskOptions;
  adHocSubProcess?: Partial<AdHocSubProcessOptions>;
  startEvent?: Partial<StartEventOptions>;
  boundaryEvent?: Partial<BoundaryEventOptions>;
  intermediateEvent?: Partial<IntermediateCatchEventOptions>;
  problems: ApplyProblem[];
}
```

Nothing throws — "this value does not belong to this template" and "this required value is
missing" are answers a UI has to show, so they come back as `problems` alongside whatever
could be built:

```typescript
applyConnectorTemplate("io.camunda.connectors.Slack.v1", {}).problems;
// [{ key: "token", kind: "missing-required",
//    message: 'Missing required value for "OAuth token" (token)' }, …]

applyConnectorTemplate("nope.does.not.exist", {}).problems;
// [{ message: 'Unknown connector template "nope.does.not.exist"' }]
```

Application is deterministic: property order and the emitted bindings depend only on the
template and the values, never on iteration order or the clock. That is what lets a diagram be
rebuilt in CI and diffed.

---
Source: https://bpmnkit.com/docs/packages/connectors
