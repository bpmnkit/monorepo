---
title: AI Integration
description: Use BPMN Kit with LLMs to generate and modify process diagrams from natural language.
sidebar:
  order: 8
---

BPMN Kit is designed from the ground up to work with AI agents. The compact intermediate
format lets a complete process diagram fit in a single LLM prompt, and the builder API
produces valid BPMN without requiring the AI to write raw XML.

## The Compact Format

Raw BPMN XML is far too verbose for LLMs — a simple three-node process generates ~60 lines.
The compact format carries the topology and the common Zeebe bindings as a small JSON object:

```typescript
import { Bpmn, compactify, expand } from "@bpmnkit/core";

// Parse some BPMN XML
const definitions = Bpmn.parse(existingXml);

// Convert to compact format
const compact = compactify(definitions);
// compact is ~500 tokens for a typical approval workflow

// Send to your LLM, get back a modified compact object
const modified = await llm.modify(compact, "Add a parallel notification step after approval");

// Convert back to full BPMN
const updatedDefinitions = expand(modified);
const updatedXml = Bpmn.export(updatedDefinitions);
```

> **`expand()` does not restore what `compactify()` left behind.** `CompactElement` models
> about fifteen properties; collaborations, participants, message flows, lanes, data stores,
> artifacts, root-level messages and errors, multi-instance loop characteristics, full
> `zeebe:ioMapping` entries and most diagram interchange are not among them.
>
> The loop above is safe for a model **you generated** from a compact definition. Running it
> over a file authored elsewhere — a Camunda blueprint, anything touched in Web Modeler —
> will silently strip those parts.
>
> **Use `reconcileCompact` instead when editing an existing file.** It applies the same compact
> input as changes rather than expanding it over the model, so what the compact form cannot
> describe survives:
>
> ```typescript
> import { reconcileCompact } from "@bpmnkit/core";
>
> const { definitions } = reconcileCompact(Bpmn.parse(existingXml), modified);
> const updatedXml = Bpmn.export(definitions);
> ```
>
> If the model returns edit operations rather than a whole diagram, `applyBpmnOperations` takes
> them directly against the full model.

## Minimal Empty Diagram

When an AI agent needs to start fresh, use `Bpmn.makeEmpty()` to get a valid starting point
with a single start event:

```typescript
import { Bpmn } from "@bpmnkit/core";

// Returns a valid BPMN XML string — one start event, ready for an agent to extend
const xml = Bpmn.makeEmpty("my-process", "My Process");
```

## Prompting Strategy

For best results, give the LLM the compact diagram and a clear instruction. A good system
prompt excerpt:

```
You are a BPMN process designer. The user will describe a business process and you will
return a CompactDiagram JSON object.

Rules:
- Use camelCase IDs
- Every service task needs a taskType string (the Zeebe worker subscription)
- Use FEEL expressions for gateway conditions (start with "= ")
- Every exclusive gateway needs one branch with no condition and `isDefault: true`
- Always include a start event and at least one end event
- Do not add fields that are not part of the CompactDiagram schema
```

## Claude API Example

Using the Anthropic SDK to generate a process from a description:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { Bpmn, expand } from "@bpmnkit/core";
import type { CompactDiagram } from "@bpmnkit/core";

const anthropic = new Anthropic();

async function generateProcess(description: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: `You are a BPMN process designer. Return only valid JSON matching the
CompactDiagram schema. No explanation, no markdown — raw JSON only.`,
    messages: [
      {
        role: "user",
        content: `Create a BPMN process for: ${description}`,
      },
    ],
  });

  const json = response.content[0];
  if (json?.type !== "text") throw new Error("Unexpected response type");

  const compact = JSON.parse(json.text) as CompactDiagram;
  const definitions = expand(compact);

  return Bpmn.export(definitions);
}

const xml = await generateProcess(
  "An invoice approval process where invoices over $10,000 need manager approval"
);
```

## OpenAI Function Calling

Use function/tool calling for reliable structured output:

```typescript
import OpenAI from "openai";
import { expand, Bpmn } from "@bpmnkit/core";

