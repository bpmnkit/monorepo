import type { BpmnFlowElement } from "@bpmnkit/core"
import { parseExpression } from "@bpmnkit/feel"
import type { FeelNode } from "@bpmnkit/feel"
import { parseZeebeExt } from "./zeebe.js"

/**
 * A value a tool reads with `fromAi(value, description, type, schema, options)` in one
 * of its input mappings. A field Zeebe would give as null or empty is left out.
 */
export interface AdHocToolParameter {
	/**
	 * The reference `fromAi()` tags, as Zeebe names it: `toolCall.orderId` for
	 * `fromAi(toolCall.orderId)`, `orderId` for `fromAi(orderId)`. The AI Agent
	 * connector offers the model `toolCall.<name>` parameters as `<name>`.
	 */
	readonly name: string
	readonly description?: string
	readonly type?: string
	readonly schema?: Record<string, unknown>
	readonly options?: Record<string, unknown>
}

/**
 * One entry of the `adHocSubProcessElements` variable Zeebe creates when an
 * ad-hoc sub-process is activated — what a job worker (such as the AI Agent
 * connector) reads to decide which inner elements it may activate. As in Zeebe,
 * a field that is null or empty is left out.
 */
export interface AdHocSubProcessElement {
	readonly elementId: string
	readonly elementName?: string
	readonly documentation?: string
	/** `zeebe:properties` of the element, by name; an empty value is `null`. */
	readonly properties?: Readonly<Record<string, string | null>>
	/** Parameters declared with `fromAi()` in the element's input mappings. */
	readonly parameters?: readonly AdHocToolParameter[]
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

/**
 * Describe an activatable element as it appears in `adHocSubProcessElements`: the
 * fields of Zeebe's `AdHocActivityMetadata`, in its order, without those that are
 * null or empty (it is `@JsonInclude(NON_EMPTY)`).
 */
export function describeAdHocElement(el: BpmnFlowElement): AdHocSubProcessElement {
	const properties: Record<string, string | null> = {}
	for (const ext of el.extensionElements) {
		if (ext.name !== "zeebe:properties") continue
		for (const child of ext.children) {
			const name = child.attributes.name
			if (child.name === "zeebe:property" && name !== undefined && name !== "") {
				const value = child.attributes.value
				properties[name] = value === undefined || value === "" ? null : value
			}
		}
	}
	const parameters: AdHocToolParameter[] = []
	for (const input of parseZeebeExt(el.extensionElements).ioMapping?.inputs ?? []) {
		parameters.push(...fromAiParameters(input.source))
	}
	const element: {
		elementId: string
		elementName?: string
		documentation?: string
		properties?: Record<string, string | null>
		parameters?: AdHocToolParameter[]
	} = { elementId: el.id }
	if (el.name) element.elementName = el.name
	if (el.documentation) element.documentation = el.documentation
	if (Object.keys(properties).length > 0) element.properties = properties
	if (parameters.length > 0) element.parameters = parameters
	return element
}

const FROM_AI_NAMED = ["value", "description", "type", "schema", "options"] as const

/**
 * The `fromAi()` calls in a FEEL input mapping, as parameters. As in Zeebe's
 * `FromAiTaggedParameterExtractor`, a description or type must be a string literal
 * and a schema or options a context of literals, and the arguments of a call are not
 * searched for more calls. Zeebe rejects the deployment of a call that breaks those
 * rules; here the call (a value that is not a reference) or the argument is left out.
 */
export function fromAiParameters(source: string): AdHocToolParameter[] {
	const expression = source.trim()
	if (!expression.startsWith("=") || !expression.includes("fromAi")) return []
	const parsed = parseExpression(expression.slice(1))
	if (parsed.ast === null) return []
	const found: AdHocToolParameter[] = []
	walk(parsed.ast, (node) => {
		const args: Partial<Record<(typeof FROM_AI_NAMED)[number], FeelNode>> | undefined =
			node.kind === "call" && node.callee === "fromAi"
				? Object.fromEntries(node.args.map((arg, i) => [FROM_AI_NAMED[i], arg]))
				: node.kind === "call-named" && node.callee === "fromAi"
					? Object.fromEntries(node.args.map((arg) => [arg.name, arg.value]))
					: undefined
		if (args === undefined) return false
		const name = args.value === undefined ? undefined : reference(args.value)
		if (name === undefined) return true
		const param: {
			name: string
			description?: string
			type?: string
			schema?: Record<string, unknown>
			options?: Record<string, unknown>
		} = { name }
		if (args.description?.kind === "string" && args.description.value !== "") {
			param.description = args.description.value
		}
		if (args.type?.kind === "string" && args.type.value !== "") param.type = args.type.value
		const schema = contextLiteral(args.schema)
		if (schema !== undefined) param.schema = schema
		const options = contextLiteral(args.options)
		if (options !== undefined) param.options = options
		found.push(param)
		return true
	})
	return found
}

/** `a.b.c` for a reference to a variable or a path into one, as FEEL's `Ref` names it. */
function reference(node: FeelNode): string | undefined {
	if (node.kind === "name") return node.name
	if (node.kind === "path") {
		const base = reference(node.base)
		return base === undefined ? undefined : `${base}.${node.key}`
	}
	return undefined
}

const NOT_LITERAL = Symbol("not a literal")

/** A non-empty context of literals, as a record. */
function contextLiteral(node: FeelNode | undefined): Record<string, unknown> | undefined {
	if (node?.kind !== "context" || node.entries.length === 0) return undefined
	const value = literal(node)
	return value === NOT_LITERAL ? undefined : (value as Record<string, unknown>)
}

/** The value of a string, number or boolean literal, or of a list or context of them. */
function literal(node: FeelNode): unknown {
	switch (node.kind) {
		case "string":
		case "number":
		case "boolean":
			return node.value
		case "unary-minus":
			return node.operand.kind === "number" ? -node.operand.value : NOT_LITERAL
		case "list": {
			const items = node.items.map(literal)
			return items.includes(NOT_LITERAL) ? NOT_LITERAL : items
		}
		case "context": {
			const record: Record<string, unknown> = {}
			for (const entry of node.entries) {
				const value = literal(entry.value)
				if (value === NOT_LITERAL) return NOT_LITERAL
				record[entry.key] = value
			}
			return record
		}
		default:
			return NOT_LITERAL
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Visit `node` and every node inside it, except inside a node `visit` returns `true` for. */
function walk(node: FeelNode, visit: (node: FeelNode) => boolean): void {
	if (visit(node)) return
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
