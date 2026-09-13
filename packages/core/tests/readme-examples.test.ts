import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"

/**
 * The README is not only documentation: `apps/demo` feeds it verbatim to an LLM
 * as the system prompt for SDK-based generation, so an example that does not
 * compile teaches the model an API that does not exist. This suite was written
 * after the README's own Quick Start was found calling `.sequenceFlow()`, a
 * method the builder has never had.
 *
 * Type-checking rather than running: it needs no ambient fixtures and no file
 * I/O, and it additionally catches a wrong *option* name — the failure mode that
 * silently produces an element missing what the example claims to give it.
 */

const ROOT = dirname(fileURLToPath(import.meta.url))
const README = join(ROOT, "../README.md")
const REPO = join(ROOT, "../../..")

/** Fenced `typescript` blocks that are complete programs, i.e. they import the SDK. */
function completeExamples(markdown: string): string[] {
	return [...markdown.matchAll(/```typescript\n([\s\S]*?)```/g)]
		.map((m) => m[1] as string)
		.filter((code) => /^import .*from "@bpmnkit\/core(\/node)?"/m.test(code))
}

const examples = completeExamples(readFileSync(README, "utf8"))

describe("README examples", () => {
	it("finds the complete examples to check", () => {
		expect(examples.length).toBeGreaterThanOrEqual(4)
	})

	it("type-check against the current API", () => {
		const dir = mkdtempSync(join(tmpdir(), "bpmnkit-readme-"))
		try {
			// Each example becomes its own block scope, so ids may repeat across
			// examples; `xml` and `defs` are the inputs the prose examples assume.
			const SRC = join(ROOT, "../src/index.js")
			const SRC_NODE = join(ROOT, "../src/node/index.js")
			const preamble = [
				`import type { BpmnDefinitions } from ${JSON.stringify(SRC)}`,
				"declare const xml: string",
				"declare const defs: BpmnDefinitions",
				"",
			].join("\n")

			// Imports hoist to module scope, so two examples importing `Bpmn` would
			// collide. Merge every example's bindings into one import per module and
			// strip the import lines from the bodies.
			const bindings = new Map<string, Set<string>>()
			const bodies = examples.map((code, i) => {
				const rest: string[] = []
				for (const line of code.split("\n")) {
					const match = line.match(/^import (?:type )?\{([^}]*)\} from "@bpmnkit\/core(\/node)?"/)
					if (!match) {
						rest.push(line)
						continue
					}
					const module = match[2] ? SRC_NODE : SRC
					const set = bindings.get(module) ?? new Set<string>()
					for (const name of (match[1] as string).split(",")) {
						const trimmed = name.trim()
						if (trimmed) set.add(trimmed)
					}
					bindings.set(module, set)
				}
				return `// \u2500 example ${i} \u2500\n{\n${rest.join("\n")}\n}`
			})

			const body = [
				...[...bindings].map(
					([module, names]) =>
						`import { ${[...names].sort().join(", ")} } from ${JSON.stringify(module)}`,
				),
				...bodies,
			].join("\n")

			writeFileSync(join(dir, "examples.ts"), `${preamble}${body}\n`, "utf8")
			writeFileSync(
				join(dir, "tsconfig.json"),
				JSON.stringify({
					compilerOptions: {
						strict: true,
						noEmit: true,
						skipLibCheck: true,
						module: "ESNext",
						moduleResolution: "bundler",
						target: "ES2022",
						lib: ["ES2022", "DOM"],
						types: ["node"],
						typeRoots: [join(REPO, "node_modules/@types")],
						// The examples elide unused results; that is not what is under test.
						noUnusedLocals: false,
						noUnusedParameters: false,
					},
					include: ["examples.ts"],
				}),
				"utf8",
			)

			try {
				execFileSync(join(REPO, "node_modules/.bin/tsc"), ["-p", dir], {
					cwd: dir,
					encoding: "utf8",
					stdio: "pipe",
				})
			} catch (error) {
				const out = (error as { stdout?: string }).stdout ?? String(error)
				throw new Error(`README example does not compile:\n${out}`)
			}
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	}, 60_000)
})
