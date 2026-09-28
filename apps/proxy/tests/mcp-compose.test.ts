/**
 * `compose_diagram` runs code the model writes. It used to run it under
 * node:vm with the Bridge functions passed in, and a Bridge function's
 * `constructor` is the host's `Function` — one line from `process` and a shell.
 * These drive the real MCP server over stdio.
 */
import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"

const SERVER = fileURLToPath(new URL("../src/mcp-server.ts", import.meta.url))
const dir = mkdtempSync(join(tmpdir(), "bpmnkit-mcp-test-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

/** Calls one tool on a fresh server; resolves with the tool result's text. */
function callTool(
	name: string,
	args: Record<string, unknown>,
	output: string,
): Promise<{ text: string; isError: boolean }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(process.execPath, ["--import", "tsx", SERVER, "--output", output], {
			stdio: ["pipe", "pipe", "ignore"],
		})
		let out = ""
		proc.stdout.on("data", (c: Buffer) => {
			out += c.toString()
			const line = out.split("\n").find((l) => l.includes('"id":1'))
			if (!line) return
			const res = JSON.parse(line) as {
				result: { content: Array<{ text: string }>; isError: boolean }
			}
			proc.kill()
			resolve({ text: res.result.content[0]?.text ?? "", isError: res.result.isError })
		})
		proc.on("error", reject)
		proc.stdin.write(
			`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })}\n`,
		)
	})
}

describe("compose_diagram", () => {
	it("still builds a diagram through Bridge", async () => {
		const output = join(dir, "built.bpmn")
		const compact = {
			id: "Definitions_1",
			processes: [
				{
					id: "Process_1",
					elements: [
						{ id: "start", type: "startEvent", name: "Order received" },
						{ id: "end", type: "endEvent", name: "Order done" },
					],
					flows: [{ id: "f1", from: "start", to: "end" }],
				},
			],
		}
		const result = await callTool(
			"compose_diagram",
			{
				code: `Bridge.mcpReplaceDiagram(${JSON.stringify(JSON.stringify(compact))}); return JSON.parse(Bridge.mcpGetDiagram()).processes[0].elements.length`,
			},
			output,
		)
		expect(result).toEqual({ text: "2", isError: false })
		expect(readFileSync(output, "utf8")).toContain("Order received")
	}, 30000)

	it("gives the code no way to the host process", async () => {
		const result = await callTool(
			"compose_diagram",
			{
				code: `
					const probes = [
						() => Bridge.mcpGetDiagram.constructor("return typeof process")(),
						() => Bridge.constructor.constructor("return typeof process")(),
						() => typeof process,
						() => typeof require,
					]
					return probes.map((p) => { try { return p() } catch (e) { return "threw" } })`,
			},
			join(dir, "escape.bpmn"),
		)
		expect(result.isError).toBe(false)
		for (const probe of JSON.parse(result.text) as string[]) expect(probe).not.toBe("object")
	}, 30000)
})

describe("sdk_execute", () => {
	it("gives the code no way to the host process", async () => {
		const result = await callTool(
			"sdk_execute",
			{ code: 'return sdk.parse.constructor("return typeof process")()' },
			join(dir, "sdk.bpmn"),
		)
		expect(result.text).not.toContain("object")
	}, 30000)
})
