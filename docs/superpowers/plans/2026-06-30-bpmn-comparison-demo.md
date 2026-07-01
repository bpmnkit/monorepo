# BPMN SDK Comparison Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/demo` — a live animated comparison page showing Claude generating a Loan Approval BPMN process with vs. without `@bpmnkit/core`, side-by-side in a 2×2 grid.

**Architecture:** A Preact/Vite frontend streams LLM output into two panels simultaneously via Server-Sent Events from a Hono server. The "with SDK" panel generates TypeScript using `@bpmnkit/core`, executes it with `tsx`, and renders the resulting BPMN XML via `@bpmnkit/canvas`. The "without SDK" panel extracts raw BPMN XML from the LLM output and attempts to render it directly. Both use the Anthropic Node.js SDK for streaming.

**Tech Stack:** Preact + Tailwind CSS (Vite), Hono (SSE server, port 3001), `@anthropic-ai/sdk`, `@bpmnkit/canvas`, `@bpmnkit/ui` (tokens), `tsx` (TS execution), `concurrently` (dev runner)

## Global Constraints

- Preact only — no React. Hooks from `"preact/hooks"`, JSX via `@preact/preset-vite`
- TypeScript strict mode — zero type errors
- Biome — zero warnings, zero errors
- All bpmnkit design tokens via `var(--bpmnkit-*)` with hex fallbacks
- Dark theme by default (`data-theme="dark"` on `<body>`)
- `ANTHROPIC_API_KEY` env var must be set to run the server (the plan uses `@anthropic-ai/sdk` directly rather than the `claude -p` subprocess described in the spec — this is more reliable and avoids CLI flag/format uncertainty; the trade-off is that auth is explicit rather than inherited from Claude Code)
- `pnpm-workspace.yaml` already contains `apps/*` — no change needed; `apps/demo` is auto-discovered
- Model: `claude-opus-4-8` (default per current model guidance — the user did not request a specific model)
- Fixed scenario: Loan Approval (uses `apps/examples/src/03-loan-approval.ts` as SDK example)
- `Bpmn.export(definitions)` is the correct API to get XML string from the SDK
- All server files use ESM (`"type": "module"`, `.js` imports)

---

## File Map

**Created:**
- `apps/demo/package.json`
- `apps/demo/tsconfig.json`
- `apps/demo/tsconfig.server.json`
- `apps/demo/vite.config.ts`
- `apps/demo/tailwind.config.ts`
- `apps/demo/index.html`
- `apps/demo/src/main.tsx`
- `apps/demo/src/App.tsx`
- `apps/demo/src/ComparePanel.tsx`
- `apps/demo/src/BpmnViewer.tsx`
- `apps/demo/src/styles.css`
- `apps/demo/server/index.ts`
- `apps/demo/server/system-prompt.ts`
- `apps/demo/server/extractor.ts`
- `apps/demo/server/sdk-executor.ts`

**Modified:**
- `package.json` (root) — add `concurrently`, `tsx` to devDependencies

---

### Task 1: Project Scaffolding

**Files:**
- Create: `apps/demo/package.json`
- Create: `apps/demo/tsconfig.json`
- Create: `apps/demo/tsconfig.server.json`
- Create: `apps/demo/vite.config.ts`
- Create: `apps/demo/index.html`
- Modify: `package.json` (root) — add devDeps

**Interfaces:**
- Produces: `apps/demo` is a valid pnpm workspace member that builds and type-checks

- [ ] **Step 1: Add `tsx` and `concurrently` to root devDependencies**

Open `package.json` at the repo root. In `"devDependencies"`, add:
```json
"concurrently": "^9.0.0",
"tsx": "^4.0.0"
```

- [ ] **Step 2: Create `apps/demo/package.json`**

```json
{
  "name": "@bpmnkit/demo",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"tsx watch server/index.ts\" \"vite --port 3000\"",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.server.json --noEmit",
    "check": "biome check .",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.0",
    "@bpmnkit/canvas": "workspace:*",
    "@bpmnkit/core": "workspace:*",
    "@bpmnkit/ui": "workspace:*",
    "@hono/node-server": "^1.0.0",
    "hono": "^4.0.0"
  }
}
```

