import type {
	BpmnDefinitions,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnLaneSet,
	BpmnMultiInstanceLoopCharacteristics,
	BpmnSequenceFlow,
} from "../bpmn/bpmn-model.js"
import { exportSvg } from "../bpmn/svg.js"
import type { DmnDefinitions } from "../dmn/dmn-model.js"
import type { FormComponent, FormDefinition } from "../form/form-model.js"
import type { XmlElement } from "../types/xml-element.js"

// ── Public model ─────────────────────────────────────────────────────────────

/** Options shared by every process documentation renderer. */
export interface DocumentationOptions {
	/** Document title. Defaults to the first pool / process name, then the definitions id. */
	title?: string
	/** DMN models whose decision tables are documented after the processes. */
	decisions?: DmnDefinitions[]
	/** Camunda forms whose fields are documented after the processes. */
	forms?: FormDefinition[]
	/** Include the diagram as an SVG image. Default `true`. Needs diagram interchange (DI) data. */
	diagram?: boolean
	/**
	 * A line printed under the title, e.g. a version or a date. Nothing is added
	 * by default, so the same model always produces byte-identical output.
	 */
	subtitle?: string
}

/** A reference from an element to a decision or form documented in the same document. */
export interface DocumentationLink {
	kind: "decision" | "form"
	id: string
}

/** One labelled fact about an element, e.g. `Job type: payment-charge`. */
export interface DocumentedProperty {
	label: string
	/** One value, or several (rendered as a list). */
	value: string | string[]
	/** Set when the value names a decision or form included in the document. */
	link?: DocumentationLink
}

/** A flow element, in flow order, with everything a reader needs to know about it. */
export interface DocumentedElement {
	id: string
	name?: string
	/** The BPMN element type, e.g. `serviceTask`. */
	type: BpmnFlowElement["type"]
	/** Readable type, e.g. `Timer start event` or `Error boundary event (non-interrupting)`. */
	typeLabel: string
	/** Outline number: `3`, or `3.2` for the second element inside element 3. */
	number: string
	/** Nesting depth: 0 for a process-level element, 1 inside a sub-process, and so on. */
	depth: number
	/** The lane (performer) the element sits in, if the process has lanes. */
	lane?: string
	documentation?: string
	properties: DocumentedProperty[]
}

/** A lane (performer) and the elements it owns. */
export interface DocumentedLane {
	id: string
	name: string
	/** Parent lane names, outermost first, for nested lanes. */
	path: string[]
	documentation?: string
	/** Names (or ids) of the lane's elements, in flow order. */
	elements: string[]
}

/** One process, or the process behind one pool. */
export interface DocumentedProcess {
	id: string
	/** Pool name, process name or id, in that order. */
	title: string
	/** The pool (participant) name, when the process is drawn as a pool. */
	participant?: string
	documentation?: string
	executable: boolean
	lanes: DocumentedLane[]
	elements: DocumentedElement[]
}

/** A message flow between pools. */
export interface DocumentedMessageFlow {
	id: string
	name?: string
	from: string
	to: string
	message?: string
	documentation?: string
}

/** A DMN decision table. */
export interface DocumentedDecision {
	id: string
	name: string
	hitPolicy: string
	inputs: string[]
	outputs: string[]
	/** One row per rule: input entries, then output entries, then the annotation. */
	rules: string[][]
	/** Names of the elements that call this decision. */
	calledBy: string[]
}

/** A form field. Group and dynamic-list children are flattened, their label path joined by ` / `. */
export interface DocumentedFormField {
	label: string
	key: string
	type: string
	required: boolean
	/** Selectable values, or the expression / key they come from. */
	options: string
}

/** A Camunda form. */
export interface DocumentedForm {
	id: string
	fields: DocumentedFormField[]
	/** Names of the user tasks and start events that show this form. */
	usedBy: string[]
}

