---
name: connect
description: Wire an existing BPMN step to an external service via a Camunda connector template. Usage: /bpmnkit:connect <file> <step-id> <service>
---

Connect a step to a service: $ARGUMENTS

Parse $ARGUMENTS into a `.bpmn` file, the target step's element id, and the service to connect (e.g. "slack", "send an email", "call the pricing API"). Read `references/connectors.md` first.

## 1. Find the connector

```sh
casen connector search "<service>"
```

Present the top match(es) to the user only if there's genuine ambiguity (e.g. multiple plausible directions — outbound vs. an inbound trigger); otherwise proceed with the best match.

## 2. Show required inputs

```sh
casen connector show <template-id>
```

For every **required** input: derive a value from context (process variables via FEEL, or ask the user for anything that can't be inferred — especially secrets, which always become `{{secrets.NAME}}` placeholders, never literal credentials). Note which secret names the user needs to provision in their target engine's secret store — don't try to set them yourself.

## 3. Apply via a delta plan

```sh
casen plan extract <file>.bpmn
```

Write a delta plan replacing the target step (same element id) with a `connector` step:

```json
{ "kind": "connector", "id": "<step-id>", "name": "...", "connector": { "template": "<template-id>", "values": { ... } } }
```

## 4. Compile, merge, verify

```sh
casen synth <delta>.plan.json --merge <file>.bpmn --output <file>.bpmn
casen lint lint <file>.bpmn --profile deploy
```

Fix any `connector/missing-required` findings by filling in the missing value, then re-synth.

## 5. Summarize

Report what was wired (template id, task type), which values were set, and which secret names the user still needs to provision.
