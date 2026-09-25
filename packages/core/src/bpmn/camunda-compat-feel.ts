/**
 * FEEL analysis for the Camunda-version compatibility rules that look inside
 * expressions — `feel-compatibility`, `unresolvable-secret-reference` and
 * `agent-fromai-contract`.
 *
 * `bpmnlint-plugin-camunda-compat` reads these from the lezer-feel syntax
 * tree (through `@bpmn-io/feel-analyzer` for built-in calls). This module
 * answers the same questions from `@bpmnkit/feel`'s AST, and names nodes by
 * their lezer-feel type where a plugin message quotes one.
 *
 * @packageDocumentation
 */

import { type FeelNode, parseExpression } from "@bpmnkit/feel"

/** Direct sub-expressions of a node, in source order. */
function feelChildren(node: FeelNode): FeelNode[] {
	switch (node.kind) {
		case "list":
			return node.items
		case "context":
			return node.entries.map((e) => e.value)
		case "range":
			return [node.low, node.high]
		case "unary-minus":
			return [node.operand]
		case "binary":
			return [node.left, node.right]
		case "path":
			return [node.base]
		case "filter":
			return [node.base, node.condition]
		case "call":
			return node.args
		case "call-expr":
			return [node.target, ...node.args]
		case "call-named":
			return node.args.map((a) => a.value)
		case "if":
			return [node.condition, node.then, node.else]
		case "for":
			return [...node.bindings.map((b) => b.domain), node.body]
		case "some":
		case "every":
			return [...node.bindings.map((b) => b.domain), node.satisfies]
		case "between":
			return [node.value, node.low, node.high]
		case "in-test":
			return [node.value, node.test]
		case "instance-of":
			return [node.value]
		case "function-def":
			return [node.body]
		case "unary-test-list":
		case "unary-not":
			return node.tests
		default:
			return []
	}
}

/** Index of the `)` closing the `(` at `open`, skipping string literals and backtick names. */
function closingParen(src: string, open: number): number {
	let depth = 0
	for (let i = open; i < src.length; i++) {
		const c = src[i]
		if (c === '"' || c === "`") {
			const quote = c
			for (i++; i < src.length && src[i] !== quote; i++) if (src[i] === "\\") i++
		} else if (c === "(") {
			depth++
		} else if (c === ")") {
			depth--
			if (depth === 0) return i
		}
	}
	return -1
}

/**
 * Whether `node` is written in parentheses of its own. `@bpmnkit/feel` drops
 * them, where lezer-feel keeps a `ParenthesizedExpression` node. `floor` is
 * the index of a `(` that belongs to something else, a call's argument list.
 */
function parenthesized(src: string, node: FeelNode, floor = -1): boolean {
	let before = node.start - 1
	while (before >= 0 && /\s/.test(src[before] as string)) before--
	if (before <= floor || src[before] !== "(") return false
	let after = node.end
	while (after < src.length && /\s/.test(src[after] as string)) after++
	return closingParen(src, before) === after
}

function parse(expression: string): { ast: FeelNode | null; valid: boolean } {
	const { ast, errors } = parseExpression(expression)
	return { ast, valid: errors.length === 0 && ast !== null }
}

// ---------------------------------------------------------------------------
// feel-compatibility
// ---------------------------------------------------------------------------

/**
 * The built-in functions an expression calls, as `@bpmn-io/feel-analyzer`
 * reports them to the plugin: a call counts as a built-in call only when the
 * name is not bound by a context entry, function parameter or iteration
 * variable around it — and a name called both ways counts as a user function.
 *
 * @param expression - FEEL without the leading `=`.
 * @param builtins - The names to look for.
 * @returns The built-ins called, sorted as the analyzer sorts them; `undefined`
 *   when the expression does not parse, which the `feel` rule reports.
 */