/** The documentation of one BPMN model, ready for a renderer. */
export interface ProcessDocumentation {
	title: string
	subtitle?: string
	documentation?: string
	/** The diagram as SVG, or undefined when disabled or when the model has no DI. */
	diagramSvg?: string
	processes: DocumentedProcess[]
	messageFlows: DocumentedMessageFlow[]
	decisions: DocumentedDecision[]
	forms: DocumentedForm[]
}

// ── Labels ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<BpmnFlowElement["type"], string> = {
	startEvent: "Start event",
	endEvent: "End event",
	intermediateThrowEvent: "Intermediate throw event",
	intermediateCatchEvent: "Intermediate catch event",
	boundaryEvent: "Boundary event",
	task: "Task",
	serviceTask: "Service task",
	scriptTask: "Script task",
	userTask: "User task",
	sendTask: "Send task",
	receiveTask: "Receive task",
	businessRuleTask: "Business rule task",
	manualTask: "Manual task",
	callActivity: "Call activity",
	exclusiveGateway: "Exclusive gateway",
	parallelGateway: "Parallel gateway",
	inclusiveGateway: "Inclusive gateway",
	eventBasedGateway: "Event-based gateway",
	complexGateway: "Complex gateway",
	subProcess: "Sub-process",
	adHocSubProcess: "Ad-hoc sub-process",
	eventSubProcess: "Event sub-process",
	transaction: "Transaction",
	dataObject: "Data object",
	dataObjectReference: "Data object",
	dataStoreReference: "Data store",
}

const EVENT_KIND: Record<BpmnEventDefinition["type"], string> = {
	timer: "Timer",
	error: "Error",
	escalation: "Escalation",
	message: "Message",
	signal: "Signal",
	conditional: "Conditional",
	link: "Link",
	cancel: "Cancel",
	terminate: "Terminate",
	compensate: "Compensation",
}

function eventDefinitionsOf(el: BpmnFlowElement): BpmnEventDefinition[] {
	return "eventDefinitions" in el ? el.eventDefinitions : []
}

function typeLabelOf(el: BpmnFlowElement): string {
	const base = TYPE_LABELS[el.type]
	const defs = eventDefinitionsOf(el)
	const first = defs[0]
	let label = base
	if (first) {
		const kind = defs.length > 1 ? "Multiple" : EVENT_KIND[first.type]
		label = `${kind} ${base.charAt(0).toLowerCase()}${base.slice(1)}`
	}
	if (el.type === "boundaryEvent" && el.cancelActivity === false) label += " (non-interrupting)"
	if (el.type === "startEvent" && el.isInterrupting === false) label += " (non-interrupting)"
	if (el.type === "subProcess" && el.triggeredByEvent) label = "Event sub-process"
	return label
}

// ── Raw extension lookups ────────────────────────────────────────────────────

function localName(name: string): string {
	const i = name.indexOf(":")
	return i >= 0 ? name.slice(i + 1) : name
}

function child(elements: XmlElement[] | undefined, name: string): XmlElement | undefined {
	return elements?.find((e) => localName(e.name) === name)
}

function children(elements: XmlElement[] | undefined, name: string): XmlElement[] {
	return (elements ?? []).filter((e) => localName(e.name) === name)
}

function nonEmpty(value: string | undefined): value is string {
	return value !== undefined && value.trim() !== ""
}

// ── ISO 8601 durations ───────────────────────────────────────────────────────

const DURATION_UNITS: Array<[RegExp, string]> = [
	[/(\d+(?:\.\d+)?)Y/, "year"],
	[/(\d+(?:\.\d+)?)M/, "month"],
	[/(\d+(?:\.\d+)?)W/, "week"],
	[/(\d+(?:\.\d+)?)D/, "day"],
]
const TIME_UNITS: Array<[RegExp, string]> = [
	[/(\d+(?:\.\d+)?)H/, "hour"],
	[/(\d+(?:\.\d+)?)M/, "minute"],
	[/(\d+(?:\.\d+)?)S/, "second"],
]