- [ ] **Step 3: Create `apps/demo/tsconfig.json`** (frontend)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `apps/demo/tsconfig.server.json`** (server — Node ESM)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["server"]
}
```

- [ ] **Step 5: Create `apps/demo/vite.config.ts`**

```ts
import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      "/stream": "http://localhost:3001",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
})
```

- [ ] **Step 6: Create `apps/demo/index.html`**

```html
<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BPMN SDK — AI Comparison</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Install dependencies**

```bash
cd /path/to/monorepo
pnpm install
```

Expected: no errors, `@anthropic-ai/sdk` and `hono` appear in `apps/demo/node_modules`.

- [ ] **Step 8: Verify type check passes on empty stubs**

Create `apps/demo/src/main.tsx` with just:
```tsx
export {}
```

Create `apps/demo/server/index.ts` with just:
```ts
export {}
```

Run:
```bash
cd apps/demo && pnpm typecheck
```

Expected: exits 0 (no errors on empty files).

- [ ] **Step 9: Commit**

```bash
git add apps/demo/ package.json pnpm-lock.yaml
git commit -m "feat(demo): scaffold apps/demo app"
```

---

### Task 2: Text Extraction Utilities

**Files:**
- Create: `apps/demo/server/extractor.ts`
- Test: `apps/demo/server/extractor.test.ts`

**Interfaces:**
- Produces:
  - `extractXmlBlock(text: string): string | null` — finds the first `<?xml…</bpmn:definitions>` block
  - `extractTsBlock(text: string): string | null` — strips markdown fences, returns raw TS

- [ ] **Step 1: Write failing tests**

Create `apps/demo/server/extractor.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { extractTsBlock, extractXmlBlock } from "./extractor.js"

describe("extractXmlBlock", () => {
  it("returns null when no XML present", () => {
    expect(extractXmlBlock("no xml here")).toBeNull()
  })

  it("extracts a BPMN XML block", () => {
    const text = 'Some text\n<?xml version="1.0"?>\n<bpmn:definitions>foo</bpmn:definitions>\nTrailing'
    const result = extractXmlBlock(text)
    expect(result).toBe('<?xml version="1.0"?>\n<bpmn:definitions>foo</bpmn:definitions>')
  })

  it("handles definitions without bpmn: prefix", () => {
    const text = '<?xml version="1.0"?>\n<definitions>bar</definitions>'
    const result = extractXmlBlock(text)
    expect(result).toBe('<?xml version="1.0"?>\n<definitions>bar</definitions>')
  })
})

describe("extractTsBlock", () => {
  it("returns null when no code present", () => {
    expect(extractTsBlock("no code here")).toBeNull()
  })

  it("strips typescript fences", () => {
    const text = "```typescript\nconst x = 1\n```"
    expect(extractTsBlock(text)).toBe("const x = 1")
  })

  it("strips ts fences", () => {
    const text = "```ts\nconst x = 1\n```"
    expect(extractTsBlock(text)).toBe("const x = 1")
  })

  it("strips plain code fences", () => {
    const text = "```\nconst x = 1\n```"
    expect(extractTsBlock(text)).toBe("const x = 1")
  })

  it("returns text unchanged when already raw TS (no fences)", () => {
    const text = "import { Bpmn } from '@bpmnkit/core'\nconst x = 1"
    expect(extractTsBlock(text)).toBe(text)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/demo && pnpm test -- server/extractor.test.ts
```

Expected: FAIL — `Cannot find module './extractor.js'`

- [ ] **Step 3: Implement `apps/demo/server/extractor.ts`**

