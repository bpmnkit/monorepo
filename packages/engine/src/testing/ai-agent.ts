import type { AdHocSubProcessElement } from "../ad-hoc.js"
import type { Job } from "../types.js"
import type { TestJob } from "./process-test.js"

// ── Turns and cassettes ───────────────────────────────────────────────────────

/** One tool the model asks for: an element id of the ad-hoc sub-process and its `fromAi()` arguments. */
export interface AgentToolCall {
	/** The call id the model gave it — `toolCall._meta.id`. Generated when left out. */
	readonly id?: string
	/** The tool's element id — `toolCall._meta.name`. */
	readonly name: string
	/** The values the tool's `fromAi(toolCall.<name>)` mappings read. */
	readonly arguments?: Readonly<Record<string, unknown>>
}

/** A model reply that calls tools. The agent calls the model again once every tool has a result. */
export interface AgentToolCallsTurn {
	readonly toolCalls: readonly AgentToolCall[]
}

/** The model's final reply, which ends the agent — `agent.responseText` / `agent.responseJson`. */
export interface AgentResponseTurn {
	readonly responseText?: string
	readonly responseJson?: unknown
}

/** What the model replies on one call. */
export type AgentTurn = AgentToolCallsTurn | AgentResponseTurn

/** The cassette format this release reads and writes. */
export const AGENT_CASSETTE_VERSION = 1

/**
 * A recorded agent transcript: the model's replies, in order, for one AI
 * agent element. Store it as JSON with {@link writeAgentCassette} and replay it
 * with {@link ProcessTest.mockAiAgent}.
 */
export interface AgentCassette {
	readonly version: typeof AGENT_CASSETTE_VERSION
	/** The AI agent element it was recorded for. Replaying it for another element throws. */
	readonly agent?: string
	readonly turns: readonly AgentTurn[]
}

// ── What a mock sees ──────────────────────────────────────────────────────────

/** One entry of the agent's `outputCollection` — `{ id, name, content }` with the default `outputElement`. */
export interface AgentToolCallResult {
	readonly id?: string
	readonly name?: string
	readonly content?: unknown
	readonly [key: string]: unknown
}

/** A model call the agent makes — what a handler decides the next turn from. */
export interface AgentRequest {
	readonly elementId: string
	/** 1 for the first model call of this agent run, then 2, 3, … */
	readonly modelCall: number
	/** Results of the previous turn's tool calls, in call order. Empty on the first call. */
	readonly toolCallResults: readonly AgentToolCallResult[]
	/** The tools on offer — the ad-hoc sub-process's `adHocSubProcessElements`. */
	readonly tools: readonly AdHocSubProcessElement[]
	/** The variables the agent's job sees. */
	readonly variables: Readonly<Record<string, unknown>>
}

/** Decides each turn in code — a live model adapter of your own, or a fake. */
export type AgentHandler = (request: AgentRequest) => AgentTurn | Promise<AgentTurn>

/** A script of turns, a cassette, or a handler. */
export type AiAgentMock = readonly AgentTurn[] | AgentCassette | AgentHandler

/** A tool call the mock made the agent issue. */
export interface AgentToolCallRecord {
	readonly modelCall: number
	readonly id: string
	readonly name: string
	readonly arguments: Readonly<Record<string, unknown>>
}

/** Returned by {@link ProcessTest.mockAiAgent}. */
export interface AiAgentMockHandle {
	readonly elementId: string
	/** Every model call, oldest first. */
	readonly requests: readonly AgentRequest[]
	/** Every tool call issued, in order. */
	readonly toolCalls: readonly AgentToolCallRecord[]
	/** Script or cassette turns not played yet; always 0 for a handler. */
	readonly remainingTurns: number
	/** The turns played so far, with generated call ids filled in — save it with {@link writeAgentCassette}. */
	cassette(): AgentCassette
	/** Remove the mock — later jobs of this agent fail with a "no mock" error. */
	restore(): void
}

// ── Validation ────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

class CassetteError extends Error {}

function check(condition: boolean, where: string, message: string): asserts condition {
	if (!condition) throw new CassetteError(`${where} ${message}`)
}