/** `PT48H` → `48 hours`. Returns undefined for anything that is not a plain ISO duration. */
export function humanizeDuration(value: string): string | undefined {
	const m = /^P(?!$)([^T]*)(?:T(?=.)(.*))?$/.exec(value.trim())
	if (!m) return undefined
	const date = m[1] ?? ""
	const time = m[2] ?? ""
	if (!/^(\d+(\.\d+)?[YMWD])*$/.test(date) || !/^(\d+(\.\d+)?[HMS])*$/.test(time)) return undefined
	const parts: string[] = []
	const push = (n: string, unit: string) => parts.push(`${n} ${unit}${n === "1" ? "" : "s"}`)
	for (const [re, unit] of DURATION_UNITS) {
		const hit = re.exec(date)
		if (hit?.[1]) push(hit[1], unit)
	}
	for (const [re, unit] of TIME_UNITS) {
		const hit = re.exec(time)
		if (hit?.[1]) push(hit[1], unit)
	}
	return parts.length > 0 ? parts.join(" ") : undefined
}

function describeTimerValue(value: string): string {
	const trimmed = value.trim()
	const plain = humanizeDuration(trimmed)
	if (plain) return `${trimmed} (${plain})`
	const cycle = /^R(\d*)\/(P[^/]+)$/.exec(trimmed)
	const every = cycle?.[2] ? humanizeDuration(cycle[2]) : undefined
	if (cycle && every) {
		const times = cycle[1] ? `, ${cycle[1]} times` : ""
		return `${trimmed} (every ${every}${times})`
	}
	return trimmed
}

// ── Flow ordering ────────────────────────────────────────────────────────────

/**
 * Orders a scope's elements by the flow rather than by the XML.
 *
 * Reverse post-order of a depth-first walk from the start events, with each
 * element's successors visited last-first so the first outgoing branch is
 * printed first and a branch stays together up to its join. Back edges (loops)
 * are ignored by construction. Boundary events follow their host's normal
 * successors. Anything the walk cannot reach — event sub-processes, orphans,
 * data objects — is appended in XML order, each ordered the same way.
 */
function flowOrder(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[]): BpmnFlowElement[] {
	const byId = new Map(elements.map((e) => [e.id, e] as const))
	const successors = new Map<string, string[]>()
	for (const e of elements) successors.set(e.id, [])
	for (const f of flows) {
		if (byId.has(f.sourceRef) && byId.has(f.targetRef))
			successors.get(f.sourceRef)?.push(f.targetRef)
	}
	for (const e of elements) {
		if (e.type === "boundaryEvent" && byId.has(e.attachedToRef)) {
			successors.get(e.attachedToRef)?.push(e.id)
		}
	}

	const visited = new Set<string>()
	const walk = (roots: string[]): BpmnFlowElement[] => {
		const post: string[] = []
		// Iterative DFS: a deep process must not blow the stack.
		for (const root of [...roots].reverse()) {
			if (visited.has(root)) continue
			visited.add(root)
			const stack: Array<{ id: string; next: string[] }> = [
				{ id: root, next: [...(successors.get(root) ?? [])] },
			]
			while (stack.length > 0) {
				const top = stack[stack.length - 1]
				if (!top) break
				const nextId = top.next.pop()
				if (nextId === undefined) {
					post.push(top.id)
					stack.pop()
					continue
				}
				if (visited.has(nextId)) continue
				visited.add(nextId)
				stack.push({ id: nextId, next: [...(successors.get(nextId) ?? [])] })
			}
		}
		return post.reverse().flatMap((id) => byId.get(id) ?? [])
	}

	const starts = elements.filter((e) => e.type === "startEvent").map((e) => e.id)
	const ordered = walk(starts)
	for (const e of elements) {
		if (!visited.has(e.id)) ordered.push(...walk([e.id]))
	}
	return ordered
}

