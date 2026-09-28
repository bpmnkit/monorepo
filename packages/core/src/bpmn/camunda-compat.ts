/**
 * Camunda version compatibility — what Camunda Modeler reports through
 * `@camunda/linting` when a diagram uses something the Camunda 8 version it
 * targets cannot run, or leaves out a property that version requires.
 *
 * The target is read from `modeler:executionPlatformVersion` on
 * `<bpmn:definitions>`, or pinned by a `.bpmnlintrc` that extends
 * `plugin:camunda-compat/camunda-cloud-X-Y`. Which construct needs which
 * version lives in `camunda-compat-data.ts`, taken from
 * `bpmnlint-plugin-camunda-compat`; this module applies it. Findings are
 * `compat/<plugin rule name>`, in the `deploy` category: they are deployability
 * findings for the target version, and a new category would widen a union the
 * 1.0 API returns.
 *
 * Problems an existing `deploy/*` (or `feel/*`) check already reports on the
 * same element are left to that check — see `dedupeCamundaCompat`.
 *
 * @packageDocumentation
 */

import type { XmlElement } from "../types/xml-element.js"
import type {
	BpmnDefinitions,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
} from "./bpmn-model.js"
import type {
	BpmnlintRuleSetting,
	ResolvedBpmnlintConfig,
	UnsupportedBpmnlintRule,
} from "./bpmnlint.js"
import {
	CAMUNDA_COMPAT_RULES,
	CAMUNDA_COMPAT_VERSIONS,
	CRON_TIMER_SINCE,
	type CamundaCompatVersion,
	ELEMENT_SUPPORT,
	FEATURE_SINCE,
	FEEL_BUILTIN_SINCE,
	IMPLEMENTATION_SUPPORT,
	INBOUND_CONNECTOR_PROPERTY_SINCE,
	type ImplementationKind,
	TIMER_SUPPORT,
	type TimerProperty,
} from "./camunda-compat-data.js"
import {
	SECRET_REFERENCE_LITERAL,
	feelBuiltinCalls,
	fromAiCalls,
	secretReferenceViolations,
} from "./camunda-compat-feel.js"
import type { OptimizationFinding, OptimizationSeverity } from "./optimize/types.js"

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

const NEWEST = CAMUNDA_COMPAT_VERSIONS[CAMUNDA_COMPAT_VERSIONS.length - 1] as CamundaCompatVersion

function rank(version: CamundaCompatVersion): number {
	return CAMUNDA_COMPAT_VERSIONS.indexOf(version)
}

function atLeast(version: CamundaCompatVersion, since: CamundaCompatVersion): boolean {
	return rank(version) >= rank(since)
}

/**
 * Reduces a Camunda version to the `major.minor` the compatibility tables use:
 * `"8.6.2"` → `"8.6"`. A Camunda 8 version newer than the tables is checked as
 * the newest one they know, since later versions only lift restrictions.
 *
 * @param raw - A version such as `modeler:executionPlatformVersion` holds.
 * @returns The table version, or `undefined` for anything that is not a
 *   Camunda Cloud 1.x or Camunda 8 version.
 */
export function normalizeCamundaVersion(raw: string | undefined): CamundaCompatVersion | undefined {
	const match = /^\s*(\d+)\.(\d+)/.exec(raw ?? "")
	if (match === null) return undefined
	const major = Number(match[1])
	const minor = Number(match[2])
	const exact = CAMUNDA_COMPAT_VERSIONS.find((v) => v === `${major}.${minor}`)
	if (exact !== undefined) return exact
	return major === 8 && minor > 10 ? NEWEST : undefined
}

/**
 * The Camunda version a model targets, from `modeler:executionPlatform` (a
 * Camunda Cloud / Camunda 8 platform) and `modeler:executionPlatformVersion`.
 *
 * @param definitions - The model to read.
 * @returns The table version, or `undefined` when the model targets no
 *   Camunda 8 version — then no compatibility check runs, as in Modeler.
 */
export function targetCamundaVersion(
	definitions: BpmnDefinitions,
): CamundaCompatVersion | undefined {
	const platform = definitions.unknownAttributes["modeler:executionPlatform"]
	if (platform === undefined || !platform.toLowerCase().includes("cloud")) return undefined
	return normalizeCamundaVersion(definitions.unknownAttributes["modeler:executionPlatformVersion"])
}

function ruleActive(rule: string, version: CamundaCompatVersion): boolean {
	const entry = CAMUNDA_COMPAT_RULES[rule]
	if (entry === undefined) return false
	if (entry.since !== undefined && !atLeast(version, entry.since)) return false
	return entry.until === undefined || !atLeast(version, entry.until)
}

// ---------------------------------------------------------------------------
// Model helpers
// ---------------------------------------------------------------------------

type Container = Extract<BpmnFlowElement, { flowElements: BpmnFlowElement[] }>

function isContainer(el: BpmnFlowElement): el is Container {
	return "flowElements" in el
}

function isEventSubProcess(el: BpmnFlowElement | undefined): boolean {
	return (
		el !== undefined &&
		(el.type === "eventSubProcess" || (el.type === "subProcess" && el.triggeredByEvent === true))
	)
}

const CATCH_EVENTS = new Set(["startEvent", "intermediateCatchEvent", "boundaryEvent"])
const THROW_EVENTS = new Set(["intermediateThrowEvent", "endEvent"])
const TASKS = new Set([
	"task",
	"serviceTask",
	"scriptTask",
	"userTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
])
const ACTIVITIES = new Set([
	...TASKS,
	"callActivity",
	"subProcess",
	"adHocSubProcess",
	"eventSubProcess",
	"transaction",
])

function eventDefinitionOf(el: BpmnFlowElement): BpmnEventDefinition | undefined {
	return "eventDefinitions" in el ? el.eventDefinitions[0] : undefined
}

function bpmnType(el: BpmnFlowElement): string {
	if (el.type === "eventSubProcess") return "bpmn:SubProcess"
	return `bpmn:${el.type.charAt(0).toUpperCase()}${el.type.slice(1)}`
}

function bpmnEventDefinitionType(def: BpmnEventDefinition): string {
	return `bpmn:${def.type.charAt(0).toUpperCase()}${def.type.slice(1)}EventDefinition`
}

function zeebe(extensions: readonly XmlElement[] | undefined, name: string): XmlElement[] {
	return (extensions ?? []).filter((e) => e.name === `zeebe:${name}`)
}

function children(parent: XmlElement | undefined, name: string): XmlElement[] {
	return parent === undefined ? [] : parent.children.filter((c) => c.name === `zeebe:${name}`)
}

function isEmpty(value: string | undefined): boolean {
	return value === undefined || value === ""
}

const TYPE_LABEL: Record<BpmnFlowElement["type"], string> = {
	startEvent: "start event",
	endEvent: "end event",
	intermediateThrowEvent: "intermediate throw event",
	intermediateCatchEvent: "intermediate catch event",
	boundaryEvent: "boundary event",
	task: "task",
	serviceTask: "service task",
	scriptTask: "script task",
	userTask: "user task",
	sendTask: "send task",
	receiveTask: "receive task",
	businessRuleTask: "business rule task",
	manualTask: "manual task",
	callActivity: "call activity",
	exclusiveGateway: "exclusive gateway",
	parallelGateway: "parallel gateway",
	inclusiveGateway: "inclusive gateway",
	eventBasedGateway: "event-based gateway",
	complexGateway: "complex gateway",
	subProcess: "sub-process",
	adHocSubProcess: "ad-hoc sub-process",
	eventSubProcess: "event sub-process",
	transaction: "transaction",
	dataObject: "data object",
	dataObjectReference: "data object reference",
	dataStoreReference: "data store reference",
}

/** `Signal end event "Notify"` — the event definition, the type, then the name. */
function describe(el: BpmnFlowElement, withDefinition = true): string {
	const def = withDefinition ? eventDefinitionOf(el) : undefined
	const type = TYPE_LABEL[el.type]
	const label =
		def !== undefined
			? `${def.type} ${type}`
			: el.type === "subProcess" && el.triggeredByEvent === true
				? "event sub-process"
				: type
	return `${label.charAt(0).toUpperCase()}${label.slice(1)} "${el.name ?? el.id}"`
}

// ---------------------------------------------------------------------------
// Timer value syntax — ported from the plugin's utils/iso8601.js and cron.js
// ---------------------------------------------------------------------------

const ISO_DATE_RE =
	/^(?<date>\d{4}-(?<month>0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](Z|([+-](0[0-9]|1[0-3]):[0-5][0-9](\[[^\]]+\])?))$/
const ISO_DURATION =
	"P(?!$)(\\d+(\\.\\d+)?[Yy])?(\\d+(\\.\\d+)?[Mm])?(\\d+(\\.\\d+)?[Ww])?(\\d+(\\.\\d+)?[Dd])?(T(?!$)(\\d+(\\.\\d+)?[Hh])?(\\d+(\\.\\d+)?[Mm])?(\\d+(\\.\\d+)?[Ss])?)?$"
