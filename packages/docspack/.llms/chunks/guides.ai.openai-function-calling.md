# AI Integration — OpenAI Function Calling

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

---
Source: https://bpmnkit.com/docs/guides/ai