```ts
/**
 * Extracts the first BPMN XML block from LLM output.
 * Looks for <?xml...> through </bpmn:definitions> or </definitions>.
 */
export function extractXmlBlock(text: string): string | null {
  const match = text.match(/<\?xml[\s\S]*?<\/(?:bpmn:)?definitions>/)
  return match ? match[0] : null
}

/**
 * Extracts TypeScript code from LLM output.
 * Strips markdown fences if present; returns raw text if no fences found.
 * Returns null only if the input is empty or whitespace-only.
 */
export function extractTsBlock(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // Try to find a fenced code block (```ts, ```typescript, or ```)
  const fenced = trimmed.match(/^```(?:typescript|ts)?\n([\s\S]*?)\n```$/m)
  if (fenced) return fenced[1].trim()

  // Also check for mid-text fenced block
  const midFenced = trimmed.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/)
  if (midFenced) return midFenced[1].trim()

  // No fences — treat entire text as raw TS
  return trimmed
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/demo && pnpm test -- server/extractor.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/server/extractor.ts apps/demo/server/extractor.test.ts
git commit -m "feat(demo): add text extraction utilities"
```

---

### Task 3: System Prompt Builder

**Files:**
- Create: `apps/demo/server/system-prompt.ts`
- Test: `apps/demo/server/system-prompt.test.ts`

**Interfaces:**
- Produces:
  - `buildSdkSystemPrompt(repoRoot: string): string` — reads repo files, returns fat context string
  - `WITHOUT_SDK_SYSTEM_PROMPT: string` — constant for the raw XML prompt
  - `SCENARIO_PROMPT: string` — the fixed scenario user message (shared by both runs)

- [ ] **Step 1: Write failing test**

Create `apps/demo/server/system-prompt.test.ts`:

```ts
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { SCENARIO_PROMPT, WITHOUT_SDK_SYSTEM_PROMPT, buildSdkSystemPrompt } from "./system-prompt.js"

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../../../..")

describe("buildSdkSystemPrompt", () => {
  it("returns a non-empty string", () => {
    const prompt = buildSdkSystemPrompt(REPO_ROOT)
    expect(typeof prompt).toBe("string")
    expect(prompt.length).toBeGreaterThan(500)
  })

  it("includes the SDK package name", () => {
    const prompt = buildSdkSystemPrompt(REPO_ROOT)
    expect(prompt).toContain("@bpmnkit/core")
  })

  it("includes the example loan approval code", () => {
    const prompt = buildSdkSystemPrompt(REPO_ROOT)
    expect(prompt).toContain("LoanApproval")
  })

  it("includes the output instruction", () => {
    const prompt = buildSdkSystemPrompt(REPO_ROOT)
    expect(prompt).toContain("process.stdout.write")
  })
})

describe("WITHOUT_SDK_SYSTEM_PROMPT", () => {
  it("instructs raw XML output", () => {
    expect(WITHOUT_SDK_SYSTEM_PROMPT).toContain("XML")
  })
})

