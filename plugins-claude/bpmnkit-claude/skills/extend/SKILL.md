---
name: extend
description: Extend an existing BPMN process from a natural-language change request — lifts it to a plan, applies a targeted delta, and merges. Usage: /bpmnkit:extend <file.bpmn> <change request>
---

Extend an existing process: $ARGUMENTS

Parse $ARGUMENTS into a `.bpmn` file path and a change request. If the file isn't given, find the single `.bpmn` in the current directory or ask.

Read `references/plan-format.md` first. If the change involves an external system or an AI agent, also read `references/connectors.md` / `references/agentic.md`.

## 1. Lift the current process back into plan form

```sh
casen plan extract <file>.bpmn
```

This writes `<file>.plan.json` and reports any elements it couldn't losslessly lift (sub-processes, ad-hoc/AI-agent sub-processes, nested gateways, pools/lanes — anything outside the extractor's explicitly-scoped shape). Read the extracted plan to understand the current structure and existing element IDs — reuse them in the delta so the merge lands on the right elements.

## 2. Write a targeted delta plan

Write a **small** `<file>.delta.plan.json` — only the new/changed steps, not the whole process. A delta plan is a normal `ProcessPlan`; `casen synth --merge` compiles it standalone then merges its elements/flows into the target file by ID (replacing anything that shares an ID with what's already there, appending what's new).

If any unsupported element the extractor reported is directly relevant to this change request, tell the user before proceeding — don't guess at its shape.

## 3. Compile and merge

```sh
casen synth <file>.delta.plan.json --merge <file>.bpmn --output <file>.bpmn
```

Fix plan problems and retry (bounded, same as `/bpmnkit:implement`) — never hand-edit XML.

## 4. Verify and summarize

```sh
casen lint lint <file>.bpmn --profile deploy
casen test <file>.bpmn
```

Summarize the diff at the **element level** — which steps were added/changed/removed — not as an XML diff. If the change touched an area with existing tests, re-run them and report pass/fail; if it's untested, mention that.