// ── Builder ──────────────────────────────────────────────────────────────────

interface Scope {
	flowElements: BpmnFlowElement[]
	sequenceFlows: BpmnSequenceFlow[]
}

function isScope(el: BpmnFlowElement): el is BpmnFlowElement & Scope {
	return "flowElements" in el
}

interface Ctx {
	defs: BpmnDefinitions
	/** Element id → display name. */
	names: Map<string, string>
	decisionIds: Set<string>
	formIds: Set<string>
	/** decisionId → callers. */
	decisionCallers: Map<string, string[]>
	/** formId → users. */
	formUsers: Map<string, string[]>
}

function displayName(el: { id: string; name?: string }): string {
	return nonEmpty(el.name) ? el.name.trim() : el.id
}

function collectNames(elements: BpmnFlowElement[], into: Map<string, string>): void {
	for (const el of elements) {
		into.set(el.id, displayName(el))
		if (isScope(el)) collectNames(el.flowElements, into)
	}
}

function laneMapOf(laneSet: BpmnLaneSet | undefined): {
	lanes: Array<{ id: string; name: string; path: string[]; documentation?: string; refs: string[] }>
	byElement: Map<string, string>
} {
	const lanes: Array<{
		id: string
		name: string
		path: string[]
		documentation?: string
		refs: string[]
	}> = []
	const byElement = new Map<string, string>()
	const visit = (set: BpmnLaneSet | undefined, path: string[]): void => {
		for (const lane of set?.lanes ?? []) {
			const name = displayName(lane)
			lanes.push({
				id: lane.id,
				name,
				path,
				documentation: lane.documentation,
				refs: lane.flowNodeRefs,
			})
			// Inner lanes are visited after, so the innermost lane wins.
			for (const ref of lane.flowNodeRefs) byElement.set(ref, name)
			visit(lane.childLaneSet, [...path, name])
		}
	}
	visit(laneSet, [])
	return { lanes, byElement }
}

function describeEventDefinition(def: BpmnEventDefinition, ctx: Ctx): DocumentedProperty[] {
	const out: DocumentedProperty[] = []
	switch (def.type) {
		case "timer": {
			if (nonEmpty(def.timeDuration))
				out.push({ label: "Timer duration", value: describeTimerValue(def.timeDuration) })
			if (nonEmpty(def.timeDate)) out.push({ label: "Timer date", value: def.timeDate.trim() })
			if (nonEmpty(def.timeCycle))
				out.push({ label: "Timer cycle", value: describeTimerValue(def.timeCycle) })
			break
		}
		case "message": {
			const msg = ctx.defs.messages.find((m) => m.id === def.messageRef)
			if (msg) {
				out.push({ label: "Message", value: displayName(msg) })
				const key = child(msg.extensionElements, "subscription")?.attributes.correlationKey
				if (nonEmpty(key)) out.push({ label: "Correlation key", value: key })
			} else if (nonEmpty(def.messageRef)) {
				out.push({ label: "Message", value: def.messageRef })
			}
			break
		}
		case "error": {
			const err = ctx.defs.errors.find((e) => e.id === def.errorRef)
			if (err) {
				out.push({ label: "Error", value: displayName(err) })
				if (nonEmpty(err.errorCode)) out.push({ label: "Error code", value: err.errorCode })
			} else if (nonEmpty(def.errorRef)) {
				out.push({ label: "Error", value: def.errorRef })
			} else {
				out.push({ label: "Error", value: "Any error" })
			}
			break
		}
		case "escalation": {
			const esc = ctx.defs.escalations.find((e) => e.id === def.escalationRef)
			if (esc) {
				out.push({ label: "Escalation", value: displayName(esc) })
				if (nonEmpty(esc.escalationCode))
					out.push({ label: "Escalation code", value: esc.escalationCode })
			}
			break
		}
		case "signal": {
			const sig = ctx.defs.signals.find((s) => s.id === def.signalRef)
			if (sig) out.push({ label: "Signal", value: displayName(sig) })
			break
		}
		case "conditional":
			if (nonEmpty(def.condition)) out.push({ label: "Condition", value: def.condition.trim() })
			break
		case "link":
			if (nonEmpty(def.name)) out.push({ label: "Link", value: def.name })
			break
		case "compensate":
			if (nonEmpty(def.activityRef))
				out.push({
					label: "Compensates",
					value: ctx.names.get(def.activityRef) ?? def.activityRef,
				})
			break
		case "cancel":
		case "terminate":
			break
	}
	return out
}