describe("SCENARIO_PROMPT", () => {
  it("mentions loan approval", () => {
    expect(SCENARIO_PROMPT.toLowerCase()).toContain("loan")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/demo && pnpm test -- server/system-prompt.test.ts
```

Expected: FAIL — `Cannot find module './system-prompt.js'`

- [ ] **Step 3: Implement `apps/demo/server/system-prompt.ts`**

```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"

export const SCENARIO_PROMPT = `Generate a Loan Approval BPMN process for Camunda 8. It should include:
- Credit score check via REST connector
- Exclusive gateway for pre-screening (reject below 580)
- DMN business rule task for risk scoring
- User task for manual underwriter review
- Separate end events for approved and rejected outcomes

Output code only. No explanation. No markdown prose outside the code block.`

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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/demo && pnpm test -- server/system-prompt.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/server/system-prompt.ts apps/demo/server/system-prompt.test.ts
git commit -m "feat(demo): add system prompt builder"
```

---

### Task 4: SDK Executor

**Files:**
- Create: `apps/demo/server/sdk-executor.ts`
- Test: `apps/demo/server/sdk-executor.test.ts`

**Interfaces:**
- Consumes: `extractTsBlock(text: string): string | null` from `./extractor.js`
- Produces: `executeSdkCode(tsCode: string, repoRoot: string): Promise<string>` — runs tsx, returns BPMN XML or throws

- [ ] **Step 1: Write failing test**

Create `apps/demo/server/sdk-executor.test.ts`:

```ts
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { executeSdkCode } from "./sdk-executor.js"

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../../../..")

describe("executeSdkCode", () => {
  it("executes valid SDK code and returns BPMN XML", async () => {
    const tsCode = `
import { Bpmn } from "@bpmnkit/core"
const definitions = Bpmn.createProcess("test-process")
  .name("Test Process")
  .startEvent("start", { name: "Start" })
  .endEvent("end", { name: "End" })
  .build()
process.stdout.write(Bpmn.export(definitions))
`
    const xml = await executeSdkCode(tsCode, REPO_ROOT)
    expect(xml).toContain("<?xml")
    expect(xml).toContain("bpmn:definitions")
    expect(xml).toContain("test-process")
  }, 30_000)

  it("throws on invalid TypeScript", async () => {
    await expect(executeSdkCode("THIS IS NOT VALID TS @@@", REPO_ROOT)).rejects.toThrow()
  }, 15_000)

  it("throws when code writes nothing to stdout", async () => {
    await expect(executeSdkCode("const x = 1", REPO_ROOT)).rejects.toThrow("no output")
  }, 15_000)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/demo && pnpm test -- server/sdk-executor.test.ts
```

Expected: FAIL — `Cannot find module './sdk-executor.js'`

- [ ] **Step 3: Implement `apps/demo/server/sdk-executor.ts`**

```ts
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"

/**
 * Writes TS code to a temp file, executes it with tsx from the monorepo root
 * (so @bpmnkit/core resolves), captures stdout as the BPMN XML.
 */
export async function executeSdkCode(tsCode: string, repoRoot: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "bpmnkit-demo-"))
  const file = join(dir, `${randomUUID()}.ts`)

  try {
    writeFileSync(file, tsCode, "utf-8")

    const result = spawnSync("tsx", [file], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 30_000,
    })

    if (result.error) throw new Error(`tsx spawn failed: ${result.error.message}`)
    if (result.status !== 0) {
      throw new Error(`tsx exited with code ${result.status}: ${result.stderr}`)
    }

    const xml = result.stdout.trim()
    if (!xml) throw new Error("tsx produced no output — code must write to stdout")

    return xml
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/demo && pnpm test -- server/sdk-executor.test.ts
```

Expected: all 3 tests pass. (Note: tests are slow due to tsx cold start — timeouts are set to 30s.)

- [ ] **Step 5: Commit**

```bash
git add apps/demo/server/sdk-executor.ts apps/demo/server/sdk-executor.test.ts
git commit -m "feat(demo): add SDK executor (tsx runner)"
```

---

### Task 5: Hono SSE Server

**Files:**
- Create: `apps/demo/server/index.ts`

**Interfaces:**
- Consumes:
  - `buildSdkSystemPrompt(repoRoot: string): string` from `./system-prompt.js`
  - `WITHOUT_SDK_SYSTEM_PROMPT`, `SCENARIO_PROMPT` from `./system-prompt.js`
  - `extractXmlBlock(text: string): string | null` from `./extractor.js`
  - `extractTsBlock(text: string): string | null` from `./extractor.js`
  - `executeSdkCode(tsCode: string, repoRoot: string): Promise<string>` from `./sdk-executor.js`
- Produces:
  - `GET /stream/with-sdk` — SSE stream
  - `GET /stream/without-sdk` — SSE stream

**SSE event types:**

| Event | Payload | When |
|-------|---------|------|
| `chunk` | `{"text":"..."}` | Each streaming token |
| `done` | `{}` | LLM stream finished |
| `bpmn` | `{"xml":"..."}` | BPMN XML ready to render |
| `error` | `{"message":"..."}` | Extraction or execution failed |

- [ ] **Step 1: Verify Anthropic SDK is installed**

```bash
cd apps/demo && node -e "import('@anthropic-ai/sdk').then(() => console.log('ok'))"
```

Expected: prints `ok`.

- [ ] **Step 2: Implement `apps/demo/server/index.ts`**

```ts
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import Anthropic from "@anthropic-ai/sdk"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import { extractTsBlock, extractXmlBlock } from "./extractor.js"
import { executeSdkCode } from "./sdk-executor.js"
import {
  SCENARIO_PROMPT,
  WITHOUT_SDK_SYSTEM_PROMPT,
  buildSdkSystemPrompt,
} from "./system-prompt.js"

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../..")
const PORT = 3001

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
const SDK_SYSTEM_PROMPT = buildSdkSystemPrompt(REPO_ROOT)

const app = new Hono()
app.use("*", cors())

async function streamLlm(
  systemPrompt: string,
  onChunk: (text: string) => Promise<void>,
): Promise<string> {
  let accumulated = ""
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: SCENARIO_PROMPT }],
  })
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const text = event.delta.text
      accumulated += text
      await onChunk(text)
    }
  }
  return accumulated
}

