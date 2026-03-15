import type { APIRoute } from "astro"
import { CODE, FEATURES, PACKAGES, SITE } from "../data/content"

const packageList = PACKAGES.map((p) => `- [${p.name}](${p.url}): ${p.description}`).join("\n")
const featureList = FEATURES.map((f) => `- ${f}`).join("\n")

const content = `\
# ${SITE.name} — Full Content

> ${SITE.description}

---

## What is BPMN Kit?

BPMN Kit is an open-source TypeScript monorepo that makes it possible to work
with BPMN 2.0 processes entirely in code. Instead of wrestling with hundreds of
lines of raw XML and manual coordinates, you call a fluent TypeScript API and
get back valid, auto-laid-out BPMN XML ready to deploy to Camunda 8.

The SDK is AI-native: a compact intermediate format lets an entire diagram fit
in a single LLM prompt. AI agents can generate, read, and modify process
definitions without ever seeing raw XML.

Every package is strict-TypeScript, ESM-only, tree-shakeable, and runs in
browsers, Node.js, Deno, Bun, and edge runtimes.

---

## Packages

${packageList}

---

## Key Features

${featureList}

---

## Core SDK (@bpmnkit/core)

### Basic Process

\`\`\`typescript
${CODE.withSdk}
\`\`\`

### Exclusive Gateway (Branching)

\`\`\`typescript
${CODE.approvalFlow}
\`\`\`

### Parallel Gateway

\`\`\`typescript
${CODE.parallelGateway}
\`\`\`

---

## Simulation Engine (@bpmnkit/engine)

Run BPMN processes locally in the browser or Node.js. Zero external
dependencies. Supports service tasks, user tasks, exclusive/parallel/event-based
gateways, timers, message correlation, and DMN decision evaluation.

\`\`\`typescript
${CODE.deployRun}
\`\`\`

---

## REST API Client (@bpmnkit/api)

\`\`\`typescript
${CODE.apiClient}
\`\`\`

Resource coverage: Processes, Jobs & Workers, Decisions (DMN), Messages,
Incidents, Variables, Signals, User Tasks, Authorizations, Groups, Users.

Non-functional: LRU+TTL cache, exponential backoff, TypedEventEmitter,
ESM tree-shakeable, zero transitive runtime dependencies.

---

## CLI — casen

Interactive TUI for managing Camunda 8. Navigate with arrow keys.

\`\`\`
casen
\`\`\`

Main menu groups: profile, process, job, incident, decision, variable, message.

Example — list deployed process definitions:

  Navigate to: process → list → Enter

  Result:
    bpmnProcessId             name                   ver
    ─────────────────────────────────────────────────────
  ▶ order-validation           Order Validation        1
    payment-processing         Payment Processing      2
    ai-support-agent           AI Support Agent        1
    approval-flow              Approval Flow           3

---

## Getting Started

### 1. Install

\`\`\`
pnpm add @bpmnkit/core
\`\`\`

### 2. Create a process

\`\`\`typescript
${CODE.createProcess}
\`\`\`

### 3. Deploy and run

\`\`\`typescript
${CODE.deployRun}
\`\`\`

---

## Links

- Live Editor: ${SITE.url}/editor
- GitHub: ${SITE.github}
- npm: ${SITE.npm}
- Compact index (llms.txt): ${SITE.url}/llms.txt
`

export const GET: APIRoute = () =>
	new Response(content, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	})
