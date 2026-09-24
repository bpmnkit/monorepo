import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import type {
	BpmnDefinitions,
	BpmnFlowElement,
	BpmnProcess,
	DmnDefinitions,
	FormDefinition,
} from "@bpmnkit/core"
import { evaluate, parseExpression } from "@bpmnkit/feel"
import type { FeelValue } from "@bpmnkit/feel"
import { Engine } from "../engine.js"
import type { ProcessInstance } from "../instance.js"
import type { Job, ProcessEvent } from "../types.js"
import { parseZeebeExt } from "../zeebe.js"
import { AiAgentMockState } from "./ai-agent.js"
import type { AiAgentMock, AiAgentMockHandle } from "./ai-agent.js"
import { VirtualClock, installClock, toMilliseconds, uninstallClock } from "./clock.js"
import { CoverageIndex } from "./coverage.js"
import type { CoverageReport } from "./coverage.js"
import type { RunSnapshot, RunState } from "./matchers.js"

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * A model to deploy: an already-parsed definition, its XML (or form JSON) text,
 * or a path / `file:` URL to read it from (Node.js only).
 */
export type ModelSource<T> = T | string | URL

/** Options for {@link createProcessTest}. */
export interface ProcessTestOptions {
	/** BPMN to deploy — every process in it can be started. */
	bpmn: ModelSource<BpmnDefinitions> | readonly ModelSource<BpmnDefinitions>[]
	/** DMN decisions called by business rule tasks. */
	dmn?: ModelSource<DmnDefinitions> | readonly ModelSource<DmnDefinitions>[]
	/** Camunda forms linked from user tasks. */
	forms?: ModelSource<FormDefinition> | readonly ModelSource<FormDefinition>[]
	/**
	 * Where the virtual clock starts. Defaults to the real time when the test is
	 * created; set it when a timer uses an absolute `timeDate`.
	 */
	startTime?: Date | string | number
}

/** A job as a mock or a test sees it. */
export interface TestJob {
	readonly id: string
	readonly type: string
	/** The element that created the job. */
	readonly elementId: string
	readonly processId: string
	readonly variables: Readonly<Record<string, unknown>>
	readonly headers: Readonly<Record<string, string>>
}

/** Returns the variables to complete the job with; throwing fails the job. */
export type JobMockHandler = (
	job: TestJob,
) => Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>

/** How a mocked job type behaves. */
export type JobMock =
	| { readonly result: Record<string, unknown> }
	| { readonly fail: string }
	| { readonly throwError: { readonly code: string; readonly message?: string } }
	| JobMockHandler

/**
 * How a mocked connector behaves. `response` is what the connector would have
 * returned; it is mapped into variables through the element's `resultVariable`
 * and `resultExpression` exactly as the connector runtime does.
 */
export type ConnectorMock =
	| { readonly response: unknown }
	| { readonly fail: string }
	| { readonly throwError: { readonly code: string; readonly message?: string } }
	| ((job: TestJob) => unknown)

/** Returned by {@link ProcessTest.mockJob} and {@link ProcessTest.mockConnector}. */
export interface JobMockHandle {
	/** Every job the mock handled, oldest first. */
	readonly calls: readonly TestJob[]
	/** Remove the mock — later jobs of this type wait for a manual `completeJob`. */
	restore(): void
}

/** One process instance started by {@link ProcessTest.start}. */
export interface ProcessRun extends RunSnapshot {
	readonly id: string
	/** Elements entered, in order (repeats included). */
	readonly enteredElements: readonly string[]
	/** Jobs waiting for {@link ProcessRun.completeJob} — job types without a mock. */
	readonly jobs: readonly TestJob[]
	/**
	 * Complete the waiting job of the element (or job type) `ref`, then let the
	 * process run until it waits again.
	 */
	completeJob(ref: string, variables?: Record<string, unknown>): Promise<void>
	/** Fail the waiting job of the element (or job type) `ref`. */
	failJob(ref: string, message: string): Promise<void>
	/** Throw a BPMN error from the waiting job of the element (or job type) `ref`. */
	throwError(ref: string, code: string, message?: string): Promise<void>
	/**
	 * Correlate a message, by its `name` (or the `bpmn:message` id), to this
	 * instance. Throws when nothing in the instance was waiting for it.
	 */
	publishMessage(name: string): Promise<void>
	/** Move the shared virtual clock forward — see {@link ProcessTest.advanceTime}. */
	advanceTime(duration: string | number): Promise<void>
	/** Terminate the instance. */
	cancel(): Promise<void>
}