const ISO_DURATION_RE = new RegExp(`^${ISO_DURATION}$`)
const ISO_CYCLE_RE = new RegExp(
	`^R(-1|\\d+)?/(${ISO_DATE_RE.source.slice(1, -1)}/)?${ISO_DURATION}$`.replace(
		/\(\?<(date|month)>/g,
		"(",
	),
)

function isIsoDate(value: string): boolean {
	const match = ISO_DATE_RE.exec(value)
	if (match?.groups === undefined) return false
	// Rejects dates like 2024-02-31, which `Date` rolls into the next month.
	return new Date(match.groups.date as string).getMonth() + 1 === Number(match.groups.month)
}

const cronAlt = (...patterns: string[]) => `(${patterns.join("|")})`
const cronRange = (p: string) => `${p}(-${p})?`
const cronList = (p: string) => `${p}(,${p})*`
const cronStep = (p: string) => `${p}/\\d+`
const CRON_SECOND = "([0-5]?[0-9])"
const CRON_HOUR = "([01]?[0-9]|2[0-3])"
const CRON_DOM = cronAlt(
	`L(-${cronAlt("[0-2]?[0-9]", "3[0-1]")})?`,
	"[0-2]?[0-9]",
	"3[0-1]",
	`${cronAlt("L", "[0-2]?[0-9]", "3[0-1]")}W`,
)
const CRON_MONTH = cronAlt(
	"[0]?[1-9]",
	"1[0-2]",
	..."JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" "),
)
const CRON_DOW = cronAlt("[0-7]", ..."MON TUE WED THU FRI SAT SUN".split(" "))
const cronTime = (p: string) =>
	cronAlt("\\*", cronStep("\\*"), cronList(cronAlt(cronStep(p), cronRange(p))))
const CRON_RE = new RegExp(
	`^${[
		cronTime(CRON_SECOND),
		cronTime(CRON_SECOND),
		cronTime(CRON_HOUR),
		cronAlt("\\*", "\\?", cronList(cronRange(CRON_DOM))),
		cronAlt("\\*", cronList(cronRange(CRON_MONTH))),
		cronAlt("\\*", "\\?", cronList(cronAlt(cronRange(CRON_DOW), `${CRON_DOW}(#[1-5]|L)`))),
	].join(" ")}$`,
	"i",
)
const CRON_MACRO_RE = /^@(yearly|annually|monthly|weekly|daily|midnight|hourly)$/

function isCron(value: string): boolean {
	return CRON_MACRO_RE.test(value) || CRON_RE.test(value)
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const SEVERITY: Record<"error" | "warn", OptimizationSeverity> = { error: "error", warn: "warning" }

interface Context {
	version: CamundaCompatVersion
	definitions: BpmnDefinitions
	process: BpmnProcess
	findings: OptimizationFinding[]
	/** Sub-processes seen, for the diagram-interchange `collapsed-subprocess` check. */
	subProcessIds: Set<string>
	/** Every flow element of the process, nested ones included, in document order. */
	elements: Map<string, Located<BpmnFlowElement>>
	/** Every sequence flow of the process, nested ones included. */
	flows: Map<string, Located<BpmnSequenceFlow>>
}

/** An element and the sub-process it sits in (`undefined`: the process itself). */
interface Located<T> {
	el: T
	parent: Container | undefined
}

function report(
	ctx: Context,
	rule: string,
	elementId: string,
	message: string,
	suggestion: string,
	severity?: OptimizationSeverity,
): void {
	if (!ruleActive(rule, ctx.version)) return
	ctx.findings.push({
		id: `compat/${rule}`,
		category: "deploy",
		severity: severity ?? SEVERITY[CAMUNDA_COMPAT_RULES[rule]?.severity ?? "error"],
		message,
		suggestion,
		processId: ctx.process.id,
		elementIds: [elementId],
	})
}

function targets(ctx: Context): string {
	return `this model targets Camunda ${ctx.version}`
}

function raise(since: string): string {
	return `Target Camunda ${since} or newer (modeler:executionPlatformVersion), or remove it.`
}

/**
 * Checks a model against the Camunda 8 version it targets, the way
 * `bpmnlint-plugin-camunda-compat` does in Camunda Modeler.
 *
 * Reports each element, event definition, Zeebe extension or property the
 * target version does not support, and each property that version requires
 * but the model leaves out. From Camunda 8.2 on, processes not marked
 * executable are skipped, as Modeler skips them.
 *
 * @param definitions - The model to check.
 * @param version - The target, e.g. `"8.6"` or `"8.6.2"`. Defaults to the
 *   model's own `modeler:executionPlatformVersion`.
 * @returns `compat/*` findings; none when there is no Camunda 8 target.
 *
 * @example
 * ```typescript
 * const findings = analyzeCamundaCompat(Bpmn.parse(xml), "8.5");
 * // compat/element-type: Ad-hoc sub-process "Tools" needs Camunda 8.7 or newer; ...
 * ```
 */
export function analyzeCamundaCompat(
	definitions: BpmnDefinitions,
	version?: string,
): OptimizationFinding[] {
	const target =
		version !== undefined ? normalizeCamundaVersion(version) : targetCamundaVersion(definitions)
	if (target === undefined) return []

	const findings: OptimizationFinding[] = []
	for (const process of definitions.processes) {
		if (atLeast(target, "8.2") && process.isExecutable !== true) continue
		const ctx: Context = {
			version: target,
			definitions,
			process,
			findings,
			subProcessIds: new Set(),
			elements: new Map(),
			flows: new Map(),
		}
		locate(ctx, process.flowElements, process.sequenceFlows, undefined)
		checkProcess(ctx)
		checkScope(ctx, process.flowElements, process.sequenceFlows, undefined)
		checkCollapsed(ctx)
		checkContents(ctx)
	}
	return findings
}

function locate(
	ctx: Context,
	elements: readonly BpmnFlowElement[],
	flows: readonly BpmnSequenceFlow[],
	parent: Container | undefined,
): void {
	for (const flow of flows) ctx.flows.set(flow.id, { el: flow, parent })
	for (const el of elements) {
		ctx.elements.set(el.id, { el, parent })
		if (isContainer(el)) locate(ctx, el.flowElements, el.sequenceFlows, el)
	}
}

function checkProcess(ctx: Context): void {
	const { process } = ctx
	const ext = process.extensionElements
	checkListeners(ctx, process.id, ext, `Process "${process.name ?? process.id}"`, true, false)
	checkTemplate(
		ctx,
		process.id,
		process.unknownAttributes,
		`Process "${process.name ?? process.id}"`,
	)
	checkNoExtension(ctx, "no-zeebe-properties", process.id, ext, "properties", "Process")

	const versionTag = zeebe(ext, "versionTag")[0]
	if (versionTag !== undefined) {
		report(
			ctx,
			"no-version-tag",
			process.id,
			`Process "${process.name ?? process.id}" has a zeebe:versionTag, which needs Camunda ${FEATURE_SINCE.versionTag} or newer; ${targets(ctx)}.`,
			raise(FEATURE_SINCE.versionTag),
		)
		if (isEmpty(versionTag.attributes.value)) {
			report(
				ctx,
				"version-tag",
				process.id,
				`Process "${process.name ?? process.id}" has a zeebe:versionTag with no value.`,
				"Set the version tag, or remove it.",
			)
		}
	}

	const noneStarts = process.flowElements.filter(
		(el) => el.type === "startEvent" && el.eventDefinitions.length === 0,
	)
	if (noneStarts.length > 1) {
		for (const start of noneStarts) {
			report(
				ctx,
				"no-multiple-none-start-events",
				start.id,
				`${describe(start)} is one of ${noneStarts.length} blank start events in process "${process.name ?? process.id}"; Camunda allows one.`,
				"Keep one blank start event and give the others an event definition.",
			)
		}
	}
}

function checkCollapsed(ctx: Context): void {
	for (const diagram of ctx.definitions.diagrams) {
		for (const shape of diagram.plane.shapes) {
			if (!ctx.subProcessIds.has(shape.bpmnElement) || shape.isExpanded === true) continue
			report(
				ctx,
				"collapsed-subprocess",
				shape.bpmnElement,
				`Sub-process "${shape.bpmnElement}" is drawn collapsed, which needs Camunda ${FEATURE_SINCE.collapsedSubProcess} or newer; ${targets(ctx)}.`,
				`Expand the sub-process, or target Camunda ${FEATURE_SINCE.collapsedSubProcess} or newer.`,
			)
		}
	}
}

function checkScope(
	ctx: Context,
	elements: readonly BpmnFlowElement[],
	flows: readonly BpmnSequenceFlow[],
	parent: BpmnFlowElement | undefined,
): void {
	const byId = new Map(elements.map((el) => [el.id, el]))
	const outgoing = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of flows) {
		const list = outgoing.get(flow.sourceRef) ?? []
		list.push(flow)
		outgoing.set(flow.sourceRef, list)
	}

	for (const el of elements) {
		checkElement(ctx, el, parent, byId, flows)
		if (isContainer(el)) {
			ctx.subProcessIds.add(el.id)
			checkScope(ctx, el.flowElements, el.sequenceFlows, el)
		}
	}

	checkSequenceFlows(ctx, byId, flows, outgoing)
}

function checkSequenceFlows(
	ctx: Context,
	byId: ReadonlyMap<string, BpmnFlowElement>,
	flows: readonly BpmnSequenceFlow[],
	outgoing: ReadonlyMap<string, BpmnSequenceFlow[]>,
): void {
	for (const flow of flows) {
		const source = byId.get(flow.sourceRef)
		if (source === undefined) continue
		const decides = source.type === "exclusiveGateway" || source.type === "inclusiveGateway"
		if (decides) {
			const siblings = outgoing.get(source.id) ?? []
			if (
				siblings.length > 1 &&
				flow.id !== source.default &&
				flow.conditionExpression === undefined
			) {
				report(
					ctx,
					"sequence-flow-condition",
					flow.id,
					`Sequence flow "${flow.name ?? flow.id}" leaves ${describe(source)} without a condition and is not its default flow.`,
					"Add a condition expression, or make it the gateway's default flow.",
				)
			}
		} else if (flow.conditionExpression !== undefined) {
			report(
				ctx,
				"sequence-flow-condition",
				flow.id,
				`Sequence flow "${flow.name ?? flow.id}" has a condition, but only flows leaving an exclusive or inclusive gateway may.`,
				"Remove the condition, or route the flow through a gateway.",
			)
		}
	}
}

