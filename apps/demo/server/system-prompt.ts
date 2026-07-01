import { readFileSync } from "node:fs"
import { join } from "node:path"

export const WITHOUT_SDK_SYSTEM_PROMPT = `You are a BPMN expert. Output only valid BPMN 2.0 XML for Camunda 8.
No explanation, no markdown, no code fences. Raw XML only, starting with <?xml.`

export function buildSdkSystemPrompt(repoRoot: string): string {
	const readme = readFileSync(join(repoRoot, "packages/core/README.md"), "utf-8")
	const example = readFileSync(join(repoRoot, "apps/examples/src/03-loan-approval.ts"), "utf-8")

	// Grab the top-level index exports as a type reference
	const indexTs = readFileSync(join(repoRoot, "packages/core/src/index.ts"), "utf-8")

	return `You are an expert at using the @bpmnkit/core TypeScript SDK to generate Camunda 8 BPMN processes.

## SDK Overview
${readme}

## Exported API (from packages/core/src/index.ts)
\`\`\`typescript
${indexTs}
\`\`\`

## Real-World Example — Loan Approval
Study this example carefully. Use the same fluent builder pattern.
\`\`\`typescript
${example}
\`\`\`

## Output Instructions
- Generate TypeScript using @bpmnkit/core.
- At the end of your code, use: process.stdout.write(Bpmn.export(definitions))
- Do NOT use writeFileSync.
- Output code only — no explanation, no markdown prose outside the code block.
- Wrap your code in a single \`\`\`typescript code block.`
}
