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
 * Throw Zeebe's deployment rejection for the first `fromAi()` call it cannot read in
 * the input mappings of an element an ad-hoc sub-process (in `elements`, at any
 * depth) can activate, as Zeebe's `AdHocSubProcessTransformer` does.
 */
export function checkAdHocFromAiCalls(elements: readonly BpmnFlowElement[]): void {
	for (const el of elements) {
		if (el.type === "adHocSubProcess") {
			for (const tool of adHocActivatableElements(el)) {
				for (const input of parseZeebeExt(tool.extensionElements).ioMapping?.inputs ?? []) {
					try {
						fromAiParameters(input.source)
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error)
						throw new Error(
							`Failed to extract ad-hoc activity parameters for element '${tool.id}'. ${message}`,
						)
					}
				}
			}
		}
		if ("flowElements" in el) checkAdHocFromAiCalls(el.flowElements)
	}
}

/**
 * The `fromAi()` calls in a FEEL input mapping, as parameters. As in Zeebe's
 * `FromAiTaggedParameterExtractor`, a description or type must be a string literal
 * and a schema or options a context of literals, and the arguments of a call are not
 * searched for more calls. A call that breaks those rules throws the extractor's
 * message, with which Zeebe rejects the deployment.
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
		const param: {
			name: string
			description?: string
			type?: string
			schema?: Record<string, unknown>
			options?: Record<string, unknown>
		} = { name: parameterName(args.value) }
		for (const field of ["description", "type"] as const) {
			const arg = args[field]
			if (arg === undefined) continue
			if (arg.kind !== "string") {
				throw new Error(
					`Expected fromAi() parameter '${field}' to be a string, but received '${mismatchValue(arg)}'.`,
				)
			}
			if (arg.value !== "") param[field] = arg.value
		}
		for (const field of ["schema", "options"] as const) {
			const arg = args[field]
			if (arg === undefined) continue
			if (arg.kind !== "context") {
				throw new Error(
					`Expected fromAi() parameter '${field}' to be a context (map), but received '${mismatchValue(arg)}'.`,
				)
			}
			const value = literal(arg) as Record<string, unknown>
			if (arg.entries.length > 0) param[field] = value
		}
		found.push(param)
		return true
	})
	return found
}

/** The name of the parameter a `fromAi()` value tags: the whole reference it is. */
function parameterName(value: FeelNode | undefined): string {
	// Zeebe's extractor switches on the missing value, which throws a
	// NullPointerException without a message.
	if (value === undefined) throw new Error("null")
	const name = reference(value)
	if (name !== undefined) return name
	const received = value.kind === "string" ? `string '${value.value}'` : mismatchValue(value)
	throw new Error(
		`Expected fromAi() parameter 'value' to be a reference (e.g. 'toolCall.customParameter'), but received ${received}.`,
	)
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

/**
 * How Zeebe's extractor shows a value of the wrong kind: a literal by its value,
 * anything else as the FEEL engine's expression tree.
 */
function mismatchValue(node: FeelNode): string {
	switch (node.kind) {
		case "string":
			return node.value
		case "number":
		case "boolean":
			return String(node.value)
		default:
			return scalaTree(node)
	}
}

/**
 * The value of a literal: a string, number or boolean, or a list or context of them.
 * Throws Zeebe's message for anything else.
 */
function literal(node: FeelNode): unknown {
	switch (node.kind) {
		case "string":
		case "number":
		case "boolean":
			return node.value
		case "unary-minus":
			// FEEL reads a negative number literal as one number.
			if (node.operand.kind === "number") return -node.operand.value
			break
		case "list":
			return node.items.map(literal)
		case "context": {
			const record: Record<string, unknown> = {}
			for (const entry of node.entries) record[entry.key] = literal(entry.value)
			return record
		}
	}
	const tree = scalaTree(node)
	const end = tree.indexOf("(")
	// A case object, such as `ConstNull`, is the instance of the class `ConstNull$`.
	const className = end === -1 ? `${tree}$` : tree.slice(0, end)
	throw new Error(`Unsupported expression value in fromAi() function invocation: ${className}`)
}

const SCALA_BINARY: Record<string, string> = {
	"+": "Addition",
	"-": "Subtraction",
	"*": "Multiplication",
	"/": "Division",
	"**": "Exponentiation",
	"=": "Equal",
	"<": "LessThan",
	"<=": "LessOrEqual",
	">": "GreaterThan",
	">=": "GreaterOrEqual",
	and: "Conjunction",
	or: "Disjunction",
}

/**
 * `node` as the FEEL engine's (feel-scala's) expression tree prints itself (a Scala
 * case class's `toString`), which Zeebe's messages show for a value of the wrong kind.
 */
function scalaTree(node: FeelNode): string {
	const list = (items: string[]) => `List(${items.join(", ")})`
	const bound = (bindings: Array<{ name: string; domain: FeelNode }>) =>
		list(bindings.map((b) => `(${b.name},${scalaTree(b.domain)})`))
	switch (node.kind) {
		case "null":
			return "ConstNull"
		case "boolean":
			return `ConstBool(${node.value})`
		case "number":
			return `ConstNumber(${node.value})`
		case "string":
			return `ConstString(${node.value})`
		case "name":
		case "path": {
			const name = reference(node)
			if (name !== undefined) return `Ref(${list(name.split("."))})`
			return node.kind === "path" ? `PathExpression(${scalaTree(node.base)},${node.key})` : ""
		}
		case "unary-minus":
			return `ArithmeticNegation(${scalaTree(node.operand)})`
		case "binary": {
			const pair = `(${scalaTree(node.left)},${scalaTree(node.right)})`
			return node.op === "!=" ? `Not(Equal${pair})` : `${SCALA_BINARY[node.op]}${pair}`
		}
		case "call":
			return `FunctionInvocation(${node.callee},PositionalFunctionParameters(${list(node.args.map(scalaTree))}))`
		case "call-named":
			return `FunctionInvocation(${node.callee},NamedFunctionParameters(Map(${node.args
				.map((arg) => `${arg.name} -> ${scalaTree(arg.value)}`)
				.join(", ")})))`
		case "if":
			return `If(${scalaTree(node.condition)},${scalaTree(node.then)},${scalaTree(node.else)})`
		case "list":
			return `ConstList(${list(node.items.map(scalaTree))})`
		case "context":
			return `ConstContext(${list(node.entries.map((e) => `(${e.key},${scalaTree(e.value)})`))})`
		case "range":
			return `ConstRange(${scalaTree(node.low)},${scalaTree(node.high)})`
		case "for":
			return `For(${bound(node.bindings)},${scalaTree(node.body)})`
		case "some":
			return `SomeItem(${bound(node.bindings)},${scalaTree(node.satisfies)})`
		case "every":
			return `EveryItem(${bound(node.bindings)},${scalaTree(node.satisfies)})`
		case "filter":
			return `Filter(${scalaTree(node.base)},${scalaTree(node.condition)})`
		case "in-test":
			return `In(${scalaTree(node.value)},${scalaTree(node.test)})`
		case "instance-of":
			return `InstanceOf(${scalaTree(node.value)},${node.typeName})`
		default:
			return node.kind
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