function checkElement(
	ctx: Context,
	el: BpmnFlowElement,
	parent: BpmnFlowElement | undefined,
	scope: ReadonlyMap<string, BpmnFlowElement>,
	flows: readonly BpmnSequenceFlow[],
): void {
	const supported = checkElementType(ctx, el)
	if (supported) checkImplementation(ctx, el)
	checkTimer(ctx, el, parent)
	checkReferences(ctx, el, parent)
	checkExtensions(ctx, el)
	checkLoop(ctx, el)
	checkForms(ctx, el)

	const joined =
		el.type === "inclusiveGateway" ? flows.filter((f) => f.targetRef === el.id).length : 0
	if (joined > 1) {
		report(
			ctx,
			"inclusive-gateway",
			el.id,
			`${describe(el)} joins ${joined} flows; Camunda ${ctx.version} only runs inclusive gateways that fork, joining needs Camunda 8.6 or newer.`,
			"Give it a single incoming flow, or target Camunda 8.6 or newer.",
		)
	}

	if (el.type === "receiveTask") {
		const fromEventGateway = flows.some(
			(f) => f.targetRef === el.id && scope.get(f.sourceRef)?.type === "eventBasedGateway",
		)
		if (fromEventGateway) {
			report(
				ctx,
				"event-based-gateway-target",
				el.id,
				`${describe(el)} follows an event-based gateway; Camunda only accepts catch events there.`,
				"Replace the receive task with a message intermediate catch event.",
			)
		}
	}

	const def = eventDefinitionOf(el)
	if (el.type === "boundaryEvent" && def?.type === "escalation") {
		const host = scope.get(el.attachedToRef)
		if (host !== undefined && TASKS.has(host.type)) {
			report(
				ctx,
				"escalation-boundary-event-attached-to-ref",
				el.id,
				`${describe(el)} is attached to ${describe(host, false)}; a task cannot throw an escalation, so Camunda does not allow it there.`,
				"Attach it to a sub-process or call activity instead.",
			)
		}
	}

	if (THROW_EVENTS.has(el.type) && def?.type === "compensate") {
		if (def.unknownAttributes?.waitForCompletion === "false") {
			report(
				ctx,
				"wait-for-completion",
				el.id,
				`${describe(el)} sets waitForCompletion="false"; Camunda always waits for compensation to complete.`,
				'Remove waitForCompletion, or set it to "true".',
			)
		}
	}

	if (el.type === "adHocSubProcess") checkAdHoc(ctx, el)

	if (el.type === "startEvent" && parent !== undefined) {
		if (def?.type === "signal") {
			report(
				ctx,
				"no-signal-event-sub-process",
				el.id,
				`${describe(el)} starts a sub-process, which needs Camunda ${FEATURE_SINCE.signalEventSubProcess} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.signalEventSubProcess),
			)
		}
		if (el.isInterrupting !== false && isEventSubProcess(parent)) {
			const grandparent = findParent(ctx.process.flowElements, parent.id)
			if (grandparent?.type === "adHocSubProcess") {
				report(
					ctx,
					"no-interrupting-event-subprocess",
					el.id,
					`${describe(el)} interrupts an event sub-process inside ad-hoc sub-process "${grandparent.name ?? grandparent.id}"; Camunda only allows non-interrupting ones there.`,
					'Set isInterrupting="false".',
				)
			}
		}
	}
}

function findParent(
	elements: readonly BpmnFlowElement[],
	childId: string,
	parent?: BpmnFlowElement,
): BpmnFlowElement | undefined {
	for (const el of elements) {
		if (el.id === childId) return parent
		if (isContainer(el)) {
			const found = findParent(el.flowElements, childId, el)
			if (found !== undefined) return found
		}
	}
	return undefined
}

/** `element-type`. Returns whether the target version runs the element. */
function checkElementType(ctx: Context, el: BpmnFlowElement): boolean {
	const support = ELEMENT_SUPPORT[bpmnType(el)]
	let since: CamundaCompatVersion | undefined
	if (typeof support === "string") {
		since = support
	} else if (support !== undefined) {
		const def = eventDefinitionOf(el)
		since = support[def === undefined ? "_" : bpmnEventDefinitionType(def)]
	}

	if (since === undefined) {
		report(
			ctx,
			"element-type",
			el.id,
			`${describe(el)} is not supported by any Camunda 8 version.`,
			"Model it with an element Camunda 8 executes.",
		)
		return false
	}
	if (!atLeast(ctx.version, since)) {
		report(
			ctx,
			"element-type",
			el.id,
			`${describe(el)} needs Camunda ${since} or newer; ${targets(ctx)}.`,
			raise(since),
		)
		return false
	}
	return true
}

function implementationSince(
	kind: ImplementationKind,
	el: BpmnFlowElement,
): CamundaCompatVersion | undefined {
	const support = IMPLEMENTATION_SUPPORT[kind][bpmnType(el)]
	if (typeof support === "string" || support === undefined) return support
	const def = eventDefinitionOf(el)
	return def === undefined ? undefined : support[bpmnEventDefinitionType(def)]
}

const IMPLEMENTATION_PROPERTIES: Record<ImplementationKind, readonly string[]> = {
	calledDecision: ["decisionId", "resultVariable"],
	script: ["expression", "resultVariable"],
	taskDefinition: ["type"],
}

/** `implementation` — how the task is carried out, and when that was introduced. */
function checkImplementation(ctx: Context, el: BpmnFlowElement): void {
	const def = eventDefinitionOf(el)
	if (THROW_EVENTS.has(el.type) && def === undefined) return

	const kinds: ImplementationKind[] = ["calledDecision", "script", "taskDefinition"]
	const present = kinds.filter((kind) => zeebe(el.extensionElements, kind).length > 0)

	if (present.length === 1) {
		const kind = present[0] as ImplementationKind
		const since = implementationSince(kind, el)
		if (since === undefined || !atLeast(ctx.version, since)) {
			report(
				ctx,
				"implementation",
				el.id,
				since === undefined
					? `${describe(el)} has a zeebe:${kind}, which Camunda does not allow on it.`
					: `${describe(el)} has a zeebe:${kind}, which needs Camunda ${since} or newer here; ${targets(ctx)}.`,
				since === undefined ? `Remove the zeebe:${kind}.` : raise(since),
			)
			return
		}
		const ext = zeebe(el.extensionElements, kind)[0] as XmlElement
		const missing = IMPLEMENTATION_PROPERTIES[kind].filter((p) => isEmpty(ext.attributes[p]))
		for (const property of missing) {
			report(
				ctx,
				"implementation",
				el.id,
				`${describe(el)} has a zeebe:${kind} with no ${property}.`,
				`Set ${property} on the zeebe:${kind}.`,
			)
		}
		if (missing.length > 0) return
	}

	const allowed = kinds.filter((kind) => {
		const since = implementationSince(kind, el)
		return since !== undefined && atLeast(ctx.version, since)
	})
	// An ad-hoc sub-process is carried out by its own contents unless it has a task definition.
	if (allowed.length === 0 || el.type === "adHocSubProcess") return
	const count = allowed.reduce((n, kind) => n + zeebe(el.extensionElements, kind).length, 0)
	if (count !== 1) {
		const names = allowed.map((k) => `zeebe:${k}`).join(" or ")
		report(
			ctx,
			"implementation",
			el.id,
			count === 0
				? `${describe(el)} has no implementation; Camunda needs a ${names}.`
				: `${describe(el)} has ${count} implementations; Camunda needs exactly one ${names}.`,
			allowed.includes("taskDefinition")
				? "Set a job type (zeebe:taskDefinition)."
				: `Add one ${names}.`,
		)
	}
}

const TIMER_PROPERTIES: readonly TimerProperty[] = ["timeCycle", "timeDate", "timeDuration"]

/** `timer` — which timer properties the event takes, and whether the value parses. */
function checkTimer(ctx: Context, el: BpmnFlowElement, parent: BpmnFlowElement | undefined): void {
	const def = eventDefinitionOf(el)
	if (def?.type !== "timer") return
	const support = TIMER_SUPPORT[bpmnType(el)]
	if (support === undefined) return

	const interrupting =
		el.type === "boundaryEvent"
			? el.cancelActivity !== false
			: el.type === "startEvent"
				? el.isInterrupting !== false
				: true
	const inEventSubProcess = isEventSubProcess(parent)
	const sinceOf = (p: TimerProperty) => support[p](interrupting, inEventSubProcess)

	const property = TIMER_PROPERTIES.find((p) => def[p] !== undefined)
	if (property === undefined) {
		const allowed = TIMER_PROPERTIES.filter((p) => {
			const since = sinceOf(p)
			return since !== null && atLeast(ctx.version, since)
		})
		report(
			ctx,
			"timer",
			el.id,
			`${describe(el)} has no timer value; set one of ${allowed.join(", ")}.`,
			"Set when the timer fires.",
		)
		return
	}

	const since = sinceOf(property)
	if (since === null || !atLeast(ctx.version, since)) {
		report(
			ctx,
			"timer",
			el.id,
			since === null
				? `${describe(el)} uses ${property}, which Camunda does not allow on this event.`
				: `${describe(el)} uses ${property}, which needs Camunda ${since} or newer on this event; ${targets(ctx)}.`,
			since === null ? "Use another kind of timer." : raise(since),
		)
		return
	}

	const value = (def[property] ?? "").trim()
	if (value === "") {
		report(ctx, "timer", el.id, `${describe(el)} has an empty ${property}.`, "Set a timer value.")
		return
	}
	if (value.startsWith("=")) return
	if (property === "timeCycle" && !ISO_CYCLE_RE.test(value) && isCron(value)) {
		if (!atLeast(ctx.version, CRON_TIMER_SINCE)) {
			report(
				ctx,
				"timer",
				el.id,
				`${describe(el)} uses a cron expression, which needs Camunda ${CRON_TIMER_SINCE} or newer; ${targets(ctx)}.`,
				"Use an ISO 8601 repeating interval (R/PT1H), or target Camunda 8.1 or newer.",
			)
		}
		return
	}
	const valid =
		property === "timeCycle"
			? ISO_CYCLE_RE.test(value)
			: property === "timeDate"
				? isIsoDate(value)
				: ISO_DURATION_RE.test(value)
	if (!valid) {
		const expected =
			property === "timeCycle"
				? "an ISO 8601 repeating interval (R3/PT10M) or a cron expression"
				: property === "timeDate"
					? "an ISO 8601 date-time (2026-01-01T09:00:00Z)"
					: "an ISO 8601 duration (PT15M)"
		report(
			ctx,
			"timer",
			el.id,
			`${describe(el)} has ${property} "${value}", which is not ${expected}.`,
			`Write ${expected}, or a FEEL expression starting with "=".`,
		)
	}
}

/** Message, error, escalation and signal references, and their codes and names. */
function checkReferences(
	ctx: Context,
	el: BpmnFlowElement,
	parent: BpmnFlowElement | undefined,
): void {
	const def = eventDefinitionOf(el)
	const isCatch = CATCH_EVENTS.has(el.type)
	const isThrow = THROW_EVENTS.has(el.type)
	const { definitions } = ctx

	// message-reference, subscription
	const messageRef =
		el.type === "receiveTask" ? el.messageRef : def?.type === "message" ? def.messageRef : undefined
	const takesMessage = el.type === "receiveTask" || def?.type === "message"
	if (takesMessage) {
		const message =
			messageRef === undefined ? undefined : definitions.messages.find((m) => m.id === messageRef)
		if ((isCatch || el.type === "receiveTask") && message === undefined) {
			report(
				ctx,
				"message-reference",
				el.id,
				messageRef === undefined
					? `${describe(el)} references no message.`
					: `${describe(el)} references message "${messageRef}", which does not exist.`,
				"Reference a bpmn:message with a name.",
			)
		} else if ((isCatch || el.type === "receiveTask") && isEmpty(message?.name)) {
			report(
				ctx,
				"message-reference",
				el.id,
				`${describe(el)} references message "${messageRef}", which has no name.`,
				"Name the message — Camunda correlates on it.",
			)
		}

		// A message start event of the process itself is correlated by name alone.
		const subscribes = !(el.type === "startEvent" && parent === undefined)
		if (subscribes && message !== undefined) {
			const onMessage = zeebe(message.extensionElements, "subscription")
			const onElement = zeebe(el.extensionElements, "subscription")[0]
			if (onMessage.length !== 1) {
				const keyOnElement = !isEmpty(onElement?.attributes.correlationKey)
				report(
					ctx,
					"subscription",
					el.id,
					keyOnElement
						? `${describe(el)} carries its zeebe:subscription itself; Camunda Modeler expects it on message "${message.name ?? message.id}".`
						: `Message "${message.name ?? message.id}" used by ${describe(el)} has no zeebe:subscription.`,
					keyOnElement
						? "Move the zeebe:subscription onto the bpmn:message."
						: "Add a zeebe:subscription with a correlationKey to the message.",
				)
			} else if (isEmpty(onMessage[0]?.attributes.correlationKey)) {
				report(
					ctx,
					"subscription",
					el.id,
					`Message "${message.name ?? message.id}" used by ${describe(el)} has a zeebe:subscription with no correlationKey.`,
					"Set the correlation key.",
				)
			}
		}
	}

	if (def?.type === "error" && (isCatch || isThrow)) {
		const optional = isCatch && atLeast(ctx.version, FEATURE_SINCE.errorCatchWithoutRef)
		const error =
			def.errorRef === undefined ? undefined : definitions.errors.find((e) => e.id === def.errorRef)
		if (error === undefined && !optional) {
			report(
				ctx,
				"error-reference",
				el.id,
				isCatch
					? `${describe(el)} references no error; catching every error needs Camunda ${FEATURE_SINCE.errorCatchWithoutRef} or newer, ${targets(ctx)}.`
					: `${describe(el)} references no error.`,
				"Reference a bpmn:error with an error code.",
			)
		} else if (error !== undefined && isEmpty(error.errorCode)) {
			report(
				ctx,
				"error-reference",
				el.id,
				`${describe(el)} references error "${error.name ?? error.id}", which has no error code.`,
				"Set the error code.",
			)
		} else if (error?.errorCode?.startsWith("=")) {
			const before82 = !atLeast(ctx.version, "8.2")
			const before84 = !atLeast(ctx.version, "8.4")
			if (before82 || (before84 && isCatch)) {
				report(
					ctx,
					"no-expression",
					el.id,
					isCatch
						? `${describe(el)} catches error code "${error.errorCode}", an expression, which Camunda ${ctx.version} does not support in a catch event.`
						: `${describe(el)} throws error code "${error.errorCode}", an expression, which needs Camunda ${FEATURE_SINCE.errorCodeExpression} or newer; ${targets(ctx)}.`,
					isCatch ? "Use a static error code." : raise(FEATURE_SINCE.errorCodeExpression),
				)
			}
		}
	}

	if (def?.type === "escalation" && (isCatch || isThrow)) {
		const escalation =
			def.escalationRef === undefined
				? undefined
				: definitions.escalations.find((e) => e.id === def.escalationRef)
		if (escalation === undefined && isThrow) {
			report(
				ctx,
				"escalation-reference",
				el.id,
				`${describe(el)} references no escalation.`,
				"Reference a bpmn:escalation with an escalation code.",
			)
		} else if (escalation !== undefined && isEmpty(escalation.escalationCode)) {
			report(
				ctx,
				"escalation-reference",
				el.id,
				`${describe(el)} references escalation "${escalation.name ?? escalation.id}", which has no escalation code.`,
				"Set the escalation code.",
			)
		} else if (
			isCatch &&
			escalation?.escalationCode?.startsWith("=") &&
			atLeast(ctx.version, "8.2") &&
			!atLeast(ctx.version, "8.4")
		) {
			report(
				ctx,
				"no-expression",
				el.id,
				`${describe(el)} catches escalation code "${escalation.escalationCode}", an expression, which Camunda ${ctx.version} does not support in a catch event.`,
				"Use a static escalation code.",
			)
		}
	}

	if (def?.type === "signal" && (isCatch || isThrow)) {
		const signal =
			def.signalRef === undefined
				? undefined
				: definitions.signals.find((s) => s.id === def.signalRef)
		if (signal === undefined) {
			report(
				ctx,
				"signal-reference",
				el.id,
				`${describe(el)} references no signal.`,
				"Reference a bpmn:signal with a name.",
			)
		} else if (isEmpty(signal.name)) {
			report(
				ctx,
				"signal-reference",
				el.id,
				`${describe(el)} references signal "${signal.id}", which has no name.`,
				"Name the signal — Camunda broadcasts on it.",
			)
		}
	}
}

function checkNoExtension(
	ctx: Context,
	rule: keyof typeof NO_EXTENSION,
	elementId: string,
	ext: readonly XmlElement[],
	name: string,
	label: string,
): void {
	if (zeebe(ext, name).length === 0) return
	const since = NO_EXTENSION[rule]
	report(
		ctx,
		rule,
		elementId,
		`${label} has a zeebe:${name}, which needs Camunda ${since} or newer; ${targets(ctx)}.`,
		raise(since),
	)
}

const NO_EXTENSION = {
	"no-zeebe-properties": FEATURE_SINCE.zeebeProperties,
	"no-task-schedule": FEATURE_SINCE.taskSchedule,
	"no-zeebe-user-task": FEATURE_SINCE.zeebeUserTask,
	"no-priority-definition": FEATURE_SINCE.priorityDefinition,
	"no-task-listeners": FEATURE_SINCE.taskListeners,
	"no-job-priority-definition": FEATURE_SINCE.jobPriorityDefinition,
} as const

/** Execution listeners — present at all, then their event types, types and headers. */
function checkListeners(
	ctx: Context,
	elementId: string,
	ext: readonly XmlElement[],
	label: string,
	isProcess: boolean,
	multiInstance: boolean,
): void {
	const container = zeebe(ext, "executionListeners")[0]
	if (container === undefined) return
	report(
		ctx,
		"no-execution-listeners",
		elementId,
		`${label} has execution listeners, which need Camunda ${FEATURE_SINCE.executionListeners} or newer; ${targets(ctx)}.`,
		raise(FEATURE_SINCE.executionListeners),
	)

	const listeners = children(container, "executionListener")
	const seen = new Set<string>()
	for (const listener of listeners) {
		const { eventType, type } = listener.attributes
		if (isEmpty(type)) {
			report(
				ctx,
				"execution-listener",
				elementId,
				`${label} has an execution listener with no job type.`,
				"Set the listener's type.",
			)
		}
		const key = `${eventType ?? ""}\u0000${type ?? ""}`
		if (!isEmpty(type) && seen.has(key)) {
			report(
				ctx,
				"duplicate-execution-listeners",
				elementId,
				`${label} has two "${eventType}" execution listeners of type "${type}".`,
				"Remove the duplicate listener.",
			)
		}
		seen.add(key)
		if (children(listener, "taskHeaders").length > 0) {
			report(
				ctx,
				"no-execution-listener-headers",
				elementId,
				`${label} has an execution listener with headers, which need Camunda ${FEATURE_SINCE.executionListenerHeaders} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.executionListenerHeaders),
			)
		}
		if (eventType === "beforeAll") {
			report(
				ctx,
				"no-before-all-execution-listener",
				elementId,
				`${label} has a "beforeAll" execution listener, which needs Camunda ${FEATURE_SINCE.beforeAllExecutionListener} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.beforeAllExecutionListener),
			)
			if (!multiInstance) {
				report(
					ctx,
					"before-all-execution-listener",
					elementId,
					`${label} has a "beforeAll" execution listener but is not multi-instance.`,
					'Use "start", or make the element multi-instance.',
				)
			}
		}
		if (eventType === "cancel") {
			report(
				ctx,
				"no-cancel-execution-listener",
				elementId,
				`${label} has a "cancel" execution listener, which needs Camunda ${FEATURE_SINCE.cancelExecutionListener} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.cancelExecutionListener),
			)
			if (!isProcess) {
				report(
					ctx,
					"cancel-execution-listener",
					elementId,
					`${label} has a "cancel" execution listener; Camunda only allows those on a process.`,
					"Move the listener to the process.",
				)
			}
		}
	}
}