app.get("/stream/with-sdk", (c) =>
  streamSSE(c, async (stream) => {
    try {
      const accumulated = await streamLlm(SDK_SYSTEM_PROMPT, async (text) => {
        await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
      })
      await stream.writeSSE({ event: "done", data: "{}" })

      const tsCode = extractTsBlock(accumulated)
      if (!tsCode) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "No TypeScript code block found in LLM output" }),
        })
        return
      }

      const xml = await executeSdkCode(tsCode, REPO_ROOT)
      await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml }) })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message }) })
    }
  }),
)

app.get("/stream/without-sdk", (c) =>
  streamSSE(c, async (stream) => {
    try {
      const accumulated = await streamLlm(WITHOUT_SDK_SYSTEM_PROMPT, async (text) => {
        await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
      })
      await stream.writeSSE({ event: "done", data: "{}" })

      const xml = extractXmlBlock(accumulated)
      if (!xml) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "No BPMN XML found in LLM output" }),
        })
        return
      }
      await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml }) })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message }) })
    }
  }),
)

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Demo server running on http://localhost:${PORT}`)
})
```

- [ ] **Step 3: Run `pnpm install` to pick up `@hono/node-server`**

`@hono/node-server` was already added to `apps/demo/package.json` in Task 1. Run:
```bash
pnpm install
```

- [ ] **Step 4: Type-check the server**

```bash
cd apps/demo && pnpm exec tsc -p tsconfig.server.json --noEmit
```

Expected: exits 0.

- [ ] **Step 5: Manual smoke test**

Set your API key and start the server:
```bash
ANTHROPIC_API_KEY=your-key tsx apps/demo/server/index.ts
```

In a second terminal:
```bash
curl -N http://localhost:3001/stream/without-sdk
```

Expected: SSE events stream in — lines starting with `event: chunk` and `data: {"text":"..."}`, finishing with `event: done` and `event: bpmn`.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/server/index.ts apps/demo/package.json pnpm-lock.yaml
git commit -m "feat(demo): add Hono SSE server"
```

---

### Task 6: BpmnViewer Component

**Files:**
- Create: `apps/demo/src/BpmnViewer.tsx`

**Interfaces:**
- Produces: `<BpmnViewer xml={string} />` — renders BPMN diagram or loading/error state

- [ ] **Step 1: Implement `apps/demo/src/BpmnViewer.tsx`**

No test needed — this is a DOM-heavy component. Verified visually in Task 8.

```tsx
import { BpmnCanvas } from "@bpmnkit/canvas"
import { useEffect, useRef } from "preact/hooks"

interface BpmnViewerProps {
  xml: string | null
  error: string | null
}

export function BpmnViewer({ xml, error }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<BpmnCanvas | null>(null)

  useEffect(() => {
    if (!xml || !containerRef.current) return

    canvasRef.current?.destroy()

    canvasRef.current = new BpmnCanvas({
      container: containerRef.current,
      xml,
      theme: "dark",
      grid: false,
      fit: "contain",
    })

    return () => {
      canvasRef.current?.destroy()
      canvasRef.current = null
    }
  }, [xml])

  if (error) {
    return (
      <div
        class="flex h-full w-full items-center justify-center rounded text-sm"
        style="color: var(--bpmnkit-danger, #f87171); background: var(--bpmnkit-surface-2, #1e1e2e);"
      >
        Could not render
      </div>
    )
  }

  if (!xml) {
    return (
      <div
        class="h-full w-full rounded animate-pulse"
        style="background: var(--bpmnkit-surface-2, #1e1e2e);"
      />
    )
  }

  return (
    <div
      ref={containerRef}
      class="h-full w-full rounded overflow-hidden"
      style="background: var(--bpmnkit-surface, #161626);"
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/demo/src/BpmnViewer.tsx
git commit -m "feat(demo): add BpmnViewer component"
```

---

### Task 7: ComparePanel Component