function describeLoop(
	loop: BpmnMultiInstanceLoopCharacteristics | undefined,
): DocumentedProperty[] {
	if (!loop) return []
	const zeebe = child(loop.extensionElements, "loopCharacteristics")?.attributes ?? {}
	const mode = loop.isSequential ? "Sequential" : "Parallel"
	let value = mode
	if (nonEmpty(zeebe.inputCollection)) {
		value += ` over ${zeebe.inputCollection}`
		if (nonEmpty(zeebe.inputElement)) value += ` as ${zeebe.inputElement}`
	} else if (loop.loopCardinality && nonEmpty(loop.loopCardinality.text)) {
		value += `, ${loop.loopCardinality.text.trim()} times`
	}
	const out: DocumentedProperty[] = [{ label: "Multi-instance", value }]
	if (nonEmpty(zeebe.outputCollection)) {
		const el = nonEmpty(zeebe.outputElement) ? ` ← ${zeebe.outputElement}` : ""
		out.push({ label: "Collects into", value: `${zeebe.outputCollection}${el}` })
	}
	if (loop.completionCondition && nonEmpty(loop.completionCondition.text)) {
		out.push({ label: "Completes when", value: loop.completionCondition.text.trim() })
	}
	return out
}

function describeOutgoing(
	el: BpmnFlowElement,
	outgoing: BpmnSequenceFlow[],
	ctx: Ctx,
): DocumentedProperty[] {
	if (outgoing.length === 0) return []
	const defaultFlow = "default" in el ? el.default : undefined
	const lines = outgoing.map((f) => {
		const target = ctx.names.get(f.targetRef) ?? f.targetRef
		const label = nonEmpty(f.name) ? `${f.name.trim()} → ${target}` : `→ ${target}`
		if (f.id === defaultFlow) return `${label} (default)`
		if (f.conditionExpression && nonEmpty(f.conditionExpression.text)) {
			return `${label} when ${f.conditionExpression.text.trim()}`
		}
		return label
	})
	return [{ label: outgoing.length > 1 ? "Next steps" : "Next step", value: lines }]
}