function checkTemplate(
	ctx: Context,
	elementId: string,
	attributes: Readonly<Record<string, string>>,
	label: string,
): void {
	const template = attributes["zeebe:modelerTemplate"]
	if (isEmpty(template)) return
	report(
		ctx,
		"no-template",
		elementId,
		`${label} applies element template "${template}", which needs Camunda ${FEATURE_SINCE.modelerTemplate} or newer; ${targets(ctx)}.`,
		raise(FEATURE_SINCE.modelerTemplate),
	)
}

/** Zeebe extensions that are version-gated or have required properties. */
function checkExtensions(ctx: Context, el: BpmnFlowElement): void {
	const ext = el.extensionElements
	const label = describe(el)
	const multiInstance = "loopCharacteristics" in el && el.loopCharacteristics !== undefined
	checkListeners(ctx, el.id, ext, label, false, multiInstance)
	checkTemplate(ctx, el.id, el.unknownAttributes, label)
	checkNoExtension(ctx, "no-zeebe-properties", el.id, ext, "properties", label)
	checkNoExtension(ctx, "no-job-priority-definition", el.id, ext, "jobPriorityDefinition", label)

	for (const kind of ["calledDecision", "calledElement", "formDefinition"]) {
		const holder = zeebe(ext, kind)[0]
		const binding = holder?.attributes.bindingType
		if (holder === undefined || isEmpty(binding)) continue
		if (binding !== "latest") {
			report(
				ctx,
				"no-binding-type",
				el.id,
				`${label} binds its zeebe:${kind} by "${binding}", which needs Camunda ${FEATURE_SINCE.bindingType} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.bindingType),
			)
		}
		if (
			binding === "versionTag" &&
			["businessRuleTask", "callActivity", "userTask"].includes(el.type)
		) {
			const tag = holder.attributes.versionTag
			if (isEmpty(tag)) {
				report(
					ctx,
					"version-tag",
					el.id,
					`${label} binds its zeebe:${kind} by version tag but sets no versionTag.`,
					"Set the version tag to bind to.",
				)
			} else if (
				el.type === "businessRuleTask" &&
				tag?.startsWith("=") &&
				!atLeast(ctx.version, FEATURE_SINCE.decisionVersionTagExpression)
			) {
				report(
					ctx,
					"version-tag",
					el.id,
					`${label} binds its decision by a version tag expression, which needs Camunda ${FEATURE_SINCE.decisionVersionTagExpression} or newer; ${targets(ctx)}.`,
					raise(FEATURE_SINCE.decisionVersionTagExpression),
				)
			}
		}
	}

	if (el.type === "callActivity") {
		const called = zeebe(ext, "calledElement")[0]
		if (called === undefined || isEmpty(called.attributes.processId)) {
			report(
				ctx,
				"called-element",
				el.id,
				`${label} has no zeebe:calledElement processId.`,
				"Set the id of the process to call.",
			)
		}
		if (called?.attributes.propagateAllParentVariables === "false") {
			report(
				ctx,
				"no-propagate-all-parent-variables",
				el.id,
				`${label} sets propagateAllParentVariables="false", which needs Camunda ${FEATURE_SINCE.propagateAllParentVariablesFalse} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.propagateAllParentVariablesFalse),
			)
		}
		if (!isEmpty(called?.attributes.businessId)) {
			report(
				ctx,
				"no-business-id",
				el.id,
				`${label} sets a businessId, which needs Camunda ${FEATURE_SINCE.businessId} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.businessId),
			)
		}
	}

	if (el.type === "userTask") {
		checkNoExtension(ctx, "no-task-schedule", el.id, ext, "taskSchedule", label)
		checkNoExtension(ctx, "no-zeebe-user-task", el.id, ext, "userTask", label)
		checkNoExtension(ctx, "no-priority-definition", el.id, ext, "priorityDefinition", label)
		checkNoExtension(ctx, "no-task-listeners", el.id, ext, "taskListeners", label)

		if (!isEmpty(zeebe(ext, "assignmentDefinition")[0]?.attributes.candidateUsers)) {
			report(
				ctx,
				"no-candidate-users",
				el.id,
				`${label} assigns candidate users, which needs Camunda ${FEATURE_SINCE.candidateUsers} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.candidateUsers),
			)
		}
		if (zeebe(ext, "userTask").length !== 1) {
			report(
				ctx,
				"zeebe-user-task",
				el.id,
				`${label} is a job-worker user task; Camunda ${ctx.version} deprecates those in favour of Camunda user tasks.`,
				"Add zeebe:userTask to make it a Camunda user task.",
			)
		}

		const schedule = zeebe(ext, "taskSchedule")[0]
		for (const field of ["dueDate", "followUpDate"]) {
			const value = schedule?.attributes[field]
			if (value === undefined || value.startsWith("=") || isIsoDate(value)) continue
			report(
				ctx,
				"task-schedule",
				el.id,
				`${label} has ${field} "${value}", which is not an ISO 8601 date-time.`,
				'Write an ISO 8601 date-time (2026-01-01T09:00:00Z) or a FEEL expression starting with "=".',
			)
		}

		const priority = zeebe(ext, "priorityDefinition")[0]?.attributes.priority
		if (priority !== undefined && !priority.startsWith("=")) {
			const valid = /^\d+$/.test(priority) && Number(priority) <= 100
			if (!valid) {
				report(
					ctx,
					"priority-definition",
					el.id,
					`${label} has priority "${priority}"; Camunda takes a whole number from 0 to 100.`,
					'Use 0–100, or a FEEL expression starting with "=".',
				)
			}
		}

		for (const listener of children(zeebe(ext, "taskListeners")[0], "taskListener")) {
			if (isEmpty(listener.attributes.type)) {
				report(
					ctx,
					"task-listener",
					el.id,
					`${label} has a task listener with no job type.`,
					"Set the listener's type.",
				)
			}
		}
	}

	const headerHolders = new Set([
		"userTask",
		"serviceTask",
		"businessRuleTask",
		"scriptTask",
		"sendTask",
		"endEvent",
		"intermediateThrowEvent",
		"adHocSubProcess",
	])
	if (headerHolders.has(el.type)) {
		const keys = children(zeebe(ext, "taskHeaders")[0], "header").map((h) => h.attributes.key)
		const duplicates = new Set(
			keys.filter((key, i) => key !== undefined && keys.indexOf(key) !== i),
		)
		for (const key of duplicates) {
			report(
				ctx,
				"duplicate-task-headers",
				el.id,
				`${label} has more than one task header "${key}".`,
				"Remove the duplicate header.",
			)
		}
	}

	const io = zeebe(ext, "ioMapping")[0]
	for (const input of children(io, "input")) {
		if (isEmpty(input.attributes.target)) {
			report(
				ctx,
				"io-mapping",
				el.id,
				`${label} has an input mapping with no target.`,
				"Set the target.",
			)
		}
		if (
			isEmpty(input.attributes.source) &&
			!atLeast(ctx.version, FEATURE_SINCE.inputWithoutSource)
		) {
			report(
				ctx,
				"io-mapping",
				el.id,
				`${label} has an input mapping with no source, which needs Camunda ${FEATURE_SINCE.inputWithoutSource} or newer; ${targets(ctx)}.`,
				"Set the source.",
			)
		}
	}
	for (const output of children(io, "output")) {
		for (const field of ["source", "target"]) {
			if (isEmpty(output.attributes[field])) {
				report(
					ctx,
					"io-mapping",
					el.id,
					`${label} has an output mapping with no ${field}.`,
					`Set the ${field}.`,
				)
			}
		}
	}
}

