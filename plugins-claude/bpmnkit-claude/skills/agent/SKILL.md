---
name: agent
description: Design and add a Camunda AI Agent Sub-process to a new or existing BPMN process — model, prompts, tools, and a mocked test scenario. Usage: /bpmnkit:agent [file] <description>
---

Design an AI agent: $ARGUMENTS

Read `references/agentic.md` first — it has the full binding-key facts and a verified example. Read `references/connectors.md` for tool candidates, `references/plan-format.md` for the plan shape, and `references/feel.md` for prompt/condition syntax.

## 1. Design the agent

From the description, work out:

- **Provider/model** — default to the user's configured model if the plugin's `userConfig` has one set, otherwise ask. Provider auth (`provider.<provider>.authentication.*`) always uses `{{secrets.NAME}}`.
- **System prompt** — a clear brief of the agent's role and constraints, as `systemPrompt`.
- **User prompt** — usually a FEEL reference to an incoming process variable (`"=ticketText"`), not a literal.
- **Tools** — one per capability the agent needs. For each: run `casen connector search "<capability>"` first; if a connector template exists, use it (`tools[].connector`); otherwise use a plain `tools[].jobType` (and scaffold a worker for it, per `/bpmnkit:implement` step 6). Every tool needs an `id`, a `description` written for the LLM to read, and `params` for anything the LLM should control at call time.
- **Limits** — a sensible `maxModelCalls` (default 10 is usually fine; lower it for cheap/fast tools, raise it for open-ended research tasks).
- **Error boundary** — always give the agent step an `errorBoundary` (see `references/agentic.md`'s example) so an agent/tool failure has somewhere to go.

## 2. Write or extend the plan

New process: write a full plan with the `aiAgent` step per `references/plan-format.md`. Existing process: use the `/bpmnkit:extend` flow (`casen plan extract` → delta plan containing the `aiAgent` step → `casen synth --merge`).

## 3. Compile and lint

```sh
casen synth <plan>.json --output <file>.bpmn   # or --merge <file>.bpmn
casen lint lint <file>.bpmn --categories agentic
```

Fix any `agentic/*` findings (a tool with an incoming sequence flow, a tool with no description, a `fromAi()` call not referencing `toolCall.*`, missing output aggregation) by editing the **plan**, then re-synth. Ignore `data-flow` findings against the agent's own provider/model/prompt bindings — see the "Known noisy finding" note in `references/agentic.md`.

## 4. Test with a mocked agent job

Add a scenario mocking `io.camunda.agenticai:aiagent-job-worker:1` with a plausible final response (see `references/agentic.md`'s scenario example), then:

```sh
casen test <file>.bpmn
```

This verifies the process routes correctly around the agent step — it does not exercise real model behavior or tool-calling, which is out of scope for `casen test`.

## 5. Summarize

Report: the tool schema the LLM will see (tool ids + descriptions + parameters, derived from what you wrote — this is literally what the agent is told), the model/provider, and the test result.
