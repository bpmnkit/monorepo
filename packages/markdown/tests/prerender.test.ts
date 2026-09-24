import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { prerenderMarkdown, renderBpmnBlock } from "../src/index.js"
import { COMPACT, XML_WITHOUT_DI } from "./fixtures.js"

/** tsx, resolved from here: the CLI runs with the temp dir as its cwd. */
const TSX = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href

const README = `# Project

Intro.

\`\`\`bpmn-compact
${COMPACT}
\`\`\`

Middle.

\`\`\`\`md
An example that must stay as it is:
\`\`\`bpmn
<not rendered/>
\`\`\`
\`\`\`\`

\`\`\`bpmn title="Leave flow" file=docs/leave.svg
${XML_WITHOUT_DI}
\`\`\`
`

describe("prerenderMarkdown", () => {
	it("wraps each block in a marked region with an image and the folded source", () => {
		const { markdown, files } = prerenderMarkdown(README)
		expect(files.map((f) => f.path)).toEqual(["diagrams/order-fulfilment.svg", "docs/leave.svg"])
		expect(markdown).toContain(
			[
				"<!-- bpmnkit-md:begin diagrams/order-fulfilment.svg -->",
				"![Order fulfilment](diagrams/order-fulfilment.svg)",
				"",
				"<details>",
				"<summary>BPMN source</summary>",
				"",
				"```bpmn-compact",
				COMPACT,
				"```",
				"",
				"</details>",
				"<!-- bpmnkit-md:end -->",
			].join("\n"),
		)
		expect(markdown).toContain("![Leave flow](docs/leave.svg)")
		expect(markdown).toContain("```bpmn\n<not rendered/>\n```\n````")
		expect(markdown.startsWith("# Project\n\nIntro.\n\n<!-- bpmnkit-md:begin")).toBe(true)
		expect(markdown.endsWith("<!-- bpmnkit-md:end -->\n")).toBe(true)
	})

	it("writes the same SVG the core function renders", () => {
		const { files } = prerenderMarkdown(README, { theme: "dark" })
		const direct = renderBpmnBlock(COMPACT, "bpmn-compact", { theme: "dark" })
		expect(files[0]?.svg).toBe(direct.ok ? `${direct.svg}\n` : "unreachable")
	})

	it("is idempotent", () => {
		const once = prerenderMarkdown(README)
		const twice = prerenderMarkdown(once.markdown)
		expect(twice).toEqual(once)
	})

	it("re-renders a region from the source it holds when the source changes", () => {
		const once = prerenderMarkdown(README).markdown
		const edited = once.replace('"name":"Check stock"', '"name":"Reserve stock"')
		const { markdown, files } = prerenderMarkdown(edited)
		expect(markdown).toBe(edited)
		expect(files[0]?.path).toBe("diagrams/order-fulfilment.svg")
		expect(files[0]?.svg).toContain("Reserve stock")
	})

	it("keeps paths unique and honours outDir", () => {
		const block = `\`\`\`bpmn-compact\n${COMPACT}\n\`\`\``
		const { files } = prerenderMarkdown(`${block}\n\n${block}\n`, { outDir: "img" })
		expect(files.map((f) => f.path)).toEqual([
			"img/order-fulfilment.svg",
			"img/order-fulfilment-2.svg",
		])
	})

	it("throws with the line of an invalid block", () => {
		expect(() => prerenderMarkdown("# x\n\n```bpmn\n<nope/>\n```\n")).toThrow(
			/^line 3: Cannot render `bpmn` block: Expected <definitions>/,
		)
	})

	it("throws on a begin marker with no end", () => {
		expect(() => prerenderMarkdown("<!-- bpmnkit-md:begin a.svg -->\n```bpmn\n")).toThrow(
			/line 1: bpmnkit-md:begin has no matching end marker/,
		)
	})
})

// Each CLI run starts a Node process with a TypeScript loader.
describe("bpmnkit-md", { timeout: 30_000 }, () => {
	let dir = ""
	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true })
	})

	const cli = (...args: string[]) =>
		execFileSync(process.execPath, ["--import", TSX, join(__dirname, "../src/cli.ts"), ...args], {
			cwd: dir,
			encoding: "utf8",
			stdio: "pipe",
		})

	it("writes the README and its SVGs, then --check passes until the source changes", () => {
		dir = mkdtempSync(join(tmpdir(), "bpmnkit-md-"))
		writeFileSync(join(dir, "README.md"), README)
		writeFileSync(join(dir, "flow.bpmn"), XML_WITHOUT_DI)

		expect(() => cli("--check", "README.md")).toThrow()
		cli("README.md", "flow.bpmn")

		expect(readFileSync(join(dir, "README.md"), "utf8")).toBe(prerenderMarkdown(README).markdown)
		expect(readFileSync(join(dir, "diagrams/order-fulfilment.svg"), "utf8")).toMatch(/^<svg /)
		expect(readFileSync(join(dir, "docs/leave.svg"), "utf8")).toContain("Leave flow</title>")
		expect(readFileSync(join(dir, "flow.svg"), "utf8")).toContain("Leave request</title>")
		expect(cli("--check", "README.md", "flow.bpmn")).toBe("")

		writeFileSync(join(dir, "diagrams/order-fulfilment.svg"), "stale")
		expect(() => cli("--check", "README.md")).toThrow(
			/out of date: diagrams\/order-fulfilment\.svg/,
		)
	})

	it("exits non-zero on an invalid block", () => {
		dir = mkdtempSync(join(tmpdir(), "bpmnkit-md-"))
		writeFileSync(join(dir, "bad.md"), "```bpmn-compact\n{\n```\n")
		expect(() => cli("bad.md")).toThrow(/bad\.md: line 1: Cannot render `bpmn-compact` block/)
	})
})
