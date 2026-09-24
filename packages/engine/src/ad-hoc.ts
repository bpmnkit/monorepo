import type { BpmnFlowElement } from "@bpmnkit/core"
import { evaluate, parseExpression } from "@bpmnkit/feel"
import type { FeelNode } from "@bpmnkit/feel"
import { parseZeebeExt } from "./zeebe.js"

/** A parameter a tool reads with `fromAi(toolCall.<name>, …)` in one of its input mappings. */
export interface AdHocToolParameter {
	readonly name: string
	readonly description?: string
	readonly type?: string
	readonly schema?: Record<string, unknown>
	readonly options?: Record<string, unknown>
}

/**
 * One entry of the `adHocSubProcessElements` variable Zeebe creates when an
 * ad-hoc sub-process is activated — what a job worker (such as the AI Agent
 * connector) reads to decide which inner elements it may activate.
 */
export interface AdHocSubProcessElement {
	readonly elementId: string
	readonly elementName: string | null
	readonly documentation: string | null
	/** `zeebe:properties` of the element, by name. */
	readonly properties: Record<string, string>
	/** Parameters declared with `fromAi()` in the element's input mappings. */
	readonly parameters: readonly AdHocToolParameter[]
}

/** Elements that never hold a token of their own, or only start on an event. */
const NOT_ACTIVATABLE: ReadonlySet<BpmnFlowElement["type"]> = new Set([
	"boundaryEvent",
	"startEvent",
	"endEvent",
	"eventSubProcess",
	"dataObject",
	"dataObjectReference",
	"dataStoreReference",
])

/**
 * The elements a job worker may activate inside an ad-hoc sub-process: its
 * direct children without an incoming sequence flow, as Zeebe offers them.
 */
export function adHocActivatableElements(
	adHoc: Extract<BpmnFlowElement, { type: "adHocSubProcess" }>,
): BpmnFlowElement[] {
	return adHoc.flowElements.filter(
		(el) =>
			!NOT_ACTIVATABLE.has(el.type) &&
			!(el.type === "subProcess" && el.triggeredByEvent === true) &&
			el.incoming.length === 0,
	)
}

/** Describe an activatable element as it appears in `adHocSubProcessElements`. */
export function describeAdHocElement(el: BpmnFlowElement): AdHocSubProcessElement {
	const properties: Record<string, string> = {}
	for (const ext of el.extensionElements) {
		if (ext.name !== "zeebe:properties") continue
		for (const child of ext.children) {
			const name = child.attributes.name
			if (child.name === "zeebe:property" && name !== undefined) {
				properties[name] = child.attributes.value ?? ""
			}
		}
	}
	const parameters: AdHocToolParameter[] = []
	for (const input of parseZeebeExt(el.extensionElements).ioMapping?.inputs ?? []) {
		parameters.push(...fromAiParameters(input.source))
	}
	return {
		elementId: el.id,
		elementName: el.name ?? null,
		documentation: el.documentation ?? null,
		properties,
		parameters,
	}
}

const FROM_AI_NAMED = ["value", "description", "type", "schema", "options"] as const

/** The `fromAi(toolCall.x, …)` calls in a FEEL input mapping, as parameters. */
export function fromAiParameters(source: string): AdHocToolParameter[] {
	const expression = source.trim()
	if (!expression.startsWith("=") || !expression.includes("fromAi")) return []
	const parsed = parseExpression(expression.slice(1))
	if (parsed.ast === null) return []
	const found: AdHocToolParameter[] = []
	walk(parsed.ast, (node) => {
		let args: Partial<Record<(typeof FROM_AI_NAMED)[number], FeelNode>> | undefined
		if (node.kind === "call" && node.callee === "fromAi") {
			args = Object.fromEntries(node.args.map((arg, i) => [FROM_AI_NAMED[i], arg]))
		} else if (node.kind === "call-named" && node.callee === "fromAi") {
			args = Object.fromEntries(node.args.map((arg) => [arg.name, arg.value]))
		}
		if (args?.value?.kind !== "path") return
		const { base, key } = args.value
		if (base.kind !== "name" || base.name !== "toolCall") return
		const param: {
			name: string
			description?: string
			type?: string
			schema?: Record<string, unknown>
			options?: Record<string, unknown>
		} = { name: key }
		const description = constant(args.description)
		if (typeof description === "string") param.description = description
		const type = constant(args.type)
		if (typeof type === "string") param.type = type
		const schema = constant(args.schema)
		if (isRecord(schema)) param.schema = schema
		const options = constant(args.options)
		if (isRecord(options)) param.options = options
		found.push(param)
	})
	return found
}

function constant(node: FeelNode | undefined): unknown {
	return node === undefined ? undefined : evaluate(node, { vars: {} })
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

function walk(node: FeelNode, visit: (node: FeelNode) => void): void {
	visit(node)
	for (const value of Object.values(node)) {
		const children = Array.isArray(value) ? value : [value]
		for (const child of children) {
			if (isRecord(child)) {
				if (typeof child.kind === "string") walk(child as FeelNode, visit)
				// call-named arguments and context entries wrap their node.
				else if (isRecord(child.value) && typeof child.value.kind === "string") {
					walk(child.value as FeelNode, visit)
				}
			}
		}
	}
}