/** `loop-characteristics` — only multi-instance, with an input collection. */
function checkLoop(ctx: Context, el: BpmnFlowElement): void {
	if (!ACTIVITIES.has(el.type)) return
	if (el.unknownChildren?.some((c) => c.name.endsWith("standardLoopCharacteristics"))) {
		report(
			ctx,
			"loop-characteristics",
			el.id,
			`${describe(el)} is a standard loop; Camunda only runs multi-instance loops.`,
			"Make it multi-instance, or model the loop with a gateway.",
		)
		return
	}
	const loop = "loopCharacteristics" in el ? el.loopCharacteristics : undefined
	if (loop === undefined) return
	const zeebeLoop = zeebe(loop.extensionElements, "loopCharacteristics")
	if (zeebeLoop.length !== 1) {
		report(
			ctx,
			"loop-characteristics",
			el.id,
			`${describe(el)} is multi-instance without a zeebe:loopCharacteristics.`,
			"Set the input collection to iterate over.",
		)
		return
	}
	const { inputCollection, outputCollection, outputElement } = (zeebeLoop[0] as XmlElement)
		.attributes
	if (isEmpty(inputCollection)) {
		report(
			ctx,
			"loop-characteristics",
			el.id,
			`${describe(el)} is multi-instance with no input collection.`,
			"Set the input collection to iterate over.",
		)
	}
	if (isEmpty(outputCollection) !== isEmpty(outputElement)) {
		report(
			ctx,
			"loop-characteristics",
			el.id,
			`${describe(el)} sets ${isEmpty(outputCollection) ? "an output element but no output collection" : "an output collection but no output element"}.`,
			"Set both the output collection and the output element, or neither.",
		)
	}
}

/** `ad-hoc-sub-process` — contents, completion and output collection. */
function checkAdHoc(ctx: Context, el: Extract<BpmnFlowElement, { type: "adHocSubProcess" }>): void {
	const label = describe(el)
	if (!el.flowElements.some((child) => ACTIVITIES.has(child.type))) {
		report(
			ctx,
			"ad-hoc-sub-process",
			el.id,
			`${label} contains no activity.`,
			"Add at least one task or sub-process to it.",
		)
	}
	const since = FEATURE_SINCE.adHocCompletion
	if (!atLeast(ctx.version, since)) {
		const used = [
			el.completionCondition !== undefined ? "a completion condition" : undefined,
			el.cancelRemainingInstances === false ? 'cancelRemainingInstances="false"' : undefined,
			...["outputCollection", "outputElement"].map((a) =>
				isEmpty(zeebe(el.extensionElements, "adHoc")[0]?.attributes[a]) ? undefined : a,
			),
		].filter((u) => u !== undefined)
		for (const feature of used) {
			report(
				ctx,
				"ad-hoc-sub-process",
				el.id,
				`${label} uses ${feature}, which needs Camunda ${since} or newer; ${targets(ctx)}.`,
				raise(since),
			)
		}
		if (used.length > 0) return
	}
	const adHoc = zeebe(el.extensionElements, "adHoc")[0]
	if (
		adHoc !== undefined &&
		isEmpty(adHoc.attributes.outputCollection) !== isEmpty(adHoc.attributes.outputElement)
	) {
		report(
			ctx,
			"ad-hoc-sub-process",
			el.id,
			`${label} sets only one of outputCollection and outputElement.`,
			"Set both, or neither.",
		)
	}
}