function describeElement(
	el: BpmnFlowElement,
	outgoing: BpmnSequenceFlow[],
	ctx: Ctx,
): DocumentedProperty[] {
	const props: DocumentedProperty[] = []
	const ext = el.extensionElements
	const attr = (name: string, key: string) => child(ext, name)?.attributes[key]
	const name = displayName(el)

	const template = el.unknownAttributes["zeebe:modelerTemplate"]
	if (nonEmpty(template)) props.push({ label: "Template", value: template })

	if (el.type === "boundaryEvent") {
		props.push({ label: "Attached to", value: ctx.names.get(el.attachedToRef) ?? el.attachedToRef })
	}
	for (const def of eventDefinitionsOf(el)) props.push(...describeEventDefinition(def, ctx))

	if (el.type === "sendTask" || el.type === "receiveTask") {
		const msg = ctx.defs.messages.find((m) => m.id === el.messageRef)
		if (msg) {
			props.push({ label: "Message", value: displayName(msg) })
			const key = child(msg.extensionElements, "subscription")?.attributes.correlationKey
			if (nonEmpty(key)) props.push({ label: "Correlation key", value: key })
		}
	}

	const jobType = attr("taskDefinition", "type")
	if (nonEmpty(jobType)) props.push({ label: "Job type", value: jobType })
	const retries = attr("taskDefinition", "retries")
	if (nonEmpty(retries)) props.push({ label: "Retries", value: retries })

	const script = child(ext, "script")?.attributes
	if (script && nonEmpty(script.expression)) {
		props.push({ label: "Script", value: script.expression })
		if (nonEmpty(script.resultVariable))
			props.push({ label: "Result variable", value: script.resultVariable })
	}

	const decisionId = attr("calledDecision", "decisionId")
	if (nonEmpty(decisionId)) {
		const prop: DocumentedProperty = { label: "Called decision", value: decisionId }
		if (ctx.decisionIds.has(decisionId)) prop.link = { kind: "decision", id: decisionId }
		props.push(prop)
		const rv = attr("calledDecision", "resultVariable")
		if (nonEmpty(rv)) props.push({ label: "Result variable", value: rv })
		ctx.decisionCallers.set(decisionId, [...(ctx.decisionCallers.get(decisionId) ?? []), name])
	}

	const calledElement = child(ext, "calledElement")?.attributes
	if (calledElement && nonEmpty(calledElement.processId)) {
		props.push({ label: "Called process", value: calledElement.processId })
	}

	const form = child(ext, "formDefinition")?.attributes
	if (form) {
		if (nonEmpty(form.formId)) {
			const prop: DocumentedProperty = { label: "Form", value: form.formId }
			if (ctx.formIds.has(form.formId)) prop.link = { kind: "form", id: form.formId }
			props.push(prop)
			ctx.formUsers.set(form.formId, [...(ctx.formUsers.get(form.formId) ?? []), name])
		} else if (nonEmpty(form.externalReference)) {
			props.push({ label: "Form", value: form.externalReference })
		} else if (nonEmpty(form.formKey)) {
			props.push({ label: "Form", value: form.formKey })
		}
	}

	const assignment = child(ext, "assignmentDefinition")?.attributes ?? {}
	if (nonEmpty(assignment.assignee)) props.push({ label: "Assignee", value: assignment.assignee })
	if (nonEmpty(assignment.candidateGroups))
		props.push({ label: "Candidate groups", value: assignment.candidateGroups })
	if (nonEmpty(assignment.candidateUsers))
		props.push({ label: "Candidate users", value: assignment.candidateUsers })
	const schedule = child(ext, "taskSchedule")?.attributes ?? {}
	if (nonEmpty(schedule.dueDate)) props.push({ label: "Due date", value: schedule.dueDate })
	if (nonEmpty(schedule.followUpDate))
		props.push({ label: "Follow-up date", value: schedule.followUpDate })
	const priority = attr("priorityDefinition", "priority")
	if (nonEmpty(priority)) props.push({ label: "Priority", value: priority })

	const headers = children(child(ext, "taskHeaders")?.children, "header")
	if (headers.length > 0) {
		props.push({
			label: "Task headers",
			value: headers.map((h) => `${h.attributes.key ?? ""} = ${h.attributes.value ?? ""}`),
		})
	}
	const io = child(ext, "ioMapping")
	const mapping = (kind: string) =>
		children(io?.children, kind).map(
			(m) => `${m.attributes.target ?? ""} ← ${m.attributes.source ?? ""}`,
		)
	const inputs = mapping("input")
	if (inputs.length > 0) props.push({ label: "Inputs", value: inputs })
	const outputs = mapping("output")
	if (outputs.length > 0) props.push({ label: "Outputs", value: outputs })

	if ("loopCharacteristics" in el) props.push(...describeLoop(el.loopCharacteristics))
	if (
		el.type === "adHocSubProcess" &&
		el.completionCondition &&
		nonEmpty(el.completionCondition.text)
	) {
		props.push({ label: "Completes when", value: el.completionCondition.text.trim() })
	}

	props.push(...describeOutgoing(el, outgoing, ctx))
	return props
}