const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: "Create a customer onboarding process with email verification and KYC check",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "create_bpmn_process",
        description: "Create a BPMN process diagram",
        parameters: compactDiagramJsonSchema, // export from @bpmnkit/core
      },
    },
  ],
  tool_choice: { type: "function", function: { name: "create_bpmn_process" } },
});

const toolCall = response.choices[0]?.message.tool_calls?.[0];
if (!toolCall) throw new Error("No tool call");

const compact = JSON.parse(toolCall.function.arguments);
const xml = Bpmn.export(expand(compact));
```

## Previewing While the Model Writes

A diagram is visual, and a model takes seconds to write one. Waiting for the last token to
show anything means the user watches prose scroll past while the only interesting part of the
answer is already most of the way written.

Nothing downstream can use a half-written document, though — `JSON.parse` wants the closing
brace, and the outermost one is the very last character a tool call sends.
`createCompactStream` sidesteps that by not parsing the document at all. It takes complete
`{…}` literals as they close and keeps the ones shaped like an element or a flow, which are
the innermost objects and so the first to finish:

```typescript
import { createCompactStream } from "@bpmnkit/core";

const stream = createCompactStream({ base: currentDiagram });

for await (const chunk of tokens) {
  const frame = stream.push(chunk); // null until the frame changes
  if (frame) canvas.loadDefinitions(frame, { keepViewport: true });
}
```

Pass `base` when the model is editing something. It streams only what it is adding, so without
the diagram it started from a frame is a disconnected fragment rather than the process with the
fragment in it.

`keepViewport` matters as much as the frames do: without it the canvas re-frames the diagram on
every update and pulls the view out from under whoever is watching. With it, the process grows
in place — the layout is stable enough for that, because appending to a diagram does not move
what is already placed.

### Frames are advisory

Every frame is a guess at an unfinished document. `push` never throws, drops what it cannot
place, and strips a flow's `isDefault` rather than failing when the gateway it claims has not
arrived. That is the whole bargain: a frame that guesses wrong costs one render, so the
authoritative result is whatever the model finishes with, and that is what you save or deploy.

### Where the frames come from

The local proxy (`bpmn-ai-server`) sends them on `/chat` as `preview` events, from two places:

- **The tool call being written** — argument fragments as they stream, which is the only thing
  that covers a process the model composes in a single call.
- **The MCP server's own state** — one frame per mutating tool call, once anything has been
  written. These take over as soon as they exist; they are the model's own state rather than a
  guess at an unfinished document.

A client renders `preview` as it likes and treats the `xml` event at the end of the stream as
the result. The editor's AI panel does this, and additionally outlines the elements the diagram
being edited does not have — so an edit reads as an edit rather than a rewrite. It marks
nothing when the diagram has no sequence flows yet: a process built from scratch is new all the
way through, and marking everything says no more than marking none of it.

## MCP Server

BPMN Kit ships a Model Context Protocol (MCP) server that lets any MCP client — Claude Code,
Claude Desktop, Cursor, VS Code — create, validate, simulate and deploy processes. It speaks
stdio and is started by the CLI:

```sh
casen proxy mcp
```

or, without installing the CLI first, in an MCP client's configuration:

```json
{
  "mcpServers": {
    "bpmnkit": { "command": "npx", "args": ["-y", "@bpmnkit/cli", "proxy", "mcp"] }
  }
}
```

Each CLI release submits it to the [MCP Registry](https://registry.modelcontextprotocol.io)
as `io.github.bpmnkit/bpmnkit`.

Tools:

- `bpmn_create`, `bpmn_read`, `bpmn_update` — write and read `.bpmn` files through the compact
  format, with auto-layout applied on write
- `bpmn_validate` — run the optimizer's findings over a file
- `bpmn_simulate`, `bpmn_run_history` — run a process on the local engine and read past runs
  (needs the proxy running: `casen proxy start`)
- `bpmn_deploy` — deploy to the active `casen` profile (Camunda 8 or a local Reebe)
- `form_create`, `dmn_create` — Camunda Forms and DMN decision tables
- `worker_list`, `worker_scaffold` — list and generate job workers
- `pattern_list`, `pattern_get` — the domain patterns in `@bpmnkit/patterns`
- `camunda_search`, `camunda_execute` — discover and call any Camunda 8 REST operation

The [Claude Code plugin](/docs/guides/claude-code-plugin) configures this server for you.
