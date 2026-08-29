# AI Integration — Claude API Example

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

---
Source: https://bpmnkit.com/docs/guides/ai