function documentScope(
	scope: Scope,
	lanes: Map<string, string>,
	inheritedLane: string | undefined,
	prefix: string,
	depth: number,
	ctx: Ctx,
	into: DocumentedElement[],
): void {
	// Flows are read from the scope, not from `outgoing`, which many files omit.
	const bySource = new Map<string, BpmnSequenceFlow[]>()
	for (const f of scope.sequenceFlows) {
		bySource.set(f.sourceRef, [...(bySource.get(f.sourceRef) ?? []), f])
	}
	const ordered = flowOrder(scope.flowElements, scope.sequenceFlows)
	ordered.forEach((el, i) => {
		const number = `${prefix}${i + 1}`
		const lane = lanes.get(el.id) ?? inheritedLane
		const doc: DocumentedElement = {
			id: el.id,
			type: el.type,
			typeLabel: typeLabelOf(el),
			number,
			depth,
			properties: describeElement(el, bySource.get(el.id) ?? [], ctx),
		}
		if (nonEmpty(el.name)) doc.name = el.name.trim()
		if (lane !== undefined) doc.lane = lane
		if (nonEmpty(el.documentation)) doc.documentation = el.documentation.trim()
		into.push(doc)
		if (isScope(el)) {
			documentScope(el, lanes, lane, `${number}.`, depth + 1, ctx, into)
		}
	})
}

function flattenFormFields(
	components: FormComponent[],
	path: string[],
	into: DocumentedFormField[],
): void {
	for (const c of components) {
		const rec = c as unknown as Record<string, unknown>
		const str = (k: string) => (typeof rec[k] === "string" ? (rec[k] as string).trim() : "")
		const label = str("label") || str("dateLabel")
		if (Array.isArray(rec.components)) {
			flattenFormFields(rec.components as FormComponent[], label ? [...path, label] : path, into)
			continue
		}
		// Only components that bind data are fields; text, images and buttons are layout.
		const key = str("key") || str("dataSource")
		if (!key) continue
		const values = Array.isArray(rec.values)
			? (rec.values as Array<{ label?: unknown }>).map((v) => String(v.label ?? "")).join(", ")
			: ""
		const validate = rec.validate as { required?: unknown } | undefined
		into.push({
			label: [...path, label].filter((s) => s !== "").join(" / "),
			key,
			type: c.type,
			required: validate?.required === true,
			options: values || str("valuesKey") || str("valuesExpression"),
		})
	}
}

/**
 * Collects everything a process document needs from a parsed model, in flow
 * order. The HTML, Markdown and Word renderers all draw from this, so a custom
 * renderer can too.
 */
