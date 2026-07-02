import type { CompactDiagram, CompactElement, CompactFlow } from "@bpmnkit/core"

const TAG_TO_TYPE: Record<string, string> = {
	start: "startEvent",
	end: "endEvent",
	task: "task",
	service: "serviceTask",
	user: "userTask",
	script: "scriptTask",
	rule: "businessRuleTask",
	send: "sendTask",
	receive: "receiveTask",
	call: "callActivity",
	xgw: "exclusiveGateway",
	pgw: "parallelGateway",
	igw: "inclusiveGateway",
	egw: "eventBasedGateway",
	boundary: "boundaryEvent",
	throw: "intermediateThrowEvent",
	catch: "intermediateCatchEvent",
	sub: "subProcess",
	adhoc: "adHocSubProcess",
	eventsub: "eventSubProcess",
}

const CONTAINER_TAGS = new Set(["sub", "adhoc", "eventsub"])

/**
 * Splits a line into whitespace-separated tokens, treating a "..." span
 * (with \"-escaped inner quotes) as one token even if it contains spaces —
 * this is what lets `if="=tier = \"low\""` parse as a single field token.
 */
function tokenizeLine(line: string): string[] {
	const tokens: string[] = []
	let i = 0
	while (i < line.length) {
		while (i < line.length && line[i] === " ") i++
		if (i >= line.length) break
		const start = i
		let inQuotes = false
		while (i < line.length) {
			const ch = line[i]
			if (ch === '"' && line[i - 1] !== "\\") {
				inQuotes = !inQuotes
			}
			if (ch === " " && !inQuotes) break
			i++
		}
		tokens.push(line.slice(start, i))
	}
	return tokens
}

/** Strips surrounding double quotes and un-escapes \" to " — a no-op for an unquoted value. */
function unquote(value: string): string {
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		return value.slice(1, -1).replaceAll('\\"', '"')
	}
	return value
}

/** Number of leading 2-space indent levels; throws if not a multiple of 2. */
function countIndent(rawLine: string, lineNo: number): number {
	const match = rawLine.match(/^( *)/)
	const spaces = match ? match[1].length : 0
	if (spaces % 2 !== 0) {
		throw new Error(`line ${lineNo}: indentation must be a multiple of 2 spaces`)
	}
	return spaces / 2
}

function parseElementLine(tag: string, tokens: string[], lineNo: number): CompactElement {
	const type = TAG_TO_TYPE[tag]
	if (!type) throw new Error(`line ${lineNo}: unknown tag "${tag}"`)

	const id = tokens[1]
	if (!id) throw new Error(`line ${lineNo}: element missing id`)

	let fieldStart = 2
	const nameToken = tokens[2]
	const element: CompactElement = { id, type: type as CompactElement["type"] }
	if (nameToken?.startsWith('"')) {
		element.name = unquote(nameToken)
		fieldStart = 3
	}

	const headers: Record<string, string> = {}
	let hasHeaders = false

	for (let i = fieldStart; i < tokens.length; i++) {
		const token = tokens[i]
		if (token === "noninterrupt") {
			element.interrupting = false
			continue
		}
		const eq = token.indexOf("=")
		if (eq === -1) throw new Error(`line ${lineNo}: unrecognized token "${token}"`)
		const key = token.slice(0, eq)
		const value = unquote(token.slice(eq + 1))

		if (key.startsWith("h.")) {
			headers[key.slice(2)] = value
			hasHeaders = true
		} else if (key === "job") element.jobType = value
		else if (key === "call") element.calledProcess = value
		else if (key === "form") element.formId = value
		else if (key === "decision") element.decisionId = value
		else if (key === "result") element.resultVariable = value
		else if (key === "event") element.eventType = value
		else if (key === "at") element.attachedTo = value
		else throw new Error(`line ${lineNo}: unknown field "${key}"`)
	}

	if (hasHeaders) element.taskHeaders = headers
	return element
}

function parseFlowLine(tokens: string[], lineNo: number, nextFlowId: () => string): CompactFlow {
	const from = tokens[0]
	const to = tokens[2]
	if (!from || !to) throw new Error(`line ${lineNo}: flow missing from/to`)

	const flow: CompactFlow = { id: nextFlowId(), from, to }

	let i = 3
	const nameToken = tokens[3]
	if (nameToken?.startsWith('"')) {
		flow.name = unquote(nameToken)
		i = 4
	}
	for (; i < tokens.length; i++) {
		const token = tokens[i]
		const eq = token.indexOf("=")
		if (eq === -1) throw new Error(`line ${lineNo}: unrecognized token "${token}"`)
		const key = token.slice(0, eq)
		const value = unquote(token.slice(eq + 1))
		if (key === "if") flow.condition = value
		else throw new Error(`line ${lineNo}: unknown flow field "${key}"`)
	}
	return flow
}

interface Frame {
	containerIndent: number
	elements: CompactElement[]
	flows: CompactFlow[]
}

/**
 * Parses the compact notation DSL into the same CompactDiagram shape
 * @bpmnkit/core's own compactify() produces. See the "Compact Notation"
 * section of the with-sdk-compact system prompt for the grammar.
 */
export function parseCompactDsl(text: string): CompactDiagram {
	let flowIdCounter = 0
	const nextFlowId = () => `Flow_compact_${++flowIdCounter}`

	let processId: string | null = null
	let processName: string | undefined

	const rootElements: CompactElement[] = []
	const rootFlows: CompactFlow[] = []
	const stack: Frame[] = [{ containerIndent: -1, elements: rootElements, flows: rootFlows }]

	const lines = text.split("\n")
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i]
		const lineNo = i + 1
		if (raw.trim() === "") continue

		const indent = countIndent(raw, lineNo)
		const tokens = tokenizeLine(raw.trim())
		if (tokens.length === 0) continue

		while (stack.length > 1 && indent <= stack[stack.length - 1].containerIndent) {
			stack.pop()
		}
		const frame = stack[stack.length - 1]

		if (tokens[1] === "->") {
			frame.flows.push(parseFlowLine(tokens, lineNo, nextFlowId))
			continue
		}

		if (tokens[0] === "process") {
			processId = tokens[1]
			processName = tokens[2] ? unquote(tokens[2]) : undefined
			continue
		}

		const element = parseElementLine(tokens[0], tokens, lineNo)
		frame.elements.push(element)

		if (CONTAINER_TAGS.has(tokens[0])) {
			element.children = { elements: [], flows: [] }
			stack.push({
				containerIndent: indent,
				elements: element.children.elements,
				flows: element.children.flows,
			})
		}
	}

	if (processId === null) {
		throw new Error('missing "process" line')
	}

	return {
		id: "Definitions_1",
		processes: [{ id: processId, name: processName, elements: rootElements, flows: rootFlows }],
	}
}
