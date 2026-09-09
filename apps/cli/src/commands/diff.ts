import { readFile } from "node:fs/promises"
import { renderBpmnAscii } from "@bpmnkit/ascii"
import { Bpmn, diffDiagram } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnDiffCategory, BpmnDiffResult } from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

const CATEGORY_SYMBOL: Record<BpmnDiffCategory, string> = {
	added: "+",
	removed: "−",
	changed: "~",
	moved: "⇄",
}

const CATEGORIES: readonly BpmnDiffCategory[] = ["added", "removed", "changed", "moved"]

/**
 * Maps element id → name for everything a diagram can draw, sub-process
 * children and sequence flows included. An id alone tells a reviewer nothing;
 * `Activity_0x8f2j1` is not what they called the task.
 */
function collectNames(definitions: BpmnDefinitions): Map<string, string> {
	const names = new Map<string, string>()

	const visit = (element: { id?: string; name?: string }): void => {
		if (typeof element.id === "string" && typeof element.name === "string" && element.name !== "") {
			names.set(element.id, element.name)
		}
	}

	for (const process of definitions.processes) {
		visit(process)
		const containers: Array<{
			flowElements?: Array<{ id?: string; name?: string }>
			sequenceFlows?: Array<{ id?: string; name?: string }>
		}> = [process]

		while (containers.length > 0) {
			const container = containers.pop()
			if (container === undefined) continue
			for (const flow of container.sequenceFlows ?? []) visit(flow)
			for (const element of container.flowElements ?? []) {
				visit(element)
				// Sub-processes carry their own children; the cast is the price of a
				// walk over a union whose branches do not share a container type.
				const nested = element as {
					flowElements?: Array<{ id?: string; name?: string }>
					sequenceFlows?: Array<{ id?: string; name?: string }>
				}
				if (nested.flowElements !== undefined || nested.sequenceFlows !== undefined) {
					containers.push(nested)
				}
			}
		}
	}

	return names
}

function label(id: string, names: Map<string, string>): string {
	const name = names.get(id)
	return name === undefined ? id : `${name} (${id})`
}

function summarise(result: BpmnDiffResult): string {
	const parts = CATEGORIES.filter((c) => result[c].length > 0).map(
		(c) => `${result[c].length} ${c}`,
	)
	return `${result.total} difference${result.total === 1 ? "" : "s"}: ${parts.join(", ")}`
}

const diffBpmnCmd: Command = {
	name: "bpmn",
	description: "Compare two BPMN files and report what a reviewer would see change",
	args: [
		{ name: "before", description: "Path to the earlier .bpmn file", required: true },
		{ name: "after", description: "Path to the later .bpmn file", required: true },
	],
	flags: [
		{
			name: "format",
			description: "Output format: text (default) or json",
			type: "string",
			enum: ["text", "json"],
		},
		{
			name: "exit-code",
			description: "Exit non-zero when the two diagrams differ, for use as a pipeline gate",
			type: "boolean",
		},
		{
			name: "ascii",
			description: "Also render both diagrams as ASCII art",
			type: "boolean",
		},
	],
	examples: [
		{ description: "Compare two files", command: "casen diff bpmn old.bpmn new.bpmn" },
		{
			description: "Fail a pipeline when a process changed",
			command: "casen diff bpmn main.bpmn branch.bpmn --exit-code",
		},
		{
			description: "Machine-readable output",
			command: "casen diff bpmn old.bpmn new.bpmn --format json",
		},
	],
	async run(ctx) {
		const beforePath = ctx.positional[0]
		const afterPath = ctx.positional[1]
		if (!beforePath) throw new Error("Missing required argument: <before>")
		if (!afterPath) throw new Error("Missing required argument: <after>")

		const [beforeXml, afterXml] = await Promise.all([
			readFile(beforePath, "utf-8"),
			readFile(afterPath, "utf-8"),
		])
		const before = Bpmn.parse(beforeXml)
		const after = Bpmn.parse(afterXml)
		const result = diffDiagram(before, after)

		if (ctx.flags.format === "json") {
			ctx.output.print(result)
			if (ctx.flags["exit-code"] && result.total > 0) {
				throw new Error(summarise(result))
			}
			return
		}

		if (ctx.flags.ascii) {
			ctx.output.print(`── ${beforePath} ──\n${renderBpmnAscii(beforeXml)}`)
			ctx.output.print(`── ${afterPath} ──\n${renderBpmnAscii(afterXml)}`)
		}

		if (result.total === 0) {
			ctx.output.ok("No differences.")
			return
		}

		// Names come from whichever side still has the element; a removed one is
		// only in the earlier model.
		const names = new Map([...collectNames(before), ...collectNames(after)])

		// One block rather than a line at a time: `info()` prefixes every line it
		// writes, which would sit in front of each category marker.
		const lines: string[] = []
		for (const category of CATEGORIES) {
			for (const id of result[category]) {
				lines.push(`  ${CATEGORY_SYMBOL[category]} ${label(id, names)}`)
			}
		}
		lines.push("", summarise(result))

		// A change inside a collapsed sub-process is invisible in a viewer until
		// the reader drills into it, so name the planes rather than only the total.
		if (result.planes.length > 1) {
			const perPlane = result.planes.map((p) => `${label(p.id, names)}: ${p.total}`).join(", ")
			lines.push(`Across ${result.planes.length} planes: ${perPlane}`)
		}

		ctx.output.print(lines.join("\n"))

		if (ctx.flags["exit-code"]) {
			throw new Error(summarise(result))
		}
	},
}

export const diffGroup: CommandGroup = {
	name: "diff",
	description: "Compare two diagrams and report what changed",
	commands: [diffBpmnCmd],
}
