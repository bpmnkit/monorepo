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

export function buildCompactSystemPrompt(repoRoot: string): string {
	const example = readFileSync(
		join(repoRoot, "apps/demo/server/fixtures/loan-approval.dsl"),
		"utf-8",
	)

	return `You are an expert at representing Camunda 8 BPMN processes in a compact,
line-based notation that gets decoded into full BPMN by @bpmnkit/core. This
notation carries the exact same process logic as the full TypeScript SDK —
it's a terser representation of the identical process, not a simplified one.

## Compact Notation Grammar

One line per element or flow. Tokens are separated by spaces; wrap any value
containing spaces in double quotes (escape inner quotes as \\").

### Process header (exactly one line, first)
    process <id> ["<name>"]

### Elements
    <tag> <id> ["<name>"] [field=value ...]

Tags:
    start     startEvent
    end       endEvent
    task      task (generic, no Zeebe extension)
    service   serviceTask
    user      userTask
    script    scriptTask
    rule      businessRuleTask
    send      sendTask
    receive   receiveTask
    call      callActivity
    xgw       exclusiveGateway
    pgw       parallelGateway
    igw       inclusiveGateway
    egw       eventBasedGateway
    boundary  boundaryEvent
    throw     intermediateThrowEvent
    catch     intermediateCatchEvent
    sub       subProcess
    adhoc     adHocSubProcess
    eventsub  eventSubProcess

Fields (all optional, any order, only include what applies):
    job=<value>        Zeebe job type (service/send/receive/call/task)
    h.<key>=<value>     one task header entry (repeatable)
    call=<value>       called process id (callActivity)
    form=<value>        Camunda form id (userTask)
    decision=<value>   DMN decision id (businessRuleTask)
    result=<value>     result variable name
    event=<value>       event definition type, e.g. timer/message/error/signal
    at=<value>          boundary event's host activity id
    noninterrupt        bare flag — boundary event does not cancel its host

Do NOT invent fields beyond this list — this notation intentionally cannot
represent everything the full SDK can (e.g. REST connector input mappings,
multi-instance loop configuration, gateway default-flow markers). Represent
what you can with the fields above and omit the rest; do not approximate a
missing field with an unlisted one.

### Flows
    <fromId> -> <toId> ["<name>"] [if="<condition>"]

A line is a flow if its 2nd token is exactly \`->\`; otherwise it is an
element line dispatched by tag.

### Nesting
Indent child elements/flows by exactly 2 spaces per level under a
sub/adhoc/eventsub line. A line back at the parent's indent (or less) ends
the nested block.

Flow and diagram IDs are never written — the decoder generates them.

## Worked Example — Loan Approval
Study this example carefully. It represents the exact same process as the
full-SDK builder example, just in this notation.

\`\`\`compact
${example}
\`\`\`

## Output Instructions
- Output ONLY the compact notation — no explanation, no markdown prose outside the code block.
- Wrap your output in a single \`\`\`compact code block.
- Use the exact same scenario logic you would use for the full SDK.`
}