export function buildProcessDocumentation(
	defs: BpmnDefinitions,
	options: DocumentationOptions = {},
): ProcessDocumentation {
	const decisionsIn = (options.decisions ?? []).flatMap((d) => d.decisions)
	const formsIn = options.forms ?? []
	const ctx: Ctx = {
		defs,
		names: new Map(),
		decisionIds: new Set(decisionsIn.map((d) => d.id)),
		formIds: new Set(formsIn.map((f) => f.id)),
		decisionCallers: new Map(),
		formUsers: new Map(),
	}
	for (const p of defs.processes) collectNames(p.flowElements, ctx.names)

	const participants = defs.collaborations.flatMap((c) => c.participants)
	for (const part of participants) ctx.names.set(part.id, displayName(part))

	// Pools first, in pool order; processes without a pool after, in XML order.
	const poolOrder = participants.flatMap((part) =>
		defs.processes.filter((p) => p.id === part.processRef).map((p) => ({ p, part })),
	)
	const unpooled = defs.processes
		.filter((p) => !participants.some((part) => part.processRef === p.id))
		.map((p) => ({ p, part: undefined }))

	const processes: DocumentedProcess[] = [...poolOrder, ...unpooled].map(({ p, part }) => {
		const laneInfo = laneMapOf(p.laneSet)
		const elements: DocumentedElement[] = []
		documentScope(p, laneInfo.byElement, undefined, "", 0, ctx, elements)
		const rank = new Map(elements.map((e, i) => [e.id, i] as const))
		const lanes: DocumentedLane[] = laneInfo.lanes.map((l) => {
			const lane: DocumentedLane = {
				id: l.id,
				name: l.name,
				path: l.path,
				elements: [...l.refs]
					.filter((r) => rank.has(r))
					.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
					.map((r) => ctx.names.get(r) ?? r),
			}
			if (nonEmpty(l.documentation)) lane.documentation = l.documentation.trim()
			return lane
		})
		const doc: DocumentedProcess = {
			id: p.id,
			title: part && nonEmpty(part.name) ? part.name.trim() : displayName(p),
			executable: p.isExecutable === true,
			lanes,
			elements,
		}
		if (part && nonEmpty(part.name)) doc.participant = part.name.trim()
		const text = nonEmpty(p.documentation) ? p.documentation : part?.documentation
		if (nonEmpty(text)) doc.documentation = text.trim()
		return doc
	})

	const messageFlows: DocumentedMessageFlow[] = defs.collaborations.flatMap((c) =>
		c.messageFlows.map((mf) => {
			const out: DocumentedMessageFlow = {
				id: mf.id,
				from: ctx.names.get(mf.sourceRef) ?? mf.sourceRef,
				to: ctx.names.get(mf.targetRef) ?? mf.targetRef,
			}
			if (nonEmpty(mf.name)) out.name = mf.name.trim()
			const msg = defs.messages.find((m) => m.id === mf.messageRef)
			if (msg) out.message = displayName(msg)
			if (nonEmpty(mf.documentation)) out.documentation = mf.documentation.trim()
			return out
		}),
	)

	const decisions: DocumentedDecision[] = decisionsIn.flatMap((d) => {
		const table = d.decisionTable
		if (!table) return []
		return [
			{
				id: d.id,
				name: displayName(d),
				hitPolicy: table.aggregation
					? `${table.hitPolicy ?? "COLLECT"} (${table.aggregation})`
					: (table.hitPolicy ?? "UNIQUE"),
				inputs: table.inputs.map((i) => i.label?.trim() || i.inputExpression.text?.trim() || i.id),
				outputs: table.outputs.map((o) => o.label?.trim() || o.name?.trim() || o.id),
				rules: table.rules.map((r) => [
					...r.inputEntries.map((e) => e.text.trim() || "-"),
					...r.outputEntries.map((e) => e.text.trim()),
					r.description?.trim() ?? "",
				]),
				calledBy: ctx.decisionCallers.get(d.id) ?? [],
			},
		]
	})

	const forms: DocumentedForm[] = formsIn.map((f) => {
		const fields: DocumentedFormField[] = []
		flattenFormFields(f.components, [], fields)
		return { id: f.id, fields, usedBy: ctx.formUsers.get(f.id) ?? [] }
	})

	const firstTitle = processes[0]?.title
	const doc: ProcessDocumentation = {
		title: nonEmpty(options.title) ? options.title.trim() : (firstTitle ?? defs.id),
		processes,
		messageFlows,
		decisions,
		forms,
	}
	if (nonEmpty(options.subtitle)) doc.subtitle = options.subtitle.trim()
	if (nonEmpty(defs.documentation)) doc.documentation = defs.documentation.trim()
	if (options.diagram !== false && (defs.diagrams[0]?.plane.shapes.length ?? 0) > 0) {
		doc.diagramSvg = exportSvg(defs, { theme: "light", padding: 40 })
	}
	return doc
}