export function feelBuiltinCalls(
	expression: string,
	builtins: ReadonlySet<string>,
): string[] | undefined {
	const { ast, valid } = parse(expression)
	if (!valid || ast === null) return undefined

	const types = new Map<string, "builtin" | "user">()
	const scopes: Set<string>[] = []
	const record = (name: string) => {
		const type = builtins.has(name) && !scopes.some((scope) => scope.has(name)) ? "builtin" : "user"
		if (!types.has(name) || type === "user") types.set(name, type)
	}
	const walk = (node: FeelNode): void => {
		switch (node.kind) {
			case "context": {
				const scope = new Set<string>()
				scopes.push(scope)
				for (const entry of node.entries) {
					walk(entry.value)
					scope.add(entry.key)
				}
				scopes.pop()
				return
			}
			case "function-def":
				scopes.push(new Set(node.params))
				walk(node.body)
				scopes.pop()
				return
			case "for":
			case "some":
			case "every":
				for (const binding of node.bindings) walk(binding.domain)
				scopes.push(new Set(node.bindings.map((b) => b.name)))
				walk(node.kind === "for" ? node.body : node.satisfies)
				scopes.pop()
				return
			case "call":
			case "call-named":
				record(node.callee)
				break
		}
		for (const child of feelChildren(node)) walk(child)
	}
	walk(ast)
	return [...types]
		.filter(([, type]) => type === "builtin")
		.map(([name]) => name)
		.sort((a, b) => a.localeCompare(b))
}

// ---------------------------------------------------------------------------
// unresolvable-secret-reference
// ---------------------------------------------------------------------------

/** `camunda.secrets.<name>` anywhere in a string — the plugin's text check. */
export const SECRET_REFERENCE_LITERAL = /camunda\.secrets\.[\w-]+/

/** How a `camunda.secrets.<name>` reference is written in a way the engine rejects. */
export interface SecretReferenceViolations {
	/** Inside a string literal, where it is inert text. */
	stringLiteral: boolean
	/** Inside a list. */
	insideList: boolean
	/** Inside a context returned by an `if` branch. */
	insideIfBranchContext: boolean
}

/** Exactly `camunda.secrets.<name>`: not a longer path, and not the base of one. */
function isSecretReference(node: FeelNode, isPathBase: boolean): boolean {
	return (
		!isPathBase &&
		node.kind === "path" &&
		node.base.kind === "path" &&
		node.base.key === "secrets" &&
		node.base.base.kind === "name" &&
		node.base.base.name === "camunda"
	)
}

function containsSecretReference(node: FeelNode, isPathBase = false): boolean {
	if (isSecretReference(node, isPathBase)) return true
	return feelChildren(node).some((child) =>
		containsSecretReference(child, node.kind === "path" && child === node.base),
	)
}

/**
 * Finds the ways a FEEL expression writes a `camunda.secrets.<name>`
 * reference that Camunda rejects at deployment, as the plugin's
 * `findSecretReferenceViolations` does: in a string literal, or — looking down
 * from the top through context entries and `if` branches only — inside a list
 * or inside a context an `if` branch returns.
 *
 * @param expression - FEEL without the leading `=`.
 */
export function secretReferenceViolations(expression: string): SecretReferenceViolations {
	const violations = { stringLiteral: false, insideList: false, insideIfBranchContext: false }
	const { ast, valid } = parse(expression)
	if (!valid || ast === null) return violations

	const visit = (node: FeelNode): void => {
		if (node.kind === "string") {
			const content = expression.slice(node.start + 1, node.end - 1)
			if (SECRET_REFERENCE_LITERAL.test(content)) violations.stringLiteral = true
		}
		for (const child of feelChildren(node)) visit(child)
	}
	visit(ast)

	const containerKind = (node: FeelNode): "list" | "context" | undefined => {
		if (parenthesized(expression, node)) return undefined
		if (node.kind === "list") return containsSecretReference(node) ? "list" : undefined
		if (node.kind === "context") return containsSecretReference(node) ? "context" : undefined
		if (node.kind === "if") return containerKind(node.then) ?? containerKind(node.else)
		return undefined
	}
	const referenceKind = (node: FeelNode): "list" | "context" | undefined => {
		if (node.kind === "context" && !parenthesized(expression, node)) {
			for (const entry of node.entries) {
				const kind = referenceKind(entry.value)
				if (kind !== undefined) return kind
			}
			return undefined
		}
		return containerKind(node)
	}
	const kind = referenceKind(ast)
	if (kind === "list") violations.insideList = true
	else if (kind === "context") violations.insideIfBranchContext = true
	return violations
}