function checkKeys(
	value: Record<string, unknown>,
	allowed: readonly string[],
	where: string,
): void {
	const extra = Object.keys(value).filter((k) => !allowed.includes(k))
	check(
		extra.length === 0,
		where,
		`has unknown ${extra.length === 1 ? "field" : "fields"} ${extra.map((k) => `"${k}"`).join(", ")} (allowed: ${allowed.join(", ")})`,
	)
}

/** Check one turn's shape; throws a {@link CassetteError} naming the offending path. */
function validateTurn(turn: unknown, where: string): AgentTurn {
	check(isRecord(turn), where, "must be an object")
	if ("toolCalls" in turn) {
		checkKeys(turn, ["toolCalls"], where)
		const calls = turn.toolCalls
		check(
			Array.isArray(calls) && calls.length > 0,
			`${where}.toolCalls`,
			"must be a non-empty array — end the agent with a { responseText } or { responseJson } turn instead",
		)
		const ids = new Set<string>()
		calls.forEach((call: unknown, i) => {
			const at = `${where}.toolCalls[${i}]`
			check(isRecord(call), at, "must be an object")
			checkKeys(call, ["id", "name", "arguments"], at)
			check(
				typeof call.name === "string" && call.name !== "",
				`${at}.name`,
				"must be a non-empty string",
			)
			if (call.id !== undefined) {
				check(
					typeof call.id === "string" && call.id !== "",
					`${at}.id`,
					"must be a non-empty string",
				)
				check(!ids.has(call.id), `${at}.id`, `repeats "${call.id}"`)
				ids.add(call.id)
			}
			check(
				call.arguments === undefined || isRecord(call.arguments),
				`${at}.arguments`,
				"must be an object",
			)
		})
		return turn as unknown as AgentToolCallsTurn
	}
	checkKeys(turn, ["responseText", "responseJson"], where)
	check(
		"responseText" in turn || "responseJson" in turn,
		where,
		"must have toolCalls, or responseText and/or responseJson",
	)
	check(
		turn.responseText === undefined || typeof turn.responseText === "string",
		`${where}.responseText`,
		"must be a string",
	)
	return turn as AgentResponseTurn
}

/**
 * Check that a value — parsed JSON, or JSON text — is an {@link AgentCassette},
 * and return it. Throws an error naming the first thing wrong and where.
 */
export function parseAgentCassette(value: unknown, source = "agent cassette"): AgentCassette {
	try {
		const data: unknown = typeof value === "string" ? JSON.parse(value) : value
		check(isRecord(data), "The cassette", "must be a JSON object")
		checkKeys(data, ["version", "agent", "turns"], "The cassette")
		check(
			data.version === AGENT_CASSETTE_VERSION,
			"version",
			`must be ${AGENT_CASSETTE_VERSION}, got ${JSON.stringify(data.version)}`,
		)
		check(
			data.agent === undefined || (typeof data.agent === "string" && data.agent !== ""),
			"agent",
			"must be a non-empty string",
		)
		check(Array.isArray(data.turns), "turns", "must be an array")
		const turns = data.turns.map((turn: unknown, i) => validateTurn(turn, `turns[${i}]`))
		return data.agent === undefined
			? { version: AGENT_CASSETTE_VERSION, turns }
			: { version: AGENT_CASSETTE_VERSION, agent: data.agent, turns }
	} catch (err) {
		if (err instanceof CassetteError || err instanceof SyntaxError) {
			throw new Error(`Invalid ${source}: ${err.message}`)
		}
		throw err
	}
}

/** Read and validate a cassette file (Node.js only). */
export async function readAgentCassette(path: string | URL): Promise<AgentCassette> {
	const { readFile } = await import("node:fs/promises")
	return parseAgentCassette(await readFile(path, "utf8"), `agent cassette ${String(path)}`)
}

/** Validate a cassette and write it as formatted JSON (Node.js only). */
export async function writeAgentCassette(
	path: string | URL,
	cassette: AgentCassette,
): Promise<void> {
	const valid = parseAgentCassette(cassette)
	const { writeFile } = await import("node:fs/promises")
	await writeFile(path, `${JSON.stringify(valid, null, "\t")}\n`)
}

// ── The mock ──────────────────────────────────────────────────────────────────