// ── Scheduling ────────────────────────────────────────────────────────────────

/**
 * Captured at load so a test that installs fake timers (`vi.useFakeTimers()`)
 * cannot stall the helpers — they never need them.
 */
const realSetImmediate = (globalThis as { setImmediate?: (cb: () => void) => unknown }).setImmediate
const realSetTimeout = globalThis.setTimeout.bind(globalThis)

/** Resolve after every pending microtask — the engine's unit of progress — has run. */
function nextTick(): Promise<void> {
	return new Promise((resolve) => {
		if (realSetImmediate !== undefined) realSetImmediate(resolve)
		else realSetTimeout(resolve, 0)
	})
}

/** Ticks a settle may take while events keep coming before it gives up. */
const MAX_SETTLE_TICKS = 1_000

// ── Loading ───────────────────────────────────────────────────────────────────

function toList<T>(value: T | readonly T[] | undefined): readonly T[] {
	if (value === undefined) return []
	return Array.isArray(value) ? (value as readonly T[]) : [value as T]
}

async function readModel(source: string | URL, what: string): Promise<string> {
	if (typeof source === "string") {
		const head = source.trimStart()
		if (head.startsWith("<") || head.startsWith("{")) return source
	}
	const { readFile } = await import("node:fs/promises")
	try {
		return await readFile(source, "utf8")
	} catch (err) {
		throw new Error(
			`createProcessTest: could not read ${what} from ${String(source)} — pass the XML itself, an absolute path, or new URL("./file", import.meta.url). ${err instanceof Error ? err.message : String(err)}`,
		)
	}
}

async function load<T extends object>(
	sources: readonly ModelSource<T>[],
	what: string,
	parse: (text: string) => T,
): Promise<T[]> {
	const out: T[] = []
	for (const source of sources) {
		if (typeof source === "string" || source instanceof URL) {
			out.push(parse(await readModel(source, what)))
		} else {
			out.push(source)
		}
	}
	return out
}

function parseStartTime(start: ProcessTestOptions["startTime"]): number {
	if (start === undefined) return Date.now()
	const ms = start instanceof Date ? start.getTime() : new Date(start).getTime()
	if (Number.isNaN(ms))
		throw new RangeError(`createProcessTest: invalid startTime ${String(start)}`)
	return ms
}

/** Every job type an element of these processes can create, plus the engine's fallbacks. */
function jobTypes(processes: readonly BpmnProcess[]): Set<string> {
	// Without a zeebe:taskDefinition the engine uses the element type as the job type.
	const types = new Set<string>(["serviceTask", "userTask"])
	const walk = (elements: readonly BpmnFlowElement[]) => {
		for (const el of elements) {
			const type = parseZeebeExt(el.extensionElements).taskDefinition?.type
			if (type !== undefined) types.add(type)
			if ("flowElements" in el) walk(el.flowElements)
		}
	}
	for (const p of processes) walk(p.flowElements)
	return types
}

// ── Connector result mapping ─────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * Map a connector response into process variables the way the connector
 * runtime does: `resultVariable` receives the whole response, and
 * `resultExpression` is evaluated with the response's fields (and `response`
 * itself) in scope and must produce a context — or null, which maps nothing —
 * whose entries become variables.
 */
export function mapConnectorResponse(
	response: unknown,
	headers: Readonly<Record<string, string>>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	const resultVariable = headers.resultVariable?.trim()
	if (resultVariable) out[resultVariable] = response
	const resultExpression = headers.resultExpression?.trim()
	if (resultExpression) {
		const source = resultExpression.replace(/^=\s*/, "")
		const parsed = parseExpression(source)
		if (parsed.ast === null || parsed.errors.length > 0) {
			throw new Error(
				`resultExpression "${resultExpression}" does not parse: ${parsed.errors.map((e) => e.message).join("; ")}`,
			)
		}
		const scope = { response, ...(isRecord(response) ? response : {}) }
		const mapped = evaluate(parsed.ast, { vars: scope as Record<string, FeelValue> })
		// A null result (e.g. a path the response does not have) maps nothing rather than failing the job.
		if (mapped === null || mapped === undefined) return out
		if (!isRecord(mapped)) {
			throw new Error(
				`resultExpression "${resultExpression}" must produce a context, got ${JSON.stringify(mapped)}`,
			)
		}
		Object.assign(out, mapped)
	}
	return out
}

