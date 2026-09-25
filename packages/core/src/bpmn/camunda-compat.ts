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
	IMPLEMENTATION_SUPPORT,
	type ImplementationKind,
	TIMER_SUPPORT,
	type TimerProperty,
} from "./camunda-compat-data.js"
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
		}
		checkProcess(ctx)
		checkScope(ctx, process.flowElements, process.sequenceFlows, undefined)
		checkCollapsed(ctx)
	}
	return findings
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