/** One run of the agent element: the model calls so far and the tool calls awaiting results. */
interface AgentActivation {
	modelCalls: number
	pending: readonly AgentToolCallRecord[]
	/** How many entries of the output collection earlier turns already consumed. */
	consumed: number
}

function isToolCallsTurn(turn: AgentTurn): turn is AgentToolCallsTurn {
	return "toolCalls" in turn
}

/** The `data.limits.maxModelCalls` input of the AI Agent connector, if set. */
function maxModelCalls(variables: Readonly<Record<string, unknown>>): number | undefined {
	const data = variables.data
	const nested = isRecord(data) && isRecord(data.limits) ? data.limits.maxModelCalls : undefined
	const raw = variables["data.limits.maxModelCalls"] ?? nested
	const max = Number(raw)
	return raw === undefined || raw === null || !Number.isFinite(max) ? undefined : max
}

/**
 * Plays the AI Agent connector for one ad-hoc sub-process: on each job it asks
 * the script (or handler) for the model's next turn, activates the tools that
 * turn calls with a `toolCall` variable, and ends with the `agent` response.
 */
export class AiAgentMockState implements AiAgentMockHandle {
	readonly requests: AgentRequest[] = []
	readonly toolCalls: AgentToolCallRecord[] = []
	private readonly played: AgentTurn[] = []
	private readonly script: readonly AgentTurn[] | undefined
	private readonly handler: AgentHandler | undefined
	private readonly source: string
	private next = 0
	private readonly activations = new Map<string, AgentActivation>()

	constructor(
		readonly elementId: string,
		/** The element's `zeebe:adHoc outputCollection` — where tool results arrive. */
		private readonly outputCollection: string,
		mock: AiAgentMock,
		private readonly onRestore: () => void,
	) {
		if (typeof mock === "function") {
			this.handler = mock as AgentHandler
			this.source = "handler"
		} else if (Array.isArray(mock)) {
			this.script = parseAgentCassette(
				{ version: AGENT_CASSETTE_VERSION, turns: mock },
				"agent script",
			).turns
			this.source = "script"
		} else {
			const cassette = parseAgentCassette(mock)
			if (cassette.agent !== undefined && cassette.agent !== elementId) {
				throw new Error(
					`mockAiAgent("${elementId}"): the cassette was recorded for AI agent "${cassette.agent}"`,
				)
			}
			this.script = cassette.turns
			this.source = "cassette"
		}
	}

	get remainingTurns(): number {
		return this.script === undefined ? 0 : this.script.length - this.next
	}

	cassette(): AgentCassette {
		return { version: AGENT_CASSETTE_VERSION, agent: this.elementId, turns: [...this.played] }
	}

	restore(): void {
		this.onRestore()
	}

	/** Handle one job of the agent element; `key` tells runs of the element apart. */
	async handle(job: Job, testJob: TestJob, key: string): Promise<void> {
		const variables = testJob.variables
		const activation = this.activations.get(key) ?? { modelCalls: 0, pending: [], consumed: 0 }
		this.activations.set(key, activation)

		const collection = variables[this.outputCollection]
		const fresh = (Array.isArray(collection) ? collection : []).slice(activation.consumed)
		if (fresh.length < activation.pending.length) {
			// Like the connector: wait until every tool of the turn has answered.
			job.complete({}, { type: "adHocSubProcess" })
			return
		}
		activation.consumed += fresh.length
		const toolCallResults = orderByCall(fresh, activation.pending)

		const modelCall = ++activation.modelCalls
		const max = maxModelCalls(variables)
		if (max !== undefined && modelCall > max) {
			this.activations.delete(key)
			throw new Error(
				`AI agent "${this.elementId}" reached its limit of ${max} model calls (data.limits.maxModelCalls)`,
			)
		}
		const rawTools = variables.adHocSubProcessElements
		const tools = (Array.isArray(rawTools) ? rawTools : []) as AdHocSubProcessElement[]
		const request: AgentRequest = {
			elementId: this.elementId,
			modelCall,
			toolCallResults,
			tools,
			variables,
		}
		this.requests.push(request)

		const turn = await this.nextTurn(request)
		if (!isToolCallsTurn(turn)) {
			this.activations.delete(key)
			this.played.push(turn)
			const response: Record<string, unknown> = {}
			if (turn.responseText !== undefined) response.responseText = turn.responseText
			else if (turn.responseJson !== undefined)
				response.responseText = JSON.stringify(turn.responseJson)
			if (turn.responseJson !== undefined) response.responseJson = turn.responseJson
			response.context = { state: "READY", metrics: { modelCalls: modelCall } }
			job.complete(
				{ agent: response },
				{ type: "adHocSubProcess", isCompletionConditionFulfilled: true },
			)
			return
		}

		const calls = turn.toolCalls.map((call, i): AgentToolCallRecord => {
			const record = {
				modelCall,
				id: call.id ?? `call_${modelCall}_${i + 1}`,
				name: call.name,
				arguments: { ...call.arguments },
			}
			this.checkCall(record, tools, i)
			return record
		})
		activation.pending = calls
		this.toolCalls.push(...calls)
		this.played.push({
			toolCalls: calls.map(({ id, name, arguments: args }) =>
				Object.keys(args).length > 0 ? { id, name, arguments: args } : { id, name },
			),
		})
		job.complete(
			{},
			{
				type: "adHocSubProcess",
				activateElements: calls.map((call) => ({
					elementId: call.name,
					variables: { toolCall: { ...call.arguments, _meta: { id: call.id, name: call.name } } },
				})),
			},
		)
	}