function connectorToJobMock(mock: ConnectorMock): JobMock {
	if (typeof mock === "function") {
		return async (job) => mapConnectorResponse(await mock(job), job.headers)
	}
	if ("response" in mock) {
		return (job) => mapConnectorResponse(mock.response, job.headers)
	}
	return mock
}

// ── ProcessTest ───────────────────────────────────────────────────────────────

interface MockEntry {
	readonly mock: JobMock
	readonly calls: TestJob[]
}

/** An ad-hoc sub-process run by a job worker — an AI agent {@link ProcessTest.mockAiAgent} can play. */
interface AgentElement {
	readonly jobType: string
	readonly outputCollection: string | undefined
}

/** Every ad-hoc sub-process with a `zeebe:taskDefinition`, by element id. */
function agentElements(processes: readonly BpmnProcess[]): Map<string, AgentElement> {
	const agents = new Map<string, AgentElement>()
	const walk = (elements: readonly BpmnFlowElement[]) => {
		for (const el of elements) {
			if (el.type === "adHocSubProcess") {
				const ext = parseZeebeExt(el.extensionElements)
				if (ext.taskDefinition !== undefined) {
					agents.set(el.id, {
						jobType: ext.taskDefinition.type,
						outputCollection: ext.adHoc?.outputCollection || undefined,
					})
				}
			}
			if ("flowElements" in el) walk(el.flowElements)
		}
	}
	for (const p of processes) walk(p.flowElements)
	return agents
}

/** What a run needs from its test, kept off the public {@link ProcessTest} surface. */
interface RunHost {
	/** Total engine events seen — how `settle` knows the engine is idle. */
	events: number
	readonly coveredElements: Set<string>
	readonly coveredFlows: Set<string>
	settle(): Promise<void>
	advanceTime(duration: string | number): Promise<void>
	messageRef(name: string): string
	recordJob(jobId: string, run: SimulatorRun, elementId: string): void
	flowsInto(elementId: string, lastLeft: ReadonlyMap<string, number>): string[]
	isMocked(type: string): boolean
}

/**
 * A deployed set of models plus mocks, a virtual clock and coverage — the
 * fixture one test file works against. Create it with {@link createProcessTest}.
 */
export class ProcessTest {
	private readonly engine = new Engine()
	private readonly clock: VirtualClock
	private readonly coverageIndex: CoverageIndex
	private readonly messageIds = new Map<string, string>()
	private readonly mocks = new Map<string, MockEntry>()
	/** Job type → the AI agents {@link mockAiAgent} plays for it, by element id. */
	private readonly agentMocks = new Map<string, Map<string, AiAgentMockState>>()
	private readonly workerTypes = new Set<string>()
	private readonly unregister: Array<() => void> = []
	private readonly runs: SimulatorRun[] = []
	/** job id → the run and element that created it, recorded from `job:created`. */
	private readonly jobOrigins = new Map<string, { run: SimulatorRun; elementId: string }>()
	private readonly processIds: string[]
	private readonly agentElements: Map<string, AgentElement>
	private readonly host: RunHost
	private disposed = false

	private constructor(
		bpmn: readonly BpmnDefinitions[],
		dmn: readonly DmnDefinitions[],
		forms: readonly FormDefinition[],
		startTime: number,
	) {
		this.engine.deploy({ bpmn: [...bpmn], decisions: [...dmn], forms: [...forms] })
		const processes = bpmn.flatMap((d) => d.processes)
		this.processIds = processes.map((p) => p.id)
		this.agentElements = agentElements(processes)
		this.coverageIndex = new CoverageIndex(processes)
		for (const defs of bpmn) {
			for (const message of defs.messages) {
				if (message.name !== undefined) this.messageIds.set(message.name, message.id)
			}
		}
		for (const type of jobTypes(processes)) this.ensureWorker(type)
		this.clock = new VirtualClock(startTime)
		installClock(this.clock)
		this.host = {
			events: 0,
			coveredElements: new Set(),
			coveredFlows: new Set(),
			settle: () => this.settle(),
			advanceTime: (duration) => this.advanceTime(duration),
			messageRef: (name) => this.messageIds.get(name) ?? name,
			recordJob: (jobId, run, elementId) => {
				this.jobOrigins.set(jobId, { run, elementId })
			},
			flowsInto: (elementId, lastLeft) => this.coverageIndex.flowsInto(elementId, lastLeft),
			isMocked: (type) => this.mocks.has(type) || this.agentMocks.has(type),
		}
	}