**Files:**
- Create: `apps/demo/src/ComparePanel.tsx`

**Interfaces:**
- Consumes: `<BpmnViewer xml={string | null} error={string | null} />` from `./BpmnViewer.js`
- Produces: `<ComparePanel variant="with-sdk" | "without-sdk" runKey={number} />` — full row with streaming code + BPMN

`runKey` is an incrementing integer; each time it changes, the panel resets and reconnects the SSE stream.

- [ ] **Step 1: Implement `apps/demo/src/ComparePanel.tsx`**

```tsx
import { useEffect, useRef, useState } from "preact/hooks"
import { BpmnViewer } from "./BpmnViewer.js"

interface ComparePanelProps {
  variant: "with-sdk" | "without-sdk"
  runKey: number
}

const LABELS = {
  "with-sdk": "WITH SDK",
  "without-sdk": "WITHOUT SDK",
}

const LABEL_COLORS = {
  "with-sdk": "var(--bpmnkit-success, #22c55e)",
  "without-sdk": "var(--bpmnkit-danger, #f87171)",
}

export function ComparePanel({ variant, runKey }: ComparePanelProps) {
  const [text, setText] = useState("")
  const [bpmnXml, setBpmnXml] = useState<string | null>(null)
  const [bpmnError, setBpmnError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Reset state on new run
    setText("")
    setBpmnXml(null)
    setBpmnError(null)
    setStreaming(false)

    if (runKey === 0) return

    eventSourceRef.current?.close()

    const es = new EventSource(`/stream/${variant}`)
    eventSourceRef.current = es
    setStreaming(true)

    es.addEventListener("chunk", (e) => {
      const { text: chunk } = JSON.parse(e.data) as { text: string }
      setText((prev) => prev + chunk)
      // Auto-scroll
      if (codeRef.current) {
        codeRef.current.scrollTop = codeRef.current.scrollHeight
      }
    })

    es.addEventListener("done", () => {
      setStreaming(false)
    })

    es.addEventListener("bpmn", (e) => {
      const { xml } = JSON.parse(e.data) as { xml: string }
      setBpmnXml(xml)
    })

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) {
        const { message } = JSON.parse(e.data) as { message: string }
        setBpmnError(message)
      }
      setStreaming(false)
      es.close()
    })

    return () => {
      es.close()
    }
  }, [runKey, variant])

  return (
    <div class="flex h-full" style="border-top: 1px solid var(--bpmnkit-border, #2a2a42);">
      {/* Left column — streaming code */}
      <div class="flex flex-col w-1/2" style="border-right: 1px solid var(--bpmnkit-border, #2a2a42);">
        <div
          class="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold tracking-widest"
          style={`color: ${LABEL_COLORS[variant]}; border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);`}
        >
          {LABELS[variant]}
          {streaming && (
            <span
              class="inline-block w-2 h-4 ml-1"
              style="background: currentColor; animation: blink 1s step-end infinite;"
            />
          )}
        </div>
        <pre
          ref={codeRef}
          class="flex-1 overflow-auto p-4 text-xs leading-relaxed"
          style={`
            font-family: var(--bpmnkit-font-mono, monospace);
            color: var(--bpmnkit-fg, #cdd6f4);
            background: var(--bpmnkit-surface, #161626);
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
          `}
        >
          {text}
          {streaming && (
            <span
              style="display:inline-block;width:8px;height:1em;background:var(--bpmnkit-accent-bright,#89b4fa);vertical-align:text-bottom;animation:blink 1s step-end infinite;"
            />
          )}
        </pre>
      </div>

      {/* Right column — BPMN render */}
      <div class="flex-1 p-4" style="background: var(--bpmnkit-bg, #0d0d16);">
        <BpmnViewer xml={bpmnXml} error={bpmnError} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/demo/src/ComparePanel.tsx
git commit -m "feat(demo): add ComparePanel component"
```

---

### Task 8: App Layout, Styles, and Entry Point

**Files:**
- Create: `apps/demo/src/App.tsx`
- Create: `apps/demo/src/main.tsx`
- Create: `apps/demo/src/styles.css`

**Interfaces:**
- Consumes: `<ComparePanel variant runKey />` from `./ComparePanel.js`
- Produces: the root application — full 2×2 grid with Run button, dark theme, bpmnkit tokens

- [ ] **Step 1: Create `apps/demo/src/styles.css`**

```css
@import "@bpmnkit/ui/tokens.css";
@import "tailwindcss";

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

* {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--bpmnkit-font, system-ui, sans-serif);
  background: var(--bpmnkit-bg, #0d0d16);
  color: var(--bpmnkit-fg, #cdd6f4);
}
```

- [ ] **Step 2: Create `apps/demo/src/App.tsx`**

```tsx
import { useState } from "preact/hooks"
import { ComparePanel } from "./ComparePanel.js"

export function App() {
  const [runKey, setRunKey] = useState(0)

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <header
        class="flex items-center justify-between px-6 py-3 shrink-0"
        style="border-bottom: 1px solid var(--bpmnkit-border, #2a2a42); background: var(--bpmnkit-surface, #161626);"
      >
        <div class="flex items-center gap-3">
          <span class="font-bold text-lg" style="color: var(--bpmnkit-fg, #cdd6f4);">
            bpmnkit
          </span>
          <span class="text-sm" style="color: var(--bpmnkit-fg-muted, #8888a8);">
            / AI comparison — Loan Approval Process
          </span>
        </div>
        <button
          type="button"
          onClick={() => setRunKey((k) => k + 1)}
          class="px-4 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-80"
          style="background: var(--bpmnkit-accent, #6b9df7); color: #fff;"
        >
          {runKey === 0 ? "Run Demo" : "Run Again"}
        </button>
      </header>

      {/* Grid — two rows, each 50% height */}
      <main class="flex-1 flex flex-col overflow-hidden">
        <div class="flex-1 overflow-hidden">
          <ComparePanel variant="with-sdk" runKey={runKey} />
        </div>
        <div class="flex-1 overflow-hidden">
          <ComparePanel variant="without-sdk" runKey={runKey} />
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create `apps/demo/src/main.tsx`**

```tsx
import { render } from "preact"
import { App } from "./App.js"
import "./styles.css"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")
render(<App />, root)
```

- [ ] **Step 4: Verify `@bpmnkit/ui` exports `tokens.css`**

```bash
ls apps/demo/node_modules/@bpmnkit/ui/
```

Check that `tokens.css` is present. If not, check the `@bpmnkit/ui` `package.json` exports field for the correct path and update the import in `styles.css` accordingly.

- [ ] **Step 5: Type-check the frontend**

```bash
cd apps/demo && pnpm exec tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 6: Run linter**

```bash
cd apps/demo && pnpm check
```

Fix any Biome errors before committing.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/src/
git commit -m "feat(demo): add App layout and entry point"
```

---

### Task 9: End-to-End Integration Run

**Files:**
- No new files — verification only

- [ ] **Step 1: Ensure `ANTHROPIC_API_KEY` is set**

```bash
echo $ANTHROPIC_API_KEY
```

Expected: prints a non-empty API key. If not, set it: `export ANTHROPIC_API_KEY=sk-ant-...`

- [ ] **Step 2: Start the demo**

```bash
cd apps/demo && ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY pnpm dev
```

Expected: two lines appear:
```
Demo server running on http://localhost:3001
VITE vX.X.X ready in Xms → http://localhost:3000/
```

- [ ] **Step 3: Open the page and run the demo**

Open `http://localhost:3000` in a browser. Click "Run Demo".

Expected:
- Both panels begin streaming text simultaneously
- "WITH SDK" panel shows TypeScript code streaming in (fluent builder API)
- "WITHOUT SDK" panel shows raw XML streaming in
- Blinking cursor visible in both left columns while streaming
- After streaming ends, right columns render BPMN diagrams
- "WITH SDK" renders a clean, complete Camunda 8 Loan Approval diagram
- "WITHOUT SDK" either renders a partial diagram or shows "Could not render"

- [ ] **Step 4: Click "Run Again" and verify reset**

Both panels clear and restart from blank. Both streams fire again independently.

- [ ] **Step 5: Run full typecheck and lint**

```bash
cd apps/demo && pnpm typecheck && pnpm check
```

Expected: both exit 0.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(demo): complete BPMN SDK comparison demo"
```