/** User task and start event forms. */
function checkForms(ctx: Context, el: BpmnFlowElement): void {
	if (el.type !== "userTask" && el.type !== "startEvent") return
	const label = describe(el)
	const forms = zeebe(el.extensionElements, "formDefinition")
	const form = forms[0]

	if (el.type === "userTask" && forms.length !== 1) {
		report(
			ctx,
			"user-task-definition",
			el.id,
			`${label} has no zeebe:formDefinition.`,
			"Link a form (formId), an external form, or an embedded form.",
		)
	}

	if (el.type === "startEvent" && form !== undefined) {
		if (!atLeast(ctx.version, FEATURE_SINCE.startEventForm)) {
			report(
				ctx,
				"start-event-form",
				el.id,
				`${label} has a form, which needs Camunda ${FEATURE_SINCE.startEventForm} or newer on a start event; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.startEventForm),
			)
			return
		}
		if (form.attributes.formKey?.startsWith("camunda-forms:bpmn:")) {
			report(
				ctx,
				"start-event-form-embedded",
				el.id,
				`${label} embeds its form; embedded forms on start events are deprecated.`,
				"Link a deployed form by formId instead.",
			)
		}
	}
	if (form === undefined) return

	const zeebeUserTask = el.type === "userTask" && zeebe(el.extensionElements, "userTask").length > 0
	let allowed: readonly string[]
	if (el.type === "startEvent") {
		allowed = ["formKey", "formId"]
	} else if (zeebeUserTask) {
		if (!atLeast(ctx.version, FEATURE_SINCE.zeebeUserTask)) return
		allowed = ["externalReference", "formId"]
	} else if (atLeast(ctx.version, FEATURE_SINCE.userTaskFormId)) {
		allowed = ["formKey", "formId"]
	} else {
		if (!isEmpty(form.attributes.formId)) {
			report(
				ctx,
				"user-task-form",
				el.id,
				`${label} links a form by formId, which needs Camunda ${FEATURE_SINCE.userTaskFormId} or newer; ${targets(ctx)}.`,
				raise(FEATURE_SINCE.userTaskFormId),
			)
			return
		}
		allowed = ["formKey"]
	}
	const set = allowed.filter((a) => !isEmpty(form.attributes[a]))
	if (set.length !== 1) {
		report(
			ctx,
			el.type === "startEvent" ? "start-event-form" : "user-task-form",
			el.id,
			`${label} has a zeebe:formDefinition that must set exactly one of ${allowed.join(", ")}.`,
			`Set one of ${allowed.join(", ")}.`,
		)
		return
	}

	const formKey = form.attributes.formKey
	if (formKey?.startsWith("camunda-forms:bpmn:")) {
		const id = formKey.slice("camunda-forms:bpmn:".length)
		const embedded = zeebe(ctx.process.extensionElements, "userTaskForm").find(
			(f) => f.attributes.id === id,
		)
		if (embedded !== undefined && (embedded.text ?? "").trim() === "") {
			report(
				ctx,
				el.type === "startEvent" ? "start-event-form" : "user-task-form",
				el.id,
				`${label} embeds form "${id}", which is empty.`,
				"Put the form's JSON in the zeebe:userTaskForm.",
			)
		}
	}
}

// ---------------------------------------------------------------------------
// Expressions, variables, secrets, connectors, agents and loops
// ---------------------------------------------------------------------------

/** Anything the plugin reports on: the process, a flow element or a sequence flow. */
type Owner = BpmnProcess | BpmnFlowElement | BpmnSequenceFlow

const DATA_ELEMENTS = new Set(["dataObject", "dataObjectReference", "dataStoreReference"])

/** The rules that read an element's expressions, properties and tool flow. */
function checkContents(ctx: Context): void {
	const owners: Owner[] = [
		ctx.process,
		...[...ctx.elements.values()].map((l) => l.el),
		...[...ctx.flows.values()].map((l) => l.el),
	]
	const unavailable = Object.keys(FEEL_BUILTIN_SINCE).filter(
		(name) => !atLeast(ctx.version, FEEL_BUILTIN_SINCE[name] as CamundaCompatVersion),
	)
	for (const owner of owners) {
		if (unavailable.length > 0) checkFeelCompatibility(ctx, owner, new Set(unavailable))
		checkConnectorProperties(ctx, owner)
		if ("sourceRef" in owner) {
			checkFromAiCondition(ctx, owner)
			continue
		}
		checkVariableNames(ctx, owner)
		checkSecrets(ctx, owner)
		checkSecretReferences(ctx, owner)
		checkListenerHeaders(ctx, owner)
		if ("type" in owner) {
			checkFromAi(ctx, owner)
			if (isToolEntry(ctx, owner)) checkToolOutput(ctx, owner)
		}
	}
	checkLinkEvents(ctx)
	checkNoLoop(ctx)
}

function truncate(value: string): string {
	return value.length > 10 ? `${value.slice(0, 10)}...` : value
}

/** Attributes `feel-compatibility` does not read, per Zeebe element (`utils/feel.js`). */
const NOT_FEEL: Readonly<Record<string, readonly string[]>> = {
	"zeebe:input": ["target"],
	"zeebe:output": ["target"],
	"zeebe:header": ["key", "value"],
	"zeebe:property": ["name", "value"],
	"zeebe:calledDecision": ["resultVariable"],
	"zeebe:script": ["resultVariable"],
}

/** The FEEL expressions (values starting with `=`) on an element and its extensions. */
function feelExpressions(owner: Owner): string[] {
	const values: (string | undefined)[] = [owner.documentation]
	const extension = (x: XmlElement): void => {
		if (!x.name.startsWith("zeebe:")) return
		const skipped = NOT_FEEL[x.name] ?? []
		for (const [key, value] of Object.entries(x.attributes)) {
			if (key !== "name" && !key.includes(":") && !skipped.includes(key)) values.push(value)
		}
		for (const child of x.children) extension(child)
	}
	for (const x of owner.extensionElements) extension(x)
	if ("conditionExpression" in owner) values.push(owner.conditionExpression?.text)
	if ("eventDefinitions" in owner) {
		for (const def of owner.eventDefinitions) {
			if (def.type === "timer") values.push(def.timeCycle, def.timeDate, def.timeDuration)
			if (def.type === "conditional") values.push(def.condition)
		}
	}
	const loop = "loopCharacteristics" in owner ? owner.loopCharacteristics : undefined
	if (loop !== undefined) {
		values.push(loop.loopCardinality?.text, loop.completionCondition?.text)
		for (const x of loop.extensionElements) extension(x)
	}
	if ("type" in owner && owner.type === "adHocSubProcess") {
		values.push(owner.completionCondition?.text)
	}
	return values.filter((v): v is string => v?.startsWith("=") === true)
}

/** `feel-compatibility` — a FEEL built-in newer than the target. */
function checkFeelCompatibility(
	ctx: Context,
	owner: Owner,
	unavailable: ReadonlySet<string>,
): void {
	for (const expression of feelExpressions(owner)) {
		const calls = feelBuiltinCalls(expression.slice(1), BUILTINS)
		const name = calls?.find((call) => unavailable.has(call))
		if (name === undefined) continue
		const since = FEEL_BUILTIN_SINCE[name] as CamundaCompatVersion
		report(
			ctx,
			"feel-compatibility",
			owner.id,
			`FEEL function <${name}> requires Camunda >=${since}`,
			`Target Camunda ${since} or newer (modeler:executionPlatformVersion), or do without ${name}().`,
		)
	}
}

const BUILTINS: ReadonlySet<string> = new Set(Object.keys(FEEL_BUILTIN_SINCE))

const VARIABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*$/

/** `variable-name` — the variables an element writes must be plain FEEL names. */
function checkVariableNames(ctx: Context, owner: BpmnProcess | BpmnFlowElement): void {
	const ext = owner.extensionElements
	const io = zeebe(ext, "ioMapping")[0]
	const written: (readonly [string, string | undefined])[] = [
		...children(io, "input").map((i) => ["input target", i.attributes.target] as const),
		...children(io, "output").map((o) => ["output target", o.attributes.target] as const),
	]
	const loop = "loopCharacteristics" in owner ? owner.loopCharacteristics : undefined
	const zeebeLoop = zeebe(loop?.extensionElements, "loopCharacteristics")[0]
	written.push(
		["input element", zeebeLoop?.attributes.inputElement],
		["output collection", zeebeLoop?.attributes.outputCollection],
	)
	const type = "type" in owner ? owner.type : "process"
	if (type === "scriptTask") {
		written.push(["result variable", zeebe(ext, "script")[0]?.attributes.resultVariable])
	}
	if (type === "businessRuleTask") {
		written.push(["result variable", zeebe(ext, "calledDecision")[0]?.attributes.resultVariable])
	}
	if (type === "adHocSubProcess") {
		written.push(["output collection", zeebe(ext, "adHoc")[0]?.attributes.outputCollection])
	}
	for (const [what, value] of written) {
		if (value === undefined || VARIABLE_NAME.test(value)) continue
		report(
			ctx,
			"variable-name",
			owner.id,
			`Property value of <${truncate(value)}> not allowed`,
			`The ${what} "${value}" is not a variable name: use letters, digits and underscores, not starting with a digit, with dots between nested names.`,
		)
	}
}

/**
 * `secrets` — the format a secret is written in: `deprecated` for a bare
 * `secrets.X`, `legacy` for `{{secrets.X}}` once `camunda.secrets.X` exists.
 */
function secretFormat(
	ctx: Context,
	value: string | undefined,
): "deprecated" | "legacy" | undefined {
	if (value === undefined || !value.includes("secrets.")) return undefined
	if (/camunda\.secrets\.(?:[\w-]+|`[^`]+`)/.test(value)) return undefined
	const legacy = /{{\s*secrets\.[\w-]+\s*}}/.test(value)
	if (atLeast(ctx.version, FEATURE_SINCE.camundaSecrets)) return legacy ? "legacy" : "deprecated"
	return legacy ? undefined : "deprecated"
}

/** `secrets` — input sources, property values and correlation keys. */
function checkSecrets(ctx: Context, owner: BpmnProcess | BpmnFlowElement): void {
	const values: [string, string | undefined][] = [
		...children(zeebe(owner.extensionElements, "ioMapping")[0], "input").map(
			(i): [string, string | undefined] => ["source", i.attributes.source],
		),
		...children(zeebe(owner.extensionElements, "properties")[0], "property").map(
			(p): [string, string | undefined] => ["value", p.attributes.value],
		),
	]
	if ("type" in owner) {
		const def = eventDefinitionOf(owner)
		const messageRef =
			owner.type === "receiveTask"
				? owner.messageRef
				: def?.type === "message"
					? def.messageRef
					: undefined
		const message = ctx.definitions.messages.find((m) => m.id === messageRef)
		const subscription = zeebe(message?.extensionElements, "subscription")[0]
		if (subscription !== undefined) {
			values.push(["correlationKey", subscription.attributes.correlationKey])
		}
	}
	for (const [property, value] of values) {
		const format = secretFormat(ctx, value)
		if (format === undefined) continue
		report(
			ctx,
			"secrets",
			owner.id,
			`Property <${property}> uses ${format} secret expression format`,
			atLeast(ctx.version, FEATURE_SINCE.camundaSecrets)
				? "Reference the secret as =camunda.secrets.NAME."
				: "Write the secret as {{secrets.NAME}}.",
		)
	}
}

/** `unresolvable-secret-reference` — `camunda.secrets.X` written where the engine cannot resolve it. */
function checkSecretReferences(ctx: Context, owner: BpmnProcess | BpmnFlowElement): void {
	const literal = (property: string, value: string | undefined): void => {
		if (value === undefined || !value.includes("secrets.")) return
		const inert = value.startsWith("=")
			? secretReferenceViolations(value.slice(1)).stringLiteral
			: SECRET_REFERENCE_LITERAL.test(value)
		if (!inert) return
		report(
			ctx,
			"unresolvable-secret-reference",
			owner.id,
			`Property <${property}> must use a secret reference as an expression (e.g. =camunda.secrets.NAME), not as a string literal`,
			"Write the reference as a FEEL expression, outside quotes.",
		)
	}
	for (const input of children(zeebe(owner.extensionElements, "ioMapping")[0], "input")) {
		const source = input.attributes.source
		literal("source", source)
		if (source === undefined || !source.includes("secrets.") || !source.startsWith("=")) continue
		const violations = secretReferenceViolations(source.slice(1))
		if (violations.insideList) {
			report(
				ctx,
				"unresolvable-secret-reference",
				owner.id,
				"Property <source> must not assign a secret reference inside a list",
				"Map the secret to a variable of its own, and build the list from that variable.",
			)
		}
		if (violations.insideIfBranchContext) {
			report(
				ctx,
				"unresolvable-secret-reference",
				owner.id,
				"Property <source> must not assign a secret reference inside a context returned by an if expression branch",
				"Map the secret to a variable of its own, and build the context from that variable.",
			)
		}
	}
	for (const property of children(zeebe(owner.extensionElements, "properties")[0], "property")) {
		literal("value", property.attributes.value)
	}
}

/** `connector-properties` — inbound connector properties newer than the target. */
function checkConnectorProperties(ctx: Context, owner: Owner): void {
	const properties = children(zeebe(owner.extensionElements, "properties")[0], "property")
	const named = (name: string) => properties.find((p) => p.attributes.name === name)
	const connector = named("inbound.type")?.attributes.value
	if (connector === undefined) return
	for (const [name, { since, connectors }] of Object.entries(INBOUND_CONNECTOR_PROPERTY_SINCE)) {
		if (atLeast(ctx.version, since) || !connectors.includes(connector)) continue
		if (named(name) === undefined) continue
		report(
			ctx,
			"connector-properties",
			owner.id,
			`Connector property <name> with value <${name}> only allowed by Camunda ${since} or newer.`,
			`Remove the ${name} property, or target Camunda ${since} or newer.`,
		)
	}
}

/** `duplicate-execution-listener-headers` — one header key twice on one listener. */
function checkListenerHeaders(ctx: Context, owner: BpmnProcess | BpmnFlowElement): void {
	const listeners = children(
		zeebe(owner.extensionElements, "executionListeners")[0],
		"executionListener",
	)
	for (const listener of listeners) {
		const headers = children(listener, "taskHeaders")[0]
		if (headers === undefined) continue
		const keys = children(headers, "header").map((h) => h.attributes.key)
		const duplicates = keys.filter((key, i) => keys.indexOf(key) !== i)
		for (const key of new Set(duplicates)) {
			report(
				ctx,
				"duplicate-execution-listener-headers",
				owner.id,
				`Properties of type <zeebe:Header> have property <key> with duplicate value of <${key}>`,
				"Remove the duplicate header from the execution listener.",
			)
		}
	}
}

/** `link-event` — link events need a name, and a link catch name must be unique in the process. */
function checkLinkEvents(ctx: Context): void {
	const linkDefinition = (el: BpmnFlowElement) => {
		const def = eventDefinitionOf(el)
		return def?.type === "link" ? def : undefined
	}
	for (const { el } of ctx.elements.values()) {
		if (el.type !== "intermediateCatchEvent" && el.type !== "intermediateThrowEvent") continue
		const def = linkDefinition(el)
		if (def === undefined || (def.name ?? "").trim() !== "") continue
		report(
			ctx,
			"link-event",
			el.id,
			"Element of type <bpmn:LinkEventDefinition> must have property <name>",
			"Name the link — a throw and its catch are paired by name.",
		)
	}

	const catches: BpmnFlowElement[] = []
	const collect = (elements: readonly BpmnFlowElement[]): void => {
		for (const el of elements) {
			if (el.type === "intermediateCatchEvent" && linkDefinition(el) !== undefined) catches.push(el)
			else if (isContainer(el)) collect(el.flowElements)
		}
	}
	collect(ctx.process.flowElements)
	const names = catches.map((el) => linkDefinition(el)?.name)
	const duplicates = new Set(names.filter((name, i) => name && names.indexOf(name) !== i))
	for (const name of duplicates) {
		for (const el of catches.filter((c) => linkDefinition(c)?.name === name)) {
			report(
				ctx,
				"link-event",
				el.id,
				`Property of type <bpmn:LinkEventDefinition> has property <name> with duplicate value of <${name}>`,
				"Give each link catch event in the process its own name.",
			)
		}
	}
}

// ── no-loop ─────────────────────────────────────────────────────────────────

/** Elements a straight-through loop can consist of — none of them waits. */
const LOOP_REQUIRED = new Set(["bpmn:CallActivity", "bpmn:ManualTask", "bpmn:Task"])
const LOOP_ELEMENTS = new Set([
	...LOOP_REQUIRED,
	"bpmn:StartEvent",
	"bpmn:EndEvent",
	"bpmn:ExclusiveGateway",
	"bpmn:InclusiveGateway",
	"bpmn:ParallelGateway",
	"bpmn:SubProcess",
])

interface LoopNode {
	element: string
	/** Neighbour → the elements the shortest known path to it passes. */
	incoming: Map<string, string[]>
	outgoing: Map<string, string[]>
	path?: string[]
}

/**
 * `no-loop` — a cycle of elements that never wait, which Zeebe would run
 * without end. A port of the plugin's rule: the graph is reduced to its
 * call activities, manual tasks and plain tasks, joined through the gateways,
 * start and end events and sub-processes between them, then searched
 * breadth-first. Kept literal, down to the visiting order, so the same loops
 * are found.
 */
function checkNoLoop(ctx: Context): void {
	const typeOf = (id: string) => {
		const el = ctx.elements.get(id)?.el
		return el === undefined ? undefined : bpmnType(el)
	}
	const next = (id: string): string[] => {
		const located = ctx.elements.get(id)
		if (located === undefined) return []
		let { el } = located
		if (el.type === "callActivity") {
			const processId = zeebe(el.extensionElements, "calledElement")[0]?.attributes.processId
			if (processId !== undefined && !processId.startsWith("=") && processId === ctx.process.id) {
				return ctx.process.flowElements.filter((e) => e.type === "startEvent").map((e) => e.id)
			}
		} else if (isContainer(el)) {
			return el.flowElements.filter((e) => e.type === "startEvent").map((e) => e.id)
		} else if (el.type === "endEvent" && located.parent !== undefined) {
			el = located.parent
		}
		return el.outgoing.flatMap((flowId) => {
			const target = ctx.flows.get(flowId)?.el.targetRef
			return target !== undefined && ctx.elements.has(target) ? [target] : []
		})
	}

	const graph = new Map<string, LoopNode>()
	const node = (id: string): LoopNode => {
		let found = graph.get(id)
		if (found === undefined) {
			found = { element: id, incoming: new Map(), outgoing: new Map() }
			graph.set(id, found)
		}
		return found
	}
	for (const id of ctx.elements.keys()) {
		if (!LOOP_ELEMENTS.has(typeOf(id) ?? "")) continue
		const current = node(id)
		for (const target of next(id)) {
			node(target).incoming.set(id, [])
			current.outgoing.set(target, [])
		}
	}

	// Drop every element that is not required, joining its neighbours directly.
	breadthFirst(graph, (n) => {
		if (!LOOP_REQUIRED.has(typeOf(n.element) ?? "")) {
			for (const [fromKey, fromPath] of n.incoming) {
				for (const [toKey, toPath] of n.outgoing) {
					const from = graph.get(fromKey)
					const to = graph.get(toKey)
					if (from === undefined || to === undefined) continue
					const path = [...fromPath, n.element, ...toPath]
					if (!from.outgoing.has(toKey)) from.outgoing.set(toKey, path)
					if (!to.incoming.has(fromKey)) to.incoming.set(fromKey, path)
				}
			}
			graph.delete(n.element)
		}
		return [...n.outgoing.keys()].map((key) => graph.get(key))
	})
	for (const { incoming, outgoing } of graph.values()) {
		for (const key of incoming.keys()) if (!graph.has(key)) incoming.delete(key)
		for (const key of outgoing.keys()) if (!graph.has(key)) outgoing.delete(key)
	}

	breadthFirst(graph, (n) => {
		const found: LoopNode[] = []
		for (const [target, via] of n.outgoing) {
			const path = [...(n.path ?? []), n.element, ...via]
			if (path.includes(target)) {
				const loop = path.slice(path.indexOf(target))
				if (!loop.some((id) => LOOP_REQUIRED.has(typeOf(id) ?? ""))) continue
				report(
					ctx,
					"no-loop",
					ctx.process.id,
					`Loop detected: ${loop.join(" -> ")} -> ${target}`,
					"Put a wait state in the loop — a service, user or receive task, or a catch event — or remove it.",
				)
			} else {
				const targetNode = graph.get(target) as LoopNode
				targetNode.path = targetNode.path ?? path
				found.push(targetNode)
			}
		}
		return found
	})
}

function breadthFirst(
	graph: ReadonlyMap<string, LoopNode>,
	visit: (node: LoopNode) => (LoopNode | undefined)[],
): void {
	const unvisited = new Set(graph.values())
	for (const first of unvisited) {
		unvisited.delete(first)
		const queue = [first]
		for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
			for (const next of visit(n)) {
				if (next === undefined || !unvisited.has(next)) continue
				unvisited.delete(next)
				queue.push(next)
			}
		}
	}
}

// ── Agent tools ─────────────────────────────────────────────────────────────

/** A `zeebe:property` the AI Agent templates set on an ad-hoc sub-process that holds tools. */
const TOOL_CONTAINER_PROPERTY = "io.camunda.agenticai.toolContainer"
/** The AI Agent job-worker template, whose older versions predate that property. */
const AI_AGENT_TEMPLATE = "io.camunda.connectors.agenticai.aiagent.jobworker.v1"
/** The job type of the AI Agent job worker, which forks of the template keep. */
const AI_AGENT_JOB_TYPE_PREFIX = "io.camunda.agenticai:aiagent-job-worker:"

/** Whether the agent rules lint this ad-hoc sub-process's tools (`isAgenticAdHocSubProcess`). */
function isAgentic(ctx: Context, adHoc: BpmnFlowElement): boolean {
	const ext = adHoc.extensionElements
	const marked = children(zeebe(ext, "properties")[0], "property").some(
		(p) => p.attributes.name === TOOL_CONTAINER_PROPERTY && p.attributes.value === "true",
	)
	return (
		marked ||
		adHoc.unknownAttributes["zeebe:modelerTemplate"] === AI_AGENT_TEMPLATE ||
		zeebe(ext, "taskDefinition")[0]?.attributes.type?.startsWith(AI_AGENT_JOB_TYPE_PREFIX) ===
			true ||
		(atLeast(ctx.version, FEATURE_SINCE.agentDefinition) &&
			zeebe(ext, "agentDefinition").length > 0)
	)
}

/** The nearest ad-hoc sub-process around an element or flow. */
function enclosingAdHoc(ctx: Context, parent: Container | undefined): Container | undefined {
	for (let p = parent; p !== undefined; p = ctx.elements.get(p.id)?.parent) {
		if (p.type === "adHocSubProcess") return p
	}
	return undefined
}

/** A tool: an activity directly in an agentic ad-hoc sub-process that nothing flows into. */
function isToolEntry(ctx: Context, el: BpmnFlowElement): boolean {
	const parent = ctx.elements.get(el.id)?.parent
	return (
		ACTIVITIES.has(el.type) &&
		!isEventSubProcess(el) &&
		el.incoming.length === 0 &&
		parent?.type === "adHocSubProcess" &&
		isAgentic(ctx, parent)
	)
}

interface ResultChannel {
	kind: "output" | "resultVariable" | "resultExpression"
	value: string
	source?: string
	element: BpmnFlowElement
}

/** Every write of a tool's result along its flow, and whether that flow is one straight chain. */
function resultChannels(
	ctx: Context,
	entry: BpmnFlowElement,
): { channels: ResultChannel[]; linear: boolean } {
	const channels: ResultChannel[] = []
	const visited = new Set<string>()
	const queue = [entry]
	let linear = true
	for (let el = queue.shift(); el !== undefined; el = queue.shift()) {
		if (visited.has(el.id)) continue
		visited.add(el.id)
		for (const x of el.extensionElements) {
			if (x.name === "zeebe:ioMapping") {
				for (const output of children(x, "output")) {
					const { target, source } = output.attributes
					channels.push({ kind: "output", value: target ?? "", source, element: el })
				}
			}
			if (x.name === "zeebe:script" || x.name === "zeebe:calledDecision") {
				const value = x.attributes.resultVariable
				if (value) channels.push({ kind: "resultVariable", value, element: el })
			}
			if (x.name === "zeebe:taskHeaders") {
				for (const header of children(x, "header")) {
					const { key, value } = header.attributes
					if (key === "resultVariable" || key === "resultExpression") {
						channels.push({ kind: key, value: value ?? "", element: el })
					}
				}
			}
		}
		if (el.outgoing.length > 1 || el.incoming.length > 1) linear = false
		for (const flowId of el.outgoing) {
			const target = ctx.elements.get(ctx.flows.get(flowId)?.el.targetRef ?? "")?.el
			if (target !== undefined) queue.push(target)
		}
		const parent = ctx.elements.get(el.id)?.parent
		for (const sibling of parent?.flowElements ?? ctx.process.flowElements) {
			if (sibling.type === "boundaryEvent" && sibling.attachedToRef === el.id) {
				linear = false
				queue.push(sibling)
			}
		}
		if (isContainer(el)) {
			queue.push(...el.flowElements.filter((child) => !DATA_ELEMENTS.has(child.type)))
		}
	}
	return { channels, linear }
}

function writesToolCallResult({ kind, value }: ResultChannel): boolean {
	if (kind === "resultExpression") return /\btoolCallResult\b/.test(value)
	return value === "toolCallResult" || value.startsWith("toolCallResult.")
}

/** The first `toolCallResult` written in the wrong case, if any. */
function miscased(channel: ResultChannel): string | undefined {
	if (channel.kind === "resultExpression") {
		return (channel.value.match(/\btoolcallresult\b/gi) ?? []).find((t) => t !== "toolCallResult")
	}
	const lower = channel.value.toLowerCase()
	const variant = lower === "toolcallresult" || lower.startsWith("toolcallresult.")
	return variant && !writesToolCallResult(channel) ? channel.value : undefined
}

/** A write that replaces `toolCallResult` whole, rather than a part of it or `context put()` onto it. */
function overwrites({ kind, value, source }: ResultChannel): boolean {
	if (kind !== "output") return true
	if (value !== "toolCallResult") return false
	return !/^=?\s*context\s+put\s*\(\s*toolCallResult\s*,/.test(source ?? "")
}

/** `agent-tool-output-key` — a tool must hand its result back as `toolCallResult`. */
function checkToolOutput(ctx: Context, entry: BpmnFlowElement): void {
	const { channels, linear } = resultChannels(ctx, entry)
	const rule = "agent-tool-output-key"
	const casing = (channel: ResultChannel, text: string) =>
		report(
			ctx,
			rule,
			channel.element.id,
			`Wrong casing "${text}": use toolCallResult (case-sensitive).`,
			"Write toolCallResult exactly; Camunda reads variable names case-sensitively.",
		)
	if (channels.length === 0) {
		report(
			ctx,
			rule,
			entry.id,
			'Tool returns nothing to the agent. Set a "toolCallResult" (at minimum, note the task completed).',
			"Add an output mapping with target toolCallResult.",
		)
		return
	}
	if (!channels.some(writesToolCallResult)) {
		for (const channel of channels) {
			const wrong = miscased(channel)
			if (wrong !== undefined) {
				casing(channel, wrong)
				continue
			}
			report(
				ctx,
				rule,
				channel.element.id,
				'"toolCallResult" output is not mapped.',
				"Map the tool's result to toolCallResult — the agent reads nothing else.",
			)
		}
		return
	}
	for (const channel of channels) {
		const wrong = miscased(channel)
		if (wrong !== undefined) casing(channel, wrong)
	}
	if (!linear) return
	const writes = channels.filter((c) => writesToolCallResult(c) && overwrites(c))
	for (let i = 1; i < writes.length; i++) {
		const earlier = (writes[i - 1] as ResultChannel).element
		report(
			ctx,
			rule,
			(writes[i] as ResultChannel).element.id,
			`This overwrites the "toolCallResult" value set on "${earlier.name || earlier.id}".`,
			"Write parts of the result (toolCallResult.part), or combine them with context put(toolCallResult, ...).",
		)
	}
}

/** `agent-fromai-contract` on a sequence flow's condition. */
function checkFromAiCondition(ctx: Context, flow: BpmnSequenceFlow): void {
	const body = flow.conditionExpression?.text
	if (body === undefined || !body.startsWith("=")) return
	const calls = fromAiCalls(body.slice(1).trim())
	const adHoc = enclosingAdHoc(ctx, ctx.flows.get(flow.id)?.parent)
	if (calls.length === 0 || adHoc === undefined || !isAgentic(ctx, adHoc)) return
	for (const _ of calls) {
		report(
			ctx,
			"agent-fromai-contract",
			flow.id,
			"fromAi() defines a tool input and cannot be used in a sequence flow condition. Define it in an input mapping on the tool's entry element.",
			"Read the value from the toolCall variable instead.",
		)
	}
}

/** Why a `fromAi()` key argument cannot name a tool parameter, if it cannot. */
function fromAiKeyProblem(arg: { type: string; text: string }): string | undefined {
	switch (arg.type) {
		case "StringLiteral":
			return `fromAi() key must be a FEEL path, not a string literal. Remove the quotes around ${arg.text}.`
		case "null":
			return 'fromAi() key must be a FEEL path starting with "toolCall.", not null.'
		case "NumericLiteral":
			return 'fromAi() key must be a FEEL path starting with "toolCall.", not a number.'
		case "ArithmeticExpression":
			return 'fromAi() key must be a FEEL path starting with "toolCall.", not an arithmetic expression.'
		case "FilterExpression":
			return 'fromAi() key must use dot notation, not bracket notation. Use toolCall.name instead of toolCall["name"].'
		case "VariableName":
			return `fromAi() key must start with "toolCall.". Use toolCall.${arg.text} instead of a bare name.`
		case "PathExpression": {
			if (!arg.text.startsWith("toolCall.")) {
				return `fromAi() key must start with "toolCall.". Got ${arg.text}.`
			}
			const segments = arg.text.split(".")
			return segments.length > 2
				? `fromAi() key must be a single name under toolCall. Use toolCall.${segments[segments.length - 1]} instead of ${arg.text}.`
				: undefined
		}
		case "IfExpression":
			return 'fromAi() key must be a FEEL path starting with "toolCall.", not a conditional expression. The connector requires a plain reference regardless of which branch would apply at runtime.'
		default:
			return `fromAi() key must be a FEEL path starting with "toolCall.", not a ${arg.type}.`
	}
}

/**
 * `agent-fromai-contract` — `fromAi()` only defines a tool input in an input
 * mapping of a tool's entry element, with a `toolCall.<name>` key and a
 * literal description.
 */
function checkFromAi(ctx: Context, el: BpmnFlowElement): void {
	const rule = "agent-fromai-contract"
	const parent = ctx.elements.get(el.id)?.parent
	const adHoc = enclosingAdHoc(ctx, parent)
	const agentic = adHoc !== undefined && isAgentic(ctx, adHoc)
	const mappings = zeebe(el.extensionElements, "ioMapping")
	const say = (message: string, suggestion: string) => report(ctx, rule, el.id, message, suggestion)

	if (ACTIVITIES.has(el.type) && el.incoming.length === 0 && agentic && parent === adHoc) {
		const keys = new Map<string, number>()
		for (const input of children(mappings[0], "input")) {
			const source = input.attributes.source
			if (source === undefined || !source.startsWith("=")) continue
			for (const call of fromAiCalls(source.slice(1).trim())) {
				const key = call.args[0]
				if (key?.type === "PathExpression" && key.text.startsWith("toolCall.")) {
					keys.set(key.text, (keys.get(key.text) ?? 0) + 1)
				}
			}
		}
		for (const [key, count] of keys) {
			if (count < 2) continue
			say(
				`fromAi() key ${key} is declared more than once in this tool. Declare it once and reference it directly elsewhere.`,
				"Declare each tool parameter once.",
			)
		}
	}

	if (DATA_ELEMENTS.has(el.type)) return
	for (const mapping of mappings) {
		for (const output of children(mapping, "output")) {
			const source = output.attributes.source
			if (source === undefined || !source.startsWith("=") || !agentic) continue
			for (const _ of fromAiCalls(source.slice(1).trim())) {
				say(
					"fromAi() defines a tool input and has no effect in an output mapping. Define it in an input mapping on the tool's entry element.",
					"Move the fromAi() call to an input mapping.",
				)
			}
		}
		for (const input of children(mapping, "input")) {
			const source = input.attributes.source
			if (source === undefined || !source.startsWith("=")) continue
			const calls = fromAiCalls(source.slice(1).trim())
			if (calls.length === 0) continue
			if (adHoc === undefined || !agentic || el.incoming.length > 0 || parent !== adHoc) {
				const [message, suggestion] =
					adHoc === undefined
						? [
								"fromAi() should only be used inside an agentic sub-process.",
								"Use fromAi() only in a tool of an AI Agent ad-hoc sub-process.",
							]
						: !agentic
							? [
									`The "${adHoc.name || adHoc.id}" sub-process is not marked as agentic, so fromAi() has no effect.`,
									`Set the zeebe:property ${TOOL_CONTAINER_PROPERTY}="true" on the ad-hoc sub-process, or apply the AI Agent template.`,
								]
							: [
									"fromAi() is ignored here: only the tool's entry element defines AI inputs. Define it there and read the toolCall variable directly.",
									"Move the fromAi() call to the tool's first element.",
								]
				for (const _ of calls) say(message, suggestion)
				continue
			}
			for (const call of calls) {
				if (call.name !== "fromAi") {
					say(
						`Wrong function name "${call.name}". Use fromAi (case-sensitive).`,
						"Write fromAi exactly.",
					)
					continue
				}
				const [key, description] = call.args
				if (key === undefined) {
					say(
						"fromAi() requires a key argument: a FEEL path like toolCall.url.",
						"Pass the parameter as fromAi(toolCall.name, ...).",
					)
					continue
				}
				const problem = fromAiKeyProblem(key)
				if (problem !== undefined) say(problem, "Pass the parameter as fromAi(toolCall.name, ...).")
				if (description !== undefined && description.type !== "StringLiteral") {
					say(
						"fromAi() description must be a string literal: a quoted string describing what the agent should provide.",
						'Describe the parameter in a quoted string: fromAi(toolCall.name, "…").',
					)
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Existing checks
// ---------------------------------------------------------------------------

/** Whether a finding comes from the Camunda-version compatibility check (`compat/…`). */
export function isCamundaCompatFinding(finding: Pick<OptimizationFinding, "id">): boolean {
	return finding.id.startsWith("compat/")
}

/**
 * Drops the compatibility findings another BPMN Kit check already reports on
 * the same element — `compat/implementation` where `deploy/service-task-no-type`
 * fired, and so on through each rule's `equivalents`. Keeps the existing
 * finding: it is the one fixes and docs point at.
 *
 * @param findings - Every finding of one `optimize()` run.
 */
export function dedupeCamundaCompat(
	findings: readonly OptimizationFinding[],
): OptimizationFinding[] {
	const reported = new Set(findings.map((f) => `${f.id}\u0000${f.elementIds[0] ?? ""}`))
	return findings.filter((f) => {
		if (!isCamundaCompatFinding(f)) return true
		const equivalents = CAMUNDA_COMPAT_RULES[f.id.slice("compat/".length)]?.equivalents ?? []
		return !equivalents.some((id) => reported.has(`${id}\u0000${f.elementIds[0] ?? ""}`))
	})
}

// ---------------------------------------------------------------------------
// .bpmnlintrc
// ---------------------------------------------------------------------------

const PLUGIN_NAMES = ["camunda-compat", "bpmnlint-plugin-camunda-compat"]
const RULE_PREFIX = "camunda-compat/"

/** A `.bpmnlintrc`'s camunda-compat part, split off by {@link splitCamundaCompatConfig}. */
export interface CamundaCompatConfig {
	/** The version a `plugin:camunda-compat/camunda-cloud-X-Y` extends pins, if any. */
	version?: CamundaCompatVersion
	/** Plugin rule name (without `camunda-compat/`) → its effective setting. */
	rules: Record<string, BpmnlintRuleSetting>
}

/**
 * Takes the `bpmnlint-plugin-camunda-compat` part out of a resolved
 * `.bpmnlintrc`, so BPMN Kit's own compatibility check can stand in for it.
 *
 * - `extends: "plugin:camunda-compat/camunda-cloud-8-6"` (or the
 *   `bpmnlint-plugin-camunda-compat` spelling) pins the target to 8.6 and
 *   enables that config's rules at the plugin's severities; the last such
 *   entry wins. It also enables bpmnlint's `start-event-required`, as the
 *   plugin's configs do.
 * - `camunda-compat/<rule>` entries under `rules` override those severities.
 * - Everything else stays in `rest`, for `applyBpmnlintConfig`.
 *
 * @param config - A resolved `.bpmnlintrc`.
 * @returns `compat` when the file mentions the plugin at all, and the rest.
 */
export function splitCamundaCompatConfig(config: ResolvedBpmnlintConfig): {
	compat?: CamundaCompatConfig
	rest: ResolvedBpmnlintConfig
} {
	let version: CamundaCompatVersion | undefined
	let mentioned = false
	const unresolvedExtends: string[] = []
	for (const entry of config.unresolvedExtends) {
		const match = /^plugin:([^/]+)\/camunda-cloud-(\d+)-(\d+)$/.exec(entry)
		const found =
			match !== null && PLUGIN_NAMES.includes(match[1] as string)
				? normalizeCamundaVersion(`${match[2]}.${match[3]}`)
				: undefined
		if (found === undefined) {
			unresolvedExtends.push(entry)
			continue
		}
		version = found
		mentioned = true
	}

	const compatRules: Record<string, BpmnlintRuleSetting> = {}
	if (version !== undefined) {
		for (const [rule, entry] of Object.entries(CAMUNDA_COMPAT_RULES)) {
			if (ruleActive(rule, version)) compatRules[rule] = { severity: entry.severity }
		}
	}
	const rules: Record<string, BpmnlintRuleSetting> = {}
	for (const [name, setting] of Object.entries(config.rules)) {
		if (name.startsWith(RULE_PREFIX)) {
			compatRules[name.slice(RULE_PREFIX.length)] = setting
			mentioned = true
		} else {
			rules[name] = setting
		}
	}
	if (version !== undefined && rules["start-event-required"] === undefined) {
		rules["start-event-required"] = { severity: "error" }
	}

	const rest = { rules, unresolvedExtends }
	if (!mentioned) return { rest: config }
	return {
		compat: version !== undefined ? { version, rules: compatRules } : { rules: compatRules },
		rest,
	}
}

const CONFIG_SEVERITY: Record<
	Exclude<BpmnlintRuleSetting["severity"], "off">,
	OptimizationSeverity
> = {
	error: "error",
	warn: "warning",
	info: "info",
}

/**
 * Applies the camunda-compat part of a `.bpmnlintrc` to a set of findings.
 *
 * A finding a configured plugin rule governs — its `compat/<rule>` findings
 * and the `equivalents` standing in for it — takes the rule's severity and
 * name, or is dropped when the rule is `off`, or when real bpmnlint already
 * ran it (`delegated`). Configured rules BPMN Kit does not check come back as
 * `unsupported`.
 *
 * @param findings - Output of `optimize()`, possibly filtered.
 * @param compat - From {@link splitCamundaCompatConfig}.
 * @param options - `delegated`: the project's bpmnlint reported these rules.
 */
export function applyCamundaCompatConfig(
	findings: readonly OptimizationFinding[],
	compat: CamundaCompatConfig,
	options: { delegated?: boolean } = {},
): { findings: OptimizationFinding[]; unsupported: UnsupportedBpmnlintRule[] } {
	const governing = new Map<string, string>()
	for (const rule of Object.keys(compat.rules)) {
		governing.set(`compat/${rule}`, rule)
		for (const id of CAMUNDA_COMPAT_RULES[rule]?.equivalents ?? []) governing.set(id, rule)
	}

	const result: OptimizationFinding[] = []
	for (const finding of findings) {
		const rule = governing.get(finding.id)
		const setting = rule === undefined ? undefined : compat.rules[rule]
		if (rule === undefined || setting === undefined) {
			result.push(finding)
			continue
		}
		if (options.delegated === true || setting.severity === "off") continue
		result.push({
			...finding,
			severity: CONFIG_SEVERITY[setting.severity],
			bpmnlintRule: `${RULE_PREFIX}${rule}`,
		})
	}

	const unsupported: UnsupportedBpmnlintRule[] =
		options.delegated === true
			? []
			: Object.entries(compat.rules)
					.filter(([rule, setting]) => {
						const coverage = CAMUNDA_COMPAT_RULES[rule]?.coverage
						return (
							setting.severity !== "off" &&
							(coverage === undefined || coverage === "not-implemented")
						)
					})
					.map(([rule, setting]) => ({
						name: `${RULE_PREFIX}${rule}`,
						reason: "plugin-rule",
						severity: setting.severity,
					}))
	return { findings: result, unsupported }
}