	/** Load and deploy the models. {@link createProcessTest} is the usual way in. */
	static async create(options: ProcessTestOptions): Promise<ProcessTest> {
		const bpmn = await load(toList(options.bpmn), "BPMN", (xml) => Bpmn.parse(xml))
		if (bpmn.length === 0) throw new Error("createProcessTest: `bpmn` must name at least one model")
		const dmn = await load(toList(options.dmn), "DMN", (xml) => Dmn.parse(xml))
		const forms = await load(toList(options.forms), "form", (json) => Form.parse(json))
		return new ProcessTest(bpmn, dmn, forms, parseStartTime(options.startTime))
	}

	/**
	 * Handle every job of `type` automatically: complete it with fixed variables
	 * (`{ result }`), fail it (`{ fail }`), throw a BPMN error (`{ throwError }`),
	 * or compute the result in a handler. Replaces an earlier mock of the type.
	 */
	mockJob(type: string, mock: JobMock): JobMockHandle {
		this.assertLive()
		const entry: MockEntry = { mock, calls: [] }
		this.mocks.set(type, entry)
		this.agentMocks.delete(type)
		this.ensureWorker(type)
		return {
			calls: entry.calls,
			restore: () => {
				if (this.mocks.get(type) === entry) this.mocks.delete(type)
			},
		}
	}

	/**
	 * Mock an outbound connector by its job type (e.g. `io.camunda:http-json:1`).
	 * Give the connector's response; the element's `resultVariable` /
	 * `resultExpression` headers map it into variables.
	 */
	mockConnector(type: string, mock: ConnectorMock): JobMockHandle {
		return this.mockJob(type, connectorToJobMock(mock))
	}

	/**
	 * Play the AI Agent connector for the ad-hoc sub-process `elementId`
	 * deterministically. Each model call takes the next turn of the script or
	 * cassette (or asks the handler): a turn with `toolCalls` activates those
	 * tool elements, each with a `toolCall` variable their `fromAi()` mappings
	 * read, and the agent asks again once their results are in `toolCallResults`;
	 * a turn with `responseText` / `responseJson` ends the agent with its
	 * `agent` response. Turns are consumed in order across every run of the
	 * element. Unknown tools, wrong `fromAi()` arguments and a script that runs
	 * out fail the run with a message saying so. Replaces a `mockJob` of the
	 * agent's job type.
	 */
	mockAiAgent(elementId: string, mock: AiAgentMock): AiAgentMockHandle {
		this.assertLive()
		const target = this.agentElements.get(elementId)
		if (target === undefined) {
			const known = [...this.agentElements.keys()]
			throw new Error(
				`mockAiAgent: "${elementId}" is not an AI agent — an ad-hoc sub-process with a zeebe:taskDefinition — in the deployed BPMN. AI agents: ${known.join(", ") || "(none)"}`,
			)
		}
		if (target.outputCollection === undefined) {
			throw new Error(
				`mockAiAgent: AI agent "${elementId}" has no zeebe:adHoc outputCollection, so tool results never reach it. Set outputCollection="toolCallResults".`,
			)
		}
		let agents = this.agentMocks.get(target.jobType)
		if (agents === undefined) {
			agents = new Map()
			this.agentMocks.set(target.jobType, agents)
			this.mocks.delete(target.jobType)
			this.ensureWorker(target.jobType)
		}
		const owner = agents
		const agent = new AiAgentMockState(elementId, target.outputCollection, mock, () => {
			if (owner.get(elementId) === agent) owner.delete(elementId)
		})
		agents.set(elementId, agent)
		return agent
	}