	private async nextTurn(request: AgentRequest): Promise<AgentTurn> {
		const where = `AI agent "${this.elementId}", model call ${request.modelCall}`
		if (this.handler !== undefined) {
			const turn = await this.handler(request)
			try {
				return validateTurn(turn, "the turn")
			} catch (err) {
				throw new Error(
					`${where}: the handler returned an invalid turn — ${(err as Error).message}`,
				)
			}
		}
		const script = this.script ?? []
		const turn = script[this.next]
		if (turn === undefined) {
			const results = request.toolCallResults.map((r) => r.name ?? r.id ?? "?").join(", ")
			const withResults = results !== "" ? ` with results from ${results}` : ""
			throw new Error(
				`${where}: the ${this.source} has no turn ${this.next + 1} — it has ${script.length}, all played. The agent asked the model again${withResults}. Add a turn, or re-record the cassette.`,
			)
		}
		this.next++
		return turn
	}

	private checkCall(
		call: AgentToolCallRecord,
		tools: readonly AdHocSubProcessElement[],
		index: number,
	): void {
		const where = `AI agent "${this.elementId}", model call ${call.modelCall}, tool call ${index + 1}`
		const tool = tools.find((t) => t.elementId === call.name)
		if (tool === undefined) {
			throw new Error(
				`${where}: unknown tool "${call.name}". Tools of "${this.elementId}": ${tools.map((t) => t.elementId).join(", ") || "(none)"}`,
			)
		}
		const names = tool.parameters.map((p) => p.name)
		const unknown = Object.keys(call.arguments).filter((a) => !names.includes(a))
		if (unknown.length > 0) {
			throw new Error(
				`${where}: tool "${call.name}" has no parameter ${unknown.map((a) => `"${a}"`).join(", ")}. Its fromAi() parameters: ${names.join(", ") || "(none)"}`,
			)
		}
		const missing = tool.parameters
			.filter((p) => p.options?.required !== false && !(p.name in call.arguments))
			.map((p) => p.name)
		if (missing.length > 0) {
			throw new Error(
				`${where}: tool "${call.name}" needs ${missing.map((a) => `"${a}"`).join(", ")}, which the call does not give`,
			)
		}
	}
}

/** Put results in the order of the calls they answer when each carries its call's `id`. */
function orderByCall(
	results: readonly unknown[],
	calls: readonly AgentToolCallRecord[],
): AgentToolCallResult[] {
	const entries = results.map((r) => (isRecord(r) ? r : { content: r })) as AgentToolCallResult[]
	const rank = new Map(calls.map((c, i) => [c.id, i]))
	if (!entries.every((e) => typeof e.id === "string" && rank.has(e.id))) return entries
	return [...entries].sort(
		(a, b) => (rank.get(a.id as string) ?? 0) - (rank.get(b.id as string) ?? 0),
	)
}