// ---------------------------------------------------------------------------
// agent-fromai-contract
// ---------------------------------------------------------------------------

/** A `fromAi()` argument: its lezer-feel node type and its source text. */
export interface FromAiArgument {
	type: string
	text: string
}

/** One `fromAi()` call (in any casing) and its arguments. */
export interface FromAiCall {
	/** The function name as written. */
	name: string
	/**
	 * Arguments by the engine's parameter slots — `value`, `description`,
	 * `type`, `schema`, `options`. A named call fills only the slots it names.
	 */
	args: (FromAiArgument | undefined)[]
}

/** `fromAi()`'s parameters, in the engine's order. */
const FROM_AI_PARAMETERS = ["value", "description", "type", "schema", "options"]

const ARITHMETIC = new Set(["+", "-", "*", "/", "**"])
const TEMPORAL_CONSTRUCTORS = new Set(["date", "time", "date and time", "duration"])

/** The lezer-feel node type an expression parses to there. */
function lezerType(node: FeelNode): string {
	switch (node.kind) {
		case "number":
			return "NumericLiteral"
		case "unary-minus":
			return node.operand.kind === "number" ? "NumericLiteral" : "ArithmeticExpression"
		case "string":
			return "StringLiteral"
		case "boolean":
			return "BooleanLiteral"
		case "null":
			return "null"
		case "temporal":
			return "DateTimeLiteral"
		case "name":
			return "VariableName"
		case "path":
			return "PathExpression"
		case "filter":
			return "FilterExpression"
		case "call":
		case "call-named":
			return TEMPORAL_CONSTRUCTORS.has(node.callee) ? "DateTimeLiteral" : "FunctionInvocation"
		case "call-expr":
			return "FunctionInvocation"
		case "list":
			return "List"
		case "context":
			return "Context"
		case "range":
			return "SimplePositiveUnaryTest"
		case "binary":
			if (ARITHMETIC.has(node.op)) return "ArithmeticExpression"
			if (node.op === "and") return "Conjunction"
			if (node.op === "or") return "Disjunction"
			return "Comparison"
		case "between":
		case "in-test":
			return "Comparison"
		case "instance-of":
			return "InstanceOfExpression"
		case "if":
			return "IfExpression"
		case "for":
			return "ForExpression"
		case "some":
		case "every":
			return "QuantifiedExpression"
		case "function-def":
			return "FunctionDefinition"
		default:
			return node.kind
	}
}

/**
 * The `fromAi()` calls in an expression, in any casing, outermost first — the
 * plugin's `findFunctionInvocations` and `getArgs`.
 *
 * @param expression - FEEL without the leading `=`, trimmed.
 */
export function fromAiCalls(expression: string): FromAiCall[] {
	const { ast } = parseExpression(expression)
	if (ast === null) return []
	const argument = (node: FeelNode, floor = -1): FromAiArgument => ({
		type: parenthesized(expression, node, floor) ? "ParenthesizedExpression" : lezerType(node),
		text: expression.slice(node.start, node.end),
	})
	const calls: FromAiCall[] = []
	const visit = (node: FeelNode): void => {
		if ((node.kind === "call" || node.kind === "call-named") && /^fromai$/i.test(node.callee)) {
			const open = expression.indexOf("(", node.start)
			const args: (FromAiArgument | undefined)[] = []
			if (node.kind === "call") {
				for (const arg of node.args) args.push(argument(arg, open))
			} else {
				for (const { name, value } of node.args) {
					const index = FROM_AI_PARAMETERS.indexOf(name)
					if (index !== -1) args[index] = argument(value)
				}
			}
			calls.push({ name: node.callee, args })
		}
		for (const child of feelChildren(node)) visit(child)
	}
	visit(ast)
	return calls
}