	/** Start an instance of `processId` and run it until it waits or ends. */
	async start(processId: string, variables: Record<string, unknown> = {}): Promise<ProcessRun> {
		this.assertLive()
		if (!this.processIds.includes(processId)) {
			throw new Error(
				`Process "${processId}" is not deployed in this test. Deployed: ${this.processIds.join(", ") || "(none)"}`,
			)
		}
		const instance = this.engine.start(processId, variables)
		const run = new SimulatorRun(this.host, instance)
		this.runs.push(run)
		await this.settle()
		return run
	}

	/**
	 * Move the virtual clock forward by `duration` (ISO 8601 such as `PT1H`, or
	 * milliseconds), firing every timer that falls due on the way in order and
	 * letting the processes react to each before the next.
	 */
	async advanceTime(duration: string | number): Promise<void> {
		this.assertLive()
		const ms = toMilliseconds(duration)
		await this.settle()
		const target = this.clock.now() + ms
		for (let due = this.clock.takeDue(target); due; due = this.clock.takeDue(target)) {
			due()
			await this.settle()
		}
		this.clock.moveTo(target)
	}

	/** The virtual clock's current time. */
	now(): Date {
		return new Date(this.clock.now())
	}

	/**
	 * Flow nodes entered and sequence flows taken across every run so far. Flows
	 * are inferred from element events; see the testing guide for the details.
	 */
	coverage(): CoverageReport {
		return this.coverageIndex.report(this.host.coveredElements, this.host.coveredFlows)
	}

	/** Cancel active runs, unregister workers and hand timers back to the real clock. */
	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		for (const run of this.runs) if (run.state === "active") run.instance.cancel()
		for (const off of this.unregister) off()
		uninstallClock(this.clock)
	}

	/** Let the engine run until nothing happens without outside input, firing timers already due. */
	private async settle(): Promise<void> {
		for (let tick = 0; tick < MAX_SETTLE_TICKS; tick++) {
			const before = this.host.events
			await nextTick()
			const due = this.clock.takeDue(this.clock.now())
			if (due !== undefined) {
				due()
				continue
			}
			if (this.host.events === before) return
		}
		throw new Error(
			`The process was still running after ${MAX_SETTLE_TICKS} ticks — is there a zero-length timer cycle, or a mock that keeps the engine busy?`,
		)
	}

	private ensureWorker(type: string): void {
		if (this.workerTypes.has(type)) return
		this.workerTypes.add(type)
		this.unregister.push(this.engine.registerJobWorker(type, (job) => this.onJob(job)))
	}

	private async onJob(job: Job): Promise<void> {
		const origin = this.jobOrigins.get(job.id)
		this.jobOrigins.delete(job.id)
		if (origin === undefined) {
			throw new Error(`Job ${job.id} (${job.type}) was not created by a run of this ProcessTest`)
		}
		const testJob: TestJob = {
			id: job.id,
			type: job.type,
			elementId: origin.elementId,
			processId: origin.run.processId,
			variables: { ...job.variables },
			headers: { ...job.headers },
		}
		const agents = this.agentMocks.get(job.type)
		if (agents !== undefined) {
			const agent = agents.get(testJob.elementId)
			if (agent === undefined) {
				throw new Error(
					`No AI agent mock for "${testJob.elementId}" — call mockAiAgent("${testJob.elementId}", …). Mocked agents: ${[...agents.keys()].join(", ") || "(none)"}`,
				)
			}
			// Runs of one ProcessTest are driven one at a time, so the run tells agent runs apart.
			await agent.handle(job, testJob, `${origin.run.id}/${testJob.elementId}`)
			return
		}
		const entry = this.mocks.get(job.type)
		if (entry === undefined) {
			origin.run.addWaitingJob(job, testJob)
			return
		}
		entry.calls.push(testJob)
		const { mock } = entry
		if (typeof mock === "function") {
			job.complete((await mock(testJob)) ?? {})
		} else if ("result" in mock) {
			job.complete({ ...mock.result })
		} else if ("fail" in mock) {
			job.fail(mock.fail)
		} else {
			job.throwError(mock.throwError.code, mock.throwError.message ?? mock.throwError.code)
		}
	}

	private assertLive(): void {
		if (this.disposed) throw new Error("This ProcessTest has been disposed")
	}
}

// ── Runs ──────────────────────────────────────────────────────────────────────

interface WaitingJob {
	readonly job: Job
	readonly testJob: TestJob
}

