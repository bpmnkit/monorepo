import type { FeelNode } from "./ast.js"

export interface FormatOptions {
	indent?: string
	maxLineLength?: number
}

const DEFAULTS: Required<FormatOptions> = {
	indent: "  ",
	maxLineLength: 80,
}

export function formatFeel(node: FeelNode, opts?: FormatOptions): string {
	const o: Required<FormatOptions> = { ...DEFAULTS, ...opts }
	return fmt(node, o, 0)
}

function fmt(node: FeelNode, o: Required<FormatOptions>, depth: number): string {
	const ind = o.indent.repeat(depth)
	const ind1 = o.indent.repeat(depth + 1)

	switch (node.kind) {
		case "null":
			return "null"
		case "boolean":
			return String(node.value)
		case "number":
			return String(node.value)
		case "string":
			return `"${node.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
		case "temporal":
			return node.raw
		case "name":
			return node.name

		case "unary-minus":
			return `-${fmt(node.operand, o, depth)}`

		case "binary": {
			const l = fmt(node.left, o, depth)
			const r = fmt(node.right, o, depth)
			return `${l} ${node.op} ${r}`
		}

		case "path":
			return `${fmt(node.base, o, depth)}.${node.key}`

		case "filter":
			return `${fmt(node.base, o, depth)}[${fmt(node.condition, o, depth)}]`

		case "range": {
			const s = fmt(node.low, o, depth)
			const e = fmt(node.high, o, depth)
			const open = node.startIncluded ? "[" : "("
			const close = node.endIncluded ? "]" : ")"
			return `${open}${s}..${e}${close}`
		}

		case "list": {
			if (node.items.length === 0) return "[]"
			const inline = `[${node.items.map((i) => fmt(i, o, depth)).join(", ")}]`
			if (inline.length <= o.maxLineLength - depth * o.indent.length) return inline
			const items = node.items.map((i) => `${ind1}${fmt(i, o, depth + 1)}`).join(",\n")
			return `[\n${items}\n${ind}]`
		}

		case "context": {
			if (node.entries.length === 0) return "{}"
			const inline = `{${node.entries.map((e) => `${e.key}: ${fmt(e.value, o, depth)}`).join(", ")}}`
			if (inline.length <= o.maxLineLength - depth * o.indent.length) return inline
			const entries = node.entries
				.map((e) => `${ind1}${e.key}: ${fmt(e.value, o, depth + 1)}`)
				.join(",\n")
			return `{\n${entries}\n${ind}}`
		}

		case "call": {
			const args = node.args.map((a) => fmt(a, o, depth)).join(", ")
			return `${node.callee}(${args})`
		}

		case "call-named": {
			const args = node.args.map((a) => `${a.name}: ${fmt(a.value, o, depth)}`).join(", ")
			return `${node.callee}(${args})`
		}

		case "if": {
			const cond = fmt(node.condition, o, depth)
			const thn = fmt(node.then, o, depth)
			const els = fmt(node.else, o, depth)
			const inline = `if ${cond} then ${thn} else ${els}`
			if (inline.length <= o.maxLineLength - depth * o.indent.length) return inline
			return `if ${cond}\n${ind1}then ${thn}\n${ind1}else ${els}`
		}

		case "for": {
			const bindings = node.bindings
				.map((b) => `${b.name} in ${fmt(b.domain, o, depth)}`)
				.join(", ")
			const body = fmt(node.body, o, depth)
			const inline = `for ${bindings} return ${body}`
			if (inline.length <= o.maxLineLength - depth * o.indent.length) return inline
			return `for ${bindings}\n${ind1}return ${body}`
		}

		case "some":
		case "every": {
			const bindings = node.bindings
				.map((b) => `${b.name} in ${fmt(b.domain, o, depth)}`)
				.join(", ")
			const sat = fmt(node.satisfies, o, depth)
			const inline = `${node.kind} ${bindings} satisfies ${sat}`
			if (inline.length <= o.maxLineLength - depth * o.indent.length) return inline
			return `${node.kind} ${bindings}\n${ind1}satisfies ${sat}`
		}

		case "between":
			return `${fmt(node.value, o, depth)} between ${fmt(node.low, o, depth)} and ${fmt(node.high, o, depth)}`

		case "in-test":
			return `${fmt(node.value, o, depth)} in ${fmt(node.test, o, depth)}`

		case "instance-of":
			return `${fmt(node.value, o, depth)} instance of ${node.typeName}`

		case "function-def": {
			const params = node.params.join(", ")
			const body = fmt(node.body, o, depth)
			return `function(${params}) ${body}`
		}

		case "unary-test-list":
			return node.tests.map((t) => fmt(t, o, depth)).join(", ")

		case "unary-not":
			return `not(${node.tests.map((t) => fmt(t, o, depth)).join(", ")})`

		case "any-input":
			return "-"
	}
}
