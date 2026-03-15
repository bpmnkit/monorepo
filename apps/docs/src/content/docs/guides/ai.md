---
title: AI Integration
description: Use BPMN Kit with LLMs to generate and modify process diagrams from natural language.
---

BPMN Kit is designed from the ground up to work with AI agents. The compact intermediate
format lets a complete process diagram fit in a single LLM prompt, and the builder API
produces valid BPMN without requiring the AI to write raw XML.

## The Compact Format

Raw BPMN XML is far too verbose for LLMs — a simple three-node process generates ~60 lines.
The compact format represents the same information as a small JSON object:

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

## MCP Server

BPMN Kit ships with a Model Context Protocol (MCP) server that exposes process editing
tools to any MCP-compatible AI client (Claude Desktop, Cursor, etc.):

```sh
# Start the MCP server
casen mcp
```

Available MCP tools:
- `get_diagram` — returns the current diagram as CompactDiagram JSON
- `update_diagram` — applies a CompactDiagram diff
- `add_service_task` — adds a single service task with Zeebe config
- `add_http_call` — adds a pre-configured Camunda HTTP connector task
- `apply_layout` — re-runs auto-layout on the current diagram
- `validate` — validates the diagram and returns any schema errors