class SimulatorRun implements ProcessRun {
	readonly id: string
	readonly processId: string
	readonly enteredElements: string[] = []
	readonly completedElements: string[] = []
	private readonly waiting: WaitingJob[] = []
	/** elementId → sequence number of its latest completion, for flow inference. */
	private readonly lastLeft = new Map<string, number>()
	private leftCount = 0
	private lastEntered = ""

	constructor(
		private readonly host: RunHost,
		readonly instance: ProcessInstance,
	) {
		this.id = instance.id
		this.processId = instance.processId
		instance.onChange((event) => this.observe(event))
	}

	get state(): RunState {
		return this.instance.state
	}

	get error(): string | undefined {
		return this.instance.error
	}

	get variables(): Record<string, unknown> {
		return this.instance.variables_snapshot
	}

	get activeElements(): readonly string[] {
		return this.instance.activeElements
	}

	get jobs(): readonly TestJob[] {
		return this.liveWaiting().map((w) => w.testJob)
	}

	addWaitingJob(job: Job, testJob: TestJob): void {
		this.waiting.push({ job, testJob })
	}

	async completeJob(ref: string, variables: Record<string, unknown> = {}): Promise<void> {
		const { job } = await this.takeJob(ref)
		job.complete(variables)
		await this.host.settle()
	}

	async failJob(ref: string, message: string): Promise<void> {
		const { job } = await this.takeJob(ref)
		job.fail(message)
		await this.host.settle()
	}

	async throwError(ref: string, code: string, message?: string): Promise<void> {
		const { job } = await this.takeJob(ref)
		job.throwError(code, message ?? code)
		await this.host.settle()
	}

	async publishMessage(name: string): Promise<void> {
		await this.host.settle()
		const before = this.host.events
		this.instance.deliverMessage(this.host.messageRef(name))
		await this.host.settle()
		if (this.host.events === before) {
			throw new Error(
				`Message "${name}" was not correlated: nothing in process "${this.processId}" is waiting for it. Waiting at ${JSON.stringify(this.activeElements)}`,
			)
		}
	}

	advanceTime(duration: string | number): Promise<void> {
		return this.host.advanceTime(duration)
	}

	async cancel(): Promise<void> {
		this.instance.cancel()
		this.waiting.length = 0
		await this.host.settle()
	}

	/** Waiting jobs whose element still holds a token (a boundary timer may have removed it). */
	private liveWaiting(): WaitingJob[] {
		const active = this.instance.activeElements
		return this.waiting.filter((w) => active.includes(w.testJob.elementId))
	}

	private async takeJob(ref: string): Promise<WaitingJob> {
		await this.host.settle()
		const live = this.liveWaiting()
		const found =
			live.find((w) => w.testJob.elementId === ref) ?? live.find((w) => w.testJob.type === ref)
		if (found === undefined) {
			const waiting = live.map((w) => `${w.testJob.elementId} (${w.testJob.type})`)
			const hint = this.host.isMocked(ref)
				? ` Jobs of type "${ref}" are mocked, so they complete on their own.`
				: ""
			throw new Error(
				`No job is waiting at "${ref}" in process "${this.processId}" (${this.state}). Waiting jobs: ${waiting.length > 0 ? waiting.join(", ") : "(none)"}; active elements: ${JSON.stringify(this.activeElements)}.${hint}`,
			)
		}
		this.waiting.splice(this.waiting.indexOf(found), 1)
		return found
	}

	private observe(event: ProcessEvent): void {
		this.host.events++
		switch (event.type) {
			case "element:entering":
				for (const flow of this.host.flowsInto(event.elementId, this.lastLeft)) {
					this.host.coveredFlows.add(flow)
				}
				break
			case "element:entered":
				this.enteredElements.push(event.elementId)
				this.host.coveredElements.add(event.elementId)
				this.lastEntered = event.elementId
				break
			case "element:left":
				this.completedElements.push(event.elementId)
				this.lastLeft.set(event.elementId, ++this.leftCount)
				break
			case "job:created":
				this.host.recordJob(event.job.id, this, event.elementId)
				break
		}
	}
}

/**
 * Deploy models into a fresh in-process engine with a virtual clock, ready to
 * start instances and assert on them. Call `dispose()` when the file is done
 * (an `afterAll`) so timers return to the real clock.
 */
export function createProcessTest(options: ProcessTestOptions): Promise<ProcessTest> {
	return ProcessTest.create(options)
}
