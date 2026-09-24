import { parseExpression } from "@bpmnkit/feel"
import { ValidationError } from "../../errors.js"
import type { XmlElement } from "../../types/xml-element.js"
import type {
	BpmnDefinitions,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnMultiInstanceLoopCharacteristics,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../bpmn-model.js"
import { detectExecutionPlatform } from "../lint.js"
import { bpmnElementName, isZeebePlacementAllowed } from "../zeebe-extensions.js"
import { containsJuel, feelString, isFeelName, translateJuelToFeel } from "./juel.js"

/**
 * How much work a Camunda 7 construct leaves after conversion.
 *
 * - `convertible` — rewritten mechanically; the Camunda 8 model behaves the same.
 * - `manual` — Camunda 8 has an equivalent, but a person has to supply or check
 *   it (a job worker to write, an expression to translate, a key to choose).
 * - `unsupported` — Camunda 8 has no equivalent; the model or the surrounding
 *   system has to change.
 */
export type Camunda7Severity = "convertible" | "manual" | "unsupported"

/** One Camunda 7 construct and what migrating it takes. */
export interface Camunda7Finding {
	/** The element carrying the construct — a flow element, flow, process or the definitions. */
	elementId: string
	/** The BPMN type of that element, e.g. `serviceTask`, `sequenceFlow`, `process`. */
	elementType: string
	/** The process the element belongs to; empty for document-level findings. */
	processId: string
	/** The Camunda 7 construct, e.g. `camunda:class` or `camunda:inputOutput`. */
	construct: string
	severity: Camunda7Severity
	message: string
	/** The Camunda 8 equivalent, or what to do instead. */
	suggestion: string
	/**
	 * Whether {@link convertCamunda7} wrote a Camunda 8 equivalent. When it did,
	 * the Camunda 7 original was removed; when it did not, the original is kept
	 * verbatim (Camunda 8 ignores it) so nothing is lost.
	 */
	applied: boolean
}

export interface Camunda7Report {
	findings: Camunda7Finding[]
	counts: Record<Camunda7Severity, number>
	total: number
}

export interface Camunda7ConvertOptions {
	/** Written as `modeler:executionPlatformVersion`. Default `"8.8.0"`. */
	executionPlatformVersion?: string
	/**
	 * Ignored. Kept for compatibility: earlier versions read `camunda:` attributes
	 * on multi-instance loops and event definitions from the source XML, because
	 * the parser dropped them. The parser now keeps them in `unknownAttributes`.
	 */
	sourceXml?: string
}

export interface Camunda7Conversion {
	definitions: BpmnDefinitions
	report: Camunda7Report
}

const CAMUNDA7_NS = "http://camunda.org/schema/1.0/bpmn"
const ZEEBE_NS = "http://camunda.org/schema/zeebe/1.0"
const MODELER_NS = "http://camunda.org/schema/modeler/1.0"
const DEFAULT_PLATFORM_VERSION = "8.8.0"

/** Something that can carry Camunda 7 attributes and extension elements. */
interface Owner {
	id: string
	type: string
	extensionElements: XmlElement[]
	unknownAttributes: Record<string, string>
	unknownChildren?: XmlElement[]
}

/** Anything the parser keeps foreign attributes on: an element, an event definition, a loop. */
interface AttributeHolder {
	unknownAttributes?: Record<string, string>
}

/** The event definitions and loop of a flow element, which carry attributes of their own. */
function nestedHolders(owner: object): AttributeHolder[] {
	const holders: AttributeHolder[] = []
	if ("eventDefinitions" in owner && Array.isArray(owner.eventDefinitions)) {
		holders.push(...(owner.eventDefinitions as AttributeHolder[]))
	}
	if ("loopCharacteristics" in owner && owner.loopCharacteristics !== undefined) {
		holders.push(owner.loopCharacteristics as AttributeHolder)
	}
	return holders
}

function localName(name: string): string {
	const colon = name.indexOf(":")
	return colon === -1 ? name : name.slice(colon + 1)
}

/**
 * Converts a Camunda 7 model to Camunda 8, as far as that can be done
 * mechanically, and reports what it could not do. The input is not modified.
 *
 * What cannot be converted stays in the output verbatim — Camunda 8 ignores
 * `camunda:` content — and has a `manual` or `unsupported` finding saying why.
 *
 * @example
 * ```typescript
 * const { definitions, report } = convertCamunda7(Bpmn.parse(xml))
 * for (const f of report.findings) console.log(f.severity, f.elementId, f.message)
 * const c8Xml = Bpmn.export(definitions)
 * ```
 */
export function convertCamunda7(
	definitions: BpmnDefinitions,
	options: Camunda7ConvertOptions = {},
): Camunda7Conversion {
	// A Camunda 8 model's job-worker user tasks would silently become Camunda user tasks.
	if (detectExecutionPlatform(definitions).id === "camunda-cloud") {
		throw new ValidationError(
			"The model already targets Camunda 8 (modeler:executionPlatform names Camunda Cloud); there is nothing to migrate.",
		)
	}
	const draft = structuredClone(definitions)
	const converter = new Converter(draft, options)
	converter.run()
	return { definitions: draft, report: converter.report() }
}

/**
 * Reports what migrating a Camunda 7 model to Camunda 8 takes, element by
 * element, without changing it. Same findings as {@link convertCamunda7}.
 */
export function analyzeCamunda7(
	definitions: BpmnDefinitions,
	options: Pick<Camunda7ConvertOptions, "sourceXml"> = {},
): Camunda7Report {
	return convertCamunda7(definitions, options).report
}

/** `com.acme.ShipOrderDelegate` → `shipOrderDelegate`, the Spring bean name the class gets by default. */
function beanName(className: string): string {
	const simple = className.slice(className.lastIndexOf(".") + 1).replace(/\$/g, "")
	return simple.charAt(0).toLowerCase() + simple.slice(1)
}

const ISO_DATE_TIME_WITH_ZONE =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

type Translated = { ok: true; value: string } | { ok: false; reason: string }

class Converter {
	private readonly findings: Camunda7Finding[] = []
	private readonly prefix: string | undefined
	private processId = ""
	/** Per owner: the attribute keys and extension elements a rule has accounted for. */
	private handledAttributes = new Set<string>()
	private handledElements = new Set<XmlElement>()

	constructor(
		private readonly definitions: BpmnDefinitions,
		private readonly options: Camunda7ConvertOptions,
	) {
		this.prefix = Object.entries(definitions.namespaces).find(([, uri]) => uri === CAMUNDA7_NS)?.[0]
	}

	run(): void {
		const d = this.definitions
		for (const error of d.errors) {
			this.withOwner(
				{
					id: error.id,
					type: "error",
					extensionElements: error.extensionElements ?? [],
					unknownAttributes: error.unknownAttributes ?? {},
				},
				(owner) => {
					if (this.attr(owner, "errorMessage") !== undefined) {
						this.add(
							owner,
							"camunda:errorMessage",
							"unsupported",
							"Camunda 8 errors carry only an error code.",
							"Have the worker pass the message along when it throws the error.",
							false,
						)
						this.keepAttr(owner, "errorMessage")
					}
				},
			)
		}
		for (const message of d.messages) {
			if (message.name !== undefined && containsJuel(message.name)) {
				this.findings.push({
					elementId: message.id,
					elementType: "message",
					processId: "",
					construct: "bpmn:message name expression",
					severity: "manual",
					message: `Message name "${message.name}" is a JUEL expression.`,
					suggestion: "Rewrite it as a FEEL expression (=…), or use a static name.",
					applied: false,
				})
			}
		}
		for (const process of d.processes) this.convertProcess(process)
		this.setExecutionPlatform()
	}

	report(): Camunda7Report {
		const counts: Record<Camunda7Severity, number> = { convertible: 0, manual: 0, unsupported: 0 }
		for (const finding of this.findings) counts[finding.severity] += 1
		return { findings: this.findings, counts, total: this.findings.length }
	}

	// -----------------------------------------------------------------------
	// Plumbing
	// -----------------------------------------------------------------------

	private key(local: string): string {
		return `${this.prefix ?? "camunda"}:${local}`
	}

	private attr(holder: AttributeHolder, local: string): string | undefined {
		return this.prefix === undefined ? undefined : holder.unknownAttributes?.[this.key(local)]
	}

	/** Marks an attribute as accounted for and removes it — its Camunda 8 form was written. */
	private dropAttr(holder: AttributeHolder, local: string): void {
		this.handledAttributes.add(this.key(local))
		if (holder.unknownAttributes !== undefined) delete holder.unknownAttributes[this.key(local)]
	}

	/** Marks an attribute as accounted for and leaves it in place. */
	private keepAttr(_holder: AttributeHolder, local: string): void {
		this.handledAttributes.add(this.key(local))
	}

	private exts(owner: Owner, local: string): XmlElement[] {
		if (this.prefix === undefined) return []
		return owner.extensionElements.filter((element) => element.name === this.key(local))
	}

	private dropExt(owner: Owner, element: XmlElement): void {
		this.handledElements.add(element)
		const index = owner.extensionElements.indexOf(element)
		if (index !== -1) owner.extensionElements.splice(index, 1)
	}

	private keepExt(element: XmlElement): void {
		this.handledElements.add(element)
	}

	private add(
		owner: { id: string; type: string },
		construct: string,
		severity: Camunda7Severity,
		message: string,
		suggestion: string,
		applied: boolean,
	): void {
		this.findings.push({
			elementId: owner.id,
			elementType: owner.type,
			processId: this.processId,
			construct,
			severity,
			message,
			suggestion,
			applied,
		})
	}

	/** Finds or creates a `zeebe:` extension, or returns undefined where the schema forbids it. */
	private zeebe(owner: Owner, local: string): XmlElement | undefined {
		const name = `zeebe:${local}`
		if (!isZeebePlacementAllowed(bpmnElementName(owner), name)) return undefined
		const existing = owner.extensionElements.find((element) => element.name === name)
		if (existing !== undefined) return existing
		const created: XmlElement = { name, attributes: {}, children: [] }
		owner.extensionElements.push(created)
		return created
	}

	private hasZeebe(owner: Owner, local: string): boolean {
		return owner.extensionElements.some((element) => element.name === `zeebe:${local}`)
	}

	/**
	 * Runs the rules for one owner, then reports every Camunda 7 attribute or
	 * extension element no rule accounted for, so nothing passes unmentioned.
	 */
	private withOwner(owner: Owner, rules: (owner: Owner) => void): void {
		this.handledAttributes = new Set()
		this.handledElements = new Set()
		const attributes = [owner, ...nestedHolders(owner)].flatMap((holder) =>
			Object.entries(holder.unknownAttributes ?? {}).filter(
				([key]) => this.prefix !== undefined && key.startsWith(`${this.prefix}:`),
			),
		)
		const elements = owner.extensionElements.filter(
			(element) => this.prefix !== undefined && element.name.startsWith(`${this.prefix}:`),
		)
		rules(owner)
		for (const [key, value] of attributes) {
			if (this.handledAttributes.has(key)) continue
			this.add(
				owner,
				`camunda:${localName(key)}`,
				"manual",
				`Camunda 7 attribute ${key}="${value}" has no automatic conversion.`,
				"Review it against the Camunda 8 documentation; it is kept in the file, where Camunda 8 ignores it.",
				false,
			)
		}
		for (const element of elements) {
			if (this.handledElements.has(element)) continue
			this.add(
				owner,
				`camunda:${localName(element.name)}`,
				"manual",
				`Camunda 7 extension <${element.name}> has no automatic conversion.`,
				"Review it against the Camunda 8 documentation; it is kept in the file, where Camunda 8 ignores it.",
				false,
			)
		}
	}

	/**
	 * A value that may be static or JUEL, as a Camunda 8 attribute value:
	 * static text stays static, a provable `${…}` becomes `=feel`.
	 */
	private staticOrExpression(value: string, multiInstance = false): Translated {
		if (!containsJuel(value)) return { ok: true, value }
		const result = translateJuelToFeel(value, { multiInstance })
		return result.ok ? { ok: true, value: `=${result.feel}` } : { ok: false, reason: result.reason }
	}

	/** A value that is always an expression in Camunda 8 (IO mapping source): literals become FEEL literals. */
	private feelValue(text: string | undefined): Translated {
		const trimmed = (text ?? "").trim()
		if (trimmed === "") return { ok: true, value: "null" }
		if (!containsJuel(trimmed)) return { ok: true, value: feelString(trimmed) }
		const result = translateJuelToFeel(trimmed)
		return result.ok ? { ok: true, value: result.feel } : { ok: false, reason: result.reason }
	}

	// -----------------------------------------------------------------------
	// Process and containers
	// -----------------------------------------------------------------------

	private convertProcess(process: BpmnProcess): void {
		this.processId = process.id
		// The spread shares the process's arrays and records, so rules write through to it.
		this.withOwner({ ...process, type: "process" }, (owner) => {
			const versionTag = this.attr(owner, "versionTag")
			if (versionTag !== undefined) {
				const tag = this.zeebe(owner, "versionTag")
				if (tag !== undefined) {
					tag.attributes.value = versionTag
					this.dropAttr(owner, "versionTag")
					this.add(
						owner,
						"camunda:versionTag",
						"convertible",
						`Version tag "${versionTag}" moved to zeebe:versionTag.`,
						"zeebe:versionTag",
						true,
					)
				}
			}
			const ttl = this.attr(owner, "historyTimeToLive")
			if (ttl !== undefined) {
				this.keepAttr(owner, "historyTimeToLive")
				this.add(
					owner,
					"camunda:historyTimeToLive",
					"unsupported",
					`Camunda 8 has no per-process history time to live (was "${ttl}").`,
					"Configure data retention for the cluster (Operate, Tasklist and Optimize archiving).",
					false,
				)
			}
			for (const local of ["candidateStarterGroups", "candidateStarterUsers"]) {
				if (this.attr(owner, local) === undefined) continue
				this.keepAttr(owner, local)
				this.add(
					owner,
					`camunda:${local}`,
					"unsupported",
					"Camunda 8 does not restrict who may start a process in the model.",
					"Grant CREATE_PROCESS_INSTANCE on the process definition through authorizations.",
					false,
				)
			}
			if (this.attr(owner, "isStartableInTasklist") !== undefined) {
				this.keepAttr(owner, "isStartableInTasklist")
				this.add(
					owner,
					"camunda:isStartableInTasklist",
					"unsupported",
					"Camunda 8 decides Tasklist start visibility outside the model.",
					"Use a start form and authorizations to control starting from Tasklist.",
					false,
				)
			}
			for (const local of ["jobPriority", "taskPriority"]) {
				if (this.attr(owner, local) === undefined) continue
				this.keepAttr(owner, local)
				this.add(
					owner,
					`camunda:${local}`,
					"manual",
					"Camunda 7 job/external-task priorities order its own job executor and fetch-and-lock; Camunda 8 prioritises worker jobs differently.",
					"If priority matters, set zeebe:jobPriorityDefinition (job prioritization) and check its semantics.",
					false,
				)
			}
			this.convertCommon(owner)
		})
		this.convertContainer(process.flowElements, process.sequenceFlows)
	}

	private convertContainer(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[]): void {
		for (const element of elements) {
			this.withOwner(element, () => this.convertElement(element))
			if (
				element.type === "subProcess" ||
				element.type === "adHocSubProcess" ||
				element.type === "eventSubProcess" ||
				element.type === "transaction"
			) {
				this.convertContainer(element.flowElements, element.sequenceFlows)
			}
		}
		for (const flow of flows) {
			this.withOwner({ ...flow, type: "sequenceFlow" }, (owner) => this.convertFlow(flow, owner))
		}
	}

	private convertElement(element: BpmnFlowElement): void {
		this.convertAsync(element)
		switch (element.type) {
			case "serviceTask":
			case "sendTask":
				this.convertImplementation(element)
				break
			case "businessRuleTask":
				if (this.attr(element, "decisionRef") !== undefined) this.convertDecision(element)
				else this.convertImplementation(element)
				break
			case "userTask":
				this.convertUserTask(element)
				break
			case "callActivity":
				this.convertCallActivity(element)
				break
			case "scriptTask":
				this.convertScriptTask(element)
				break
			case "receiveTask":
				this.checkCorrelation(element, element.messageRef)
				break
			case "startEvent":
				this.convertStartEvent(element)
				this.convertEventDefinitions(element, element.eventDefinitions)
				break
			case "intermediateCatchEvent":
			case "boundaryEvent":
				this.convertEventDefinitions(element, element.eventDefinitions)
				for (const definition of element.eventDefinitions) {
					if (definition.type === "message") this.checkCorrelation(element, definition.messageRef)
				}
				break
			case "intermediateThrowEvent":
			case "endEvent":
				this.convertEventDefinitions(element, element.eventDefinitions)
				if (element.eventDefinitions.some((definition) => definition.type === "message")) {
					this.convertMessageThrow(element)
				}
				break
			default:
				break
		}
		if ("loopCharacteristics" in element && element.loopCharacteristics !== undefined) {
			this.convertLoop(element, element.loopCharacteristics)
		}
		this.convertStandardLoop(element)
		this.convertCommon(element)
		this.convertRetryCycle(element)
	}

	// -----------------------------------------------------------------------
	// Rules shared by every element
	// -----------------------------------------------------------------------

	private convertAsync(owner: Owner): void {
		const present = ["asyncBefore", "asyncAfter", "async", "exclusive", "jobPriority"].filter(
			(local) => this.attr(owner, local) !== undefined,
		)
		if (present.length === 0) return
		for (const local of present) this.dropAttr(owner, local)
		this.add(
			owner,
			present.map((local) => `camunda:${local}`).join(", "),
			"convertible",
			"Dropped: Camunda 8 has no asynchronous continuations. The engine commits after every step and every job-based task is already a wait state, so there is no transaction boundary to place and no job executor job to prioritise.",
			"Nothing to model. A failure no longer rolls back to the last async boundary: a job failure retries the job, and an expression failure raises an incident on the element.",
			true,
		)
	}

	private convertCommon(owner: Owner): void {
		for (const io of this.exts(owner, "inputOutput")) this.convertInputOutput(owner, io)
		for (const properties of this.exts(owner, "properties")) {
			const target = this.zeebe(owner, "properties")
			if (target === undefined) continue
			for (const property of properties.children) {
				target.children.push({
					name: "zeebe:property",
					attributes: {
						name: property.attributes.name ?? "",
						value: property.attributes.value ?? "",
					},
					children: [],
				})
			}
			this.dropExt(owner, properties)
			this.add(
				owner,
				"camunda:properties",
				"convertible",
				"Extension properties moved to zeebe:properties.",
				"zeebe:properties",
				true,
			)
		}
		for (const listener of this.exts(owner, "executionListener")) {
			this.keepExt(listener)
			const event = listener.attributes.event ?? "start"
			if (event === "take") {
				this.add(
					owner,
					"camunda:executionListener",
					"unsupported",
					"Camunda 8 has no listener on taking a sequence flow.",
					"Move the logic into a task or an end listener on the source element.",
					false,
				)
				continue
			}
			this.add(
				owner,
				"camunda:executionListener",
				"manual",
				`Execution listener on "${event}" (${describeImplementation(listener, this.prefix)}) runs Java or script code in the engine.`,
				`Implement it as a job worker and declare it with zeebe:executionListeners (eventType="${event}", type="<job type>").`,
				false,
			)
		}
		for (const local of ["formData", "formProperty"]) {
			for (const form of this.exts(owner, local)) {
				this.keepExt(form)
				this.add(
					owner,
					`camunda:${local}`,
					"manual",
					"Generated task forms have no Camunda 8 equivalent.",
					"Rebuild the form as a Camunda Form and link it with zeebe:formDefinition formId.",
					false,
				)
			}
		}
		for (const errorDefinition of this.exts(owner, "errorEventDefinition")) {
			this.keepExt(errorDefinition)
			this.add(
				owner,
				"camunda:errorEventDefinition",
				"manual",
				"External-task error event definitions evaluate an expression on the worker's result in the engine.",
				"Throw the BPMN error from the job worker (throw-error command) instead.",
				false,
			)
		}
	}

	private convertInputOutput(owner: Owner, io: XmlElement): void {
		const mapping = this.zeebe(owner, "ioMapping")
		if (mapping === undefined) {
			this.keepExt(io)
			this.add(
				owner,
				"camunda:inputOutput",
				"manual",
				`Camunda 8 does not allow input/output mappings on ${owner.type}.`,
				"Move the mappings to a neighbouring activity.",
				false,
			)
			return
		}
		const kept: XmlElement[] = []
		let converted = 0
		for (const parameter of io.children) {
			const direction = localName(parameter.name) === "inputParameter" ? "input" : "output"
			const target = parameter.attributes.name ?? ""
			const value = this.parameterValue(parameter)
			if (!value.ok || !isFeelPath(target)) {
				kept.push(parameter)
				const reason = value.ok ? `"${target}" is not a valid Camunda 8 target name` : value.reason
				this.add(
					owner,
					`camunda:${direction}Parameter`,
					"manual",
					`${direction === "input" ? "Input" : "Output"} parameter "${target}" was not converted: ${reason}.`,
					`Write it as <zeebe:${direction} source="=…" target="${target}"/> by hand.`,
					false,
				)
				continue
			}
			mapping.children.push({
				name: `zeebe:${direction}`,
				attributes: { source: `=${value.value}`, target },
				children: [],
			})
			converted++
		}
		if (mapping.children.length === 0)
			owner.extensionElements.splice(owner.extensionElements.indexOf(mapping), 1)
		if (kept.length === 0) this.dropExt(owner, io)
		else {
			io.children = kept
			this.keepExt(io)
		}
		if (converted > 0) {
			this.add(
				owner,
				"camunda:inputOutput",
				"convertible",
				`${converted} input/output parameter${converted === 1 ? "" : "s"} moved to zeebe:ioMapping, JUEL translated to FEEL.`,
				"zeebe:ioMapping",
				true,
			)
		}
	}

	private parameterValue(parameter: XmlElement): Translated {
		const [child] = parameter.children
		if (child === undefined) return this.feelValue(parameter.text)
		return this.structuredValue(child)
	}

	private structuredValue(element: XmlElement): Translated {
		const local = localName(element.name)
		if (local === "list") {
			const items: string[] = []
			for (const item of element.children) {
				const value =
					item.children[0] === undefined
						? this.feelValue(item.text)
						: this.structuredValue(item.children[0])
				if (!value.ok) return value
				items.push(value.value)
			}
			return { ok: true, value: `[${items.join(", ")}]` }
		}
		if (local === "map") {
			const entries: string[] = []
			for (const entry of element.children) {
				const value =
					entry.children[0] === undefined
						? this.feelValue(entry.text)
						: this.structuredValue(entry.children[0])
				if (!value.ok) return value
				entries.push(`${feelString(entry.attributes.key ?? "")}: ${value.value}`)
			}
			return { ok: true, value: `{${entries.join(", ")}}` }
		}
		if (local === "script") {
			const format = (element.attributes.scriptFormat ?? "").toLowerCase()
			if (format === "feel" && element.attributes.resource === undefined) {
				return this.checkedFeel(element.text ?? "")
			}
			return { ok: false, reason: `it is a ${element.attributes.scriptFormat ?? "script"} script` }
		}
		return { ok: false, reason: `<${element.name}> is not a value Camunda 8 can express` }
	}

	private checkedFeel(text: string): Translated {
		const trimmed = text.trim()
		if (trimmed === "") return { ok: false, reason: "the FEEL script is empty" }
		return parseExpression(trimmed).errors.length === 0
			? { ok: true, value: trimmed }
			: { ok: false, reason: "the FEEL script does not parse" }
	}

	private convertRetryCycle(owner: Owner): void {
		for (const cycle of this.exts(owner, "failedJobRetryTimeCycle")) {
			const text = (cycle.text ?? "").trim()
			const definition = owner.extensionElements.find(
				(element) => element.name === "zeebe:taskDefinition",
			)
			if (definition === undefined) {
				this.keepExt(cycle)
				this.add(
					owner,
					"camunda:failedJobRetryTimeCycle",
					"unsupported",
					`Retry cycle "${text}" retried an asynchronous continuation; in Camunda 8 only jobs have retries.`,
					"A failure on this element raises an incident; resolve it in Operate.",
					false,
				)
				continue
			}
			const repeat = /^R(\d+)\/(P\S+)$/.exec(text)
			const list = text.split(",").map((part) => part.trim())
			const retries =
				repeat?.[1] ?? (list.every((part) => /^P\S+$/.test(part)) ? String(list.length) : undefined)
			if (retries === undefined) {
				this.keepExt(cycle)
				this.add(
					owner,
					"camunda:failedJobRetryTimeCycle",
					"manual",
					`Retry cycle "${text}" is not an R<n>/<duration> or a duration list.`,
					'Set zeebe:taskDefinition retries="<n>" and the back-off in the worker.',
					false,
				)
				continue
			}
			if (definition.attributes.retries === undefined) definition.attributes.retries = retries
			this.dropExt(owner, cycle)
			this.add(
				owner,
				"camunda:failedJobRetryTimeCycle",
				"convertible",
				`Retry count ${retries} moved to zeebe:taskDefinition retries.`,
				"zeebe:taskDefinition retries",
				true,
			)
			const intervals = repeat === null ? list : [repeat[2] ?? ""]
			// A zero interval retries at once, which is what Camunda 8 does without a back-off.
			if (intervals.every((interval) => /^P(T?0+[SMHD]|0+[DWMY])$/.test(interval))) continue
			this.add(
				owner,
				"camunda:failedJobRetryTimeCycle",
				"manual",
				`The retry interval (${repeat?.[2] ?? list.join(", ")}) is not part of the Camunda 8 model.`,
				"Pass it as the retry back-off when the worker fails the job (fail-job retryBackOff).",
				false,
			)
		}
	}

	private convertStandardLoop(owner: Owner): void {
		for (const child of owner.unknownChildren ?? []) {
			if (localName(child.name) !== "standardLoopCharacteristics") continue
			this.add(
				owner,
				"bpmn:standardLoopCharacteristics",
				"unsupported",
				"Camunda 8 does not support standard (while) loops.",
				"Model the loop with a gateway and a sequence flow back, or as a multi-instance activity.",
				false,
			)
		}
	}

	// -----------------------------------------------------------------------
	// Implementations: service, send, business rule, message throw
	// -----------------------------------------------------------------------

	/** `source` holds the implementation attributes: the element, or a message throw's event definition. */
	private convertImplementation(owner: Owner, source: AttributeHolder = owner): void {
		const read = (local: string): string | undefined => this.attr(source, local)
		const drop = (local: string): void => this.dropAttr(source, local)
		const type = read("type")
		const topic = read("topic")
		const className = read("class")
		const delegateExpression = read("delegateExpression")
		const expression = read("expression")

		if (type === "external" && topic !== undefined) {
			const jobType = this.staticOrExpression(topic)
			if (!jobType.ok) {
				this.keepAttr(owner, "type")
				this.keepAttr(owner, "topic")
				this.add(
					owner,
					"camunda:topic",
					"manual",
					`Topic expression "${topic}" could not be translated: ${jobType.reason}.`,
					"Set zeebe:taskDefinition type by hand.",
					false,
				)
				return
			}
			const definition = this.zeebe(owner, "taskDefinition")
			if (definition === undefined) return
			definition.attributes.type = jobType.value
			drop("type")
			drop("topic")
			this.add(
				owner,
				"camunda:type=external",
				"convertible",
				`External task topic "${topic}" became job type "${jobType.value}".`,
				"zeebe:taskDefinition type — point the external task worker at the Camunda 8 job API with the same type.",
				true,
			)
			const priority = read("taskPriority")
			if (priority !== undefined) {
				this.keepAttr(owner, "taskPriority")
				this.add(
					owner,
					"camunda:taskPriority",
					"manual",
					`External task priority "${priority}" was not converted.`,
					"If priority matters, set zeebe:jobPriorityDefinition and check its range and semantics.",
					false,
				)
			}
			for (const error of this.exts(owner, "errorEventDefinition")) this.keepExt(error)
			return
		}

		const delegate: { attribute: string; value: string; jobType: string } | undefined =
			className !== undefined
				? { attribute: "class", value: className, jobType: beanName(className) }
				: delegateExpression !== undefined
					? {
							attribute: "delegateExpression",
							value: delegateExpression,
							jobType:
								/^[$#]\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}$/.exec(delegateExpression.trim())?.[1] ??
								owner.id,
						}
					: expression !== undefined
						? { attribute: "expression", value: expression, jobType: owner.id }
						: undefined

		if (delegate !== undefined) {
			const definition = this.zeebe(owner, "taskDefinition")
			if (definition === undefined) return
			definition.attributes.type = delegate.jobType
			const headers: XmlElement[] = [
				{
					name: "zeebe:header",
					attributes: { key: delegate.attribute, value: delegate.value },
					children: [],
				},
			]
			const resultVariable = read("resultVariable")
			if (delegate.attribute === "expression" && resultVariable !== undefined) {
				headers.push({
					name: "zeebe:header",
					attributes: { key: "resultVariable", value: resultVariable },
					children: [],
				})
				drop("resultVariable")
			}
			headers.push(...this.convertFields(owner))
			const taskHeaders = this.zeebe(owner, "taskHeaders")
			taskHeaders?.children.push(...headers)
			drop(delegate.attribute)
			this.add(
				owner,
				`camunda:${delegate.attribute}`,
				"manual",
				`${DELEGATE_LABEL[delegate.attribute] ?? delegate.attribute} "${delegate.value}" runs inside the Camunda 7 engine; Camunda 8 runs no user code in the engine.`,
				`Implement a job worker for type "${delegate.jobType}" (written as zeebe:taskDefinition type; the original is kept as the "${delegate.attribute}" task header, which the Camunda 7 adapter pattern can dispatch on).`,
				true,
			)
			return
		}

		for (const connector of this.exts(owner, "connector")) {
			this.keepExt(connector)
			const id =
				connector.children.find((child) => localName(child.name) === "connectorId")?.text ??
				"connector"
			this.add(
				owner,
				"camunda:connector",
				"manual",
				`Camunda 7 connector "${id}" has no Camunda 8 equivalent with the same inputs.`,
				id.startsWith("http")
					? "Use the Camunda 8 REST connector (io.camunda:http-json:1) and map its inputs."
					: "Use a Camunda 8 connector or a job worker.",
				false,
			)
		}
	}

	/** Field injections with a static string become task headers; expression fields are left for a person. */
	private convertFields(owner: Owner): XmlElement[] {
		const headers: XmlElement[] = []
		for (const field of this.exts(owner, "field")) {
			const name = field.attributes.name ?? ""
			const stringChild = field.children.find((child) => localName(child.name) === "string")
			const value = field.attributes.stringValue ?? stringChild?.text
			if (value !== undefined && field.attributes.expression === undefined) {
				headers.push({ name: "zeebe:header", attributes: { key: name, value }, children: [] })
				this.dropExt(owner, field)
				this.add(
					owner,
					"camunda:field",
					"convertible",
					`Field injection "${name}" became a task header.`,
					"zeebe:taskHeaders — read it from the job's custom headers.",
					true,
				)
				continue
			}
			this.keepExt(field)
			this.add(
				owner,
				"camunda:field",
				"manual",
				`Field injection "${name}" is an expression evaluated by the engine.`,
				"Map the value with an input mapping and read it as a job variable.",
				false,
			)
		}
		return headers
	}

	private convertMessageThrow(owner: BpmnFlowElement): void {
		// Camunda 7 puts the implementation on the message event definition; Modeler never
		// writes it on the event itself, but a hand-written file might.
		const implemented = (holder: AttributeHolder): boolean =>
			["class", "delegateExpression", "expression", "type"].some(
				(local) => this.attr(holder, local) !== undefined,
			)
		const definitions = "eventDefinitions" in owner ? owner.eventDefinitions : []
		const source = [
			...definitions.filter((definition) => definition.type === "message"),
			owner,
		].find(implemented)
		if (source !== undefined) this.convertImplementation(owner, source)
	}

	private convertDecision(owner: Owner): void {
		const decisionRef = this.attr(owner, "decisionRef") ?? ""
		const decisionId = this.staticOrExpression(decisionRef)
		if (!decisionId.ok) {
			this.keepAttr(owner, "decisionRef")
			this.add(
				owner,
				"camunda:decisionRef",
				"manual",
				`Decision reference "${decisionRef}" could not be translated: ${decisionId.reason}.`,
				"Set zeebe:calledDecision decisionId by hand.",
				false,
			)
			return
		}
		const called = this.zeebe(owner, "calledDecision")
		if (called === undefined) return
		called.attributes.decisionId = decisionId.value
		this.dropAttr(owner, "decisionRef")
		const resultVariable = this.attr(owner, "resultVariable")
		if (resultVariable !== undefined) {
			called.attributes.resultVariable = resultVariable
			this.dropAttr(owner, "resultVariable")
			this.add(
				owner,
				"camunda:decisionRef",
				"convertible",
				`Decision "${decisionRef}" → zeebe:calledDecision, result in "${resultVariable}".`,
				"zeebe:calledDecision",
				true,
			)
		} else {
			called.attributes.resultVariable = "decisionResult"
			this.add(
				owner,
				"camunda:decisionRef",
				"manual",
				`Decision "${decisionRef}" → zeebe:calledDecision. Camunda 7 had no result variable; Camunda 8 requires one, so "decisionResult" was set.`,
				"Rename resultVariable to what downstream elements expect.",
				true,
			)
		}
		this.convertBinding(owner, called, "decisionRef")
		const mapper = this.attr(owner, "mapDecisionResult")
		if (mapper === "singleEntry") {
			this.dropAttr(owner, "mapDecisionResult")
			this.add(
				owner,
				"camunda:mapDecisionResult",
				"convertible",
				'Result mapper "singleEntry" matches Camunda 8, which stores a single output value as-is.',
				"Nothing to model.",
				true,
			)
		} else {
			if (mapper !== undefined) this.keepAttr(owner, "mapDecisionResult")
			this.add(
				owner,
				"camunda:mapDecisionResult",
				"manual",
				`Camunda 7 result mapper "${mapper ?? "resultList"}"${mapper === undefined ? " (the default)" : ""} shapes the result differently from Camunda 8, which stores the decision's own result: a value for one output, a context for several, a list for collect hit policies.`,
				"Check what downstream elements read, and add an output mapping if they expect the Camunda 7 shape.",
				false,
			)
		}
		if (this.attr(owner, "decisionRefTenantId") !== undefined) {
			this.keepAttr(owner, "decisionRefTenantId")
			this.add(
				owner,
				"camunda:decisionRefTenantId",
				"unsupported",
				"Camunda 8 resolves the decision in the process's own tenant.",
				"Deploy the decision to the same tenant as the process.",
				false,
			)
		}
	}

	/** `camunda:<ref>Binding` / `<ref>Version` / `<ref>VersionTag` → `bindingType` / `versionTag`. */
	private convertBinding(owner: Owner, target: XmlElement, ref: string): void {
		const binding = this.attr(owner, `${ref}Binding`)
		if (binding === undefined) return
		if (binding === "latest" || binding === "deployment") {
			target.attributes.bindingType = binding
			this.dropAttr(owner, `${ref}Binding`)
			return
		}
		if (binding === "versionTag") {
			const tag = this.attr(owner, `${ref}VersionTag`)
			if (tag !== undefined && !containsJuel(tag)) {
				target.attributes.bindingType = "versionTag"
				target.attributes.versionTag = tag
				this.dropAttr(owner, `${ref}Binding`)
				this.dropAttr(owner, `${ref}VersionTag`)
				return
			}
		}
		this.keepAttr(owner, `${ref}Binding`)
		this.keepAttr(owner, `${ref}Version`)
		this.keepAttr(owner, `${ref}VersionTag`)
		this.add(
			owner,
			`camunda:${ref}Binding`,
			"manual",
			`Binding "${binding}" pins a version number; Camunda 8 binds by latest, deployment or version tag.`,
			'Tag the target with a version tag and use bindingType="versionTag", or use "deployment".',
			false,
		)
	}

	// -----------------------------------------------------------------------
	// User tasks and forms
	// -----------------------------------------------------------------------

	private convertUserTask(owner: Owner): void {
		if (!this.hasZeebe(owner, "userTask")) {
			this.zeebe(owner, "userTask")
			this.add(
				owner,
				"bpmn:userTask",
				"convertible",
				"Implemented as a Camunda user task (zeebe:userTask).",
				"zeebe:userTask",
				true,
			)
		}
		const assignment: Record<string, string> = {}
		for (const local of ["assignee", "candidateUsers", "candidateGroups"]) {
			const value = this.attr(owner, local)
			if (value === undefined) continue
			const converted = this.staticOrExpression(value)
			if (!converted.ok) {
				this.keepAttr(owner, local)
				this.add(
					owner,
					`camunda:${local}`,
					"manual",
					`${local} "${value}" could not be translated: ${converted.reason}.`,
					`Set zeebe:assignmentDefinition ${local} by hand.`,
					false,
				)
				continue
			}
			assignment[local] = converted.value
			this.dropAttr(owner, local)
			const listExpression = local !== "assignee" && converted.value.startsWith("=")
			this.add(
				owner,
				`camunda:${local}`,
				listExpression ? "manual" : "convertible",
				listExpression
					? `${local} expression became "${converted.value}". Camunda 7 accepted a comma-separated string or a collection here; Camunda 8 requires a list of strings.`
					: `${local} became zeebe:assignmentDefinition ${local}="${converted.value}".`,
				listExpression
					? "Make sure the expression evaluates to a list of strings."
					: "zeebe:assignmentDefinition",
				true,
			)
		}
		if (Object.keys(assignment).length > 0) {
			const definition = this.zeebe(owner, "assignmentDefinition")
			if (definition !== undefined) Object.assign(definition.attributes, assignment)
		}

		const schedule: Record<string, string> = {}
		for (const local of ["dueDate", "followUpDate"]) {
			const value = this.attr(owner, local)
			if (value === undefined) continue
			const converted = this.staticOrExpression(value)
			const valid =
				converted.ok &&
				(converted.value.startsWith("=") || ISO_DATE_TIME_WITH_ZONE.test(converted.value))
			if (!converted.ok || !valid) {
				this.keepAttr(owner, local)
				this.add(
					owner,
					`camunda:${local}`,
					"manual",
					`${local} "${value}" is ${converted.ok ? "not an ISO 8601 date-time with a zone offset, which Camunda 8 requires" : `not translatable: ${converted.reason}`}.`,
					`Set zeebe:taskSchedule ${local} by hand.`,
					false,
				)
				continue
			}
			schedule[local] = converted.value
			this.dropAttr(owner, local)
			this.add(
				owner,
				`camunda:${local}`,
				"convertible",
				`${local} became zeebe:taskSchedule ${local}="${converted.value}".`,
				"zeebe:taskSchedule — the value must be an ISO 8601 date-time.",
				true,
			)
		}
		if (Object.keys(schedule).length > 0) {
			const definition = this.zeebe(owner, "taskSchedule")
			if (definition !== undefined) Object.assign(definition.attributes, schedule)
		}

		const priority = this.attr(owner, "priority")
		if (priority !== undefined) {
			const converted = this.staticOrExpression(priority)
			const number = Number(priority)
			const inRange = /^\d+$/.test(priority) && number >= 0 && number <= 100
			if (converted.ok && (inRange || converted.value.startsWith("="))) {
				const definition = this.zeebe(owner, "priorityDefinition")
				if (definition !== undefined) definition.attributes.priority = converted.value
				this.dropAttr(owner, "priority")
				this.add(
					owner,
					"camunda:priority",
					inRange ? "convertible" : "manual",
					inRange
						? `Priority ${priority} became zeebe:priorityDefinition.`
						: `Priority expression became "${converted.value}".`,
					inRange
						? "zeebe:priorityDefinition"
						: "Camunda 8 priorities range from 0 to 100; make sure the expression stays in range.",
					true,
				)
			} else {
				this.keepAttr(owner, "priority")
				this.add(
					owner,
					"camunda:priority",
					"manual",
					`Priority "${priority}" is outside Camunda 8's 0–100 range or not translatable.`,
					"Rescale it to 0–100 and set zeebe:priorityDefinition.",
					false,
				)
			}
		}

		this.convertForm(owner)

		for (const listener of this.exts(owner, "taskListener")) {
			this.keepExt(listener)
			const event = listener.attributes.event ?? "create"
			const c8Event = TASK_LISTENER_EVENTS[event]
			if (c8Event === undefined) {
				this.add(
					owner,
					"camunda:taskListener",
					"unsupported",
					`Camunda 8 has no task listener event like "${event}".`,
					event === "timeout"
						? "Model the timeout with a timer boundary event."
						: "Move the logic elsewhere.",
					false,
				)
				continue
			}
			this.add(
				owner,
				"camunda:taskListener",
				"manual",
				`Task listener on "${event}" (${describeImplementation(listener, this.prefix)}) runs code in the engine.`,
				`Implement it as a job worker and declare it with zeebe:taskListeners (eventType="${c8Event}").`,
				false,
			)
		}
	}

	private convertStartEvent(owner: Owner): void {
		if (this.attr(owner, "initiator") !== undefined) {
			this.keepAttr(owner, "initiator")
			this.add(
				owner,
				"camunda:initiator",
				"unsupported",
				"Camunda 8 does not record the starting user in a variable.",
				"Pass the user as a variable when creating the instance.",
				false,
			)
		}
		this.convertForm(owner)
	}

	private convertForm(owner: Owner): void {
		const formRef = this.attr(owner, "formRef")
		if (formRef !== undefined) {
			const formId = this.staticOrExpression(formRef)
			const definition =
				formId.ok && !formId.value.startsWith("=") ? this.zeebe(owner, "formDefinition") : undefined
			if (definition === undefined) {
				this.keepAttr(owner, "formRef")
				this.add(
					owner,
					"camunda:formRef",
					"manual",
					`Form reference "${formRef}" is an expression; a Camunda 8 form id is static.`,
					"Set zeebe:formDefinition formId by hand.",
					false,
				)
			} else {
				definition.attributes.formId = formRef
				this.dropAttr(owner, "formRef")
				this.convertBinding(owner, definition, "formRef")
				this.add(
					owner,
					"camunda:formRef",
					"convertible",
					`Camunda Form "${formRef}" linked with zeebe:formDefinition formId.`,
					"Deploy the .form file with the process; Camunda 7 and 8 share the form-js schema.",
					true,
				)
			}
		}
		const formKey = this.attr(owner, "formKey")
		if (formKey === undefined) return
		if (formKey.startsWith("camunda-forms:")) {
			this.keepAttr(owner, "formKey")
			this.add(
				owner,
				"camunda:formKey",
				"manual",
				`Form key "${formKey}" points at a .form file by path; Camunda 8 links forms by the id inside the file.`,
				"Open the .form file, and set zeebe:formDefinition formId to its id.",
				false,
			)
			return
		}
		const definition = owner.type === "userTask" ? this.zeebe(owner, "formDefinition") : undefined
		if (definition === undefined) {
			this.keepAttr(owner, "formKey")
			this.add(
				owner,
				"camunda:formKey",
				"manual",
				`Form key "${formKey}" on a ${owner.type} has no Camunda 8 counterpart.`,
				"Link a Camunda Form with zeebe:formDefinition formId.",
				false,
			)
			return
		}
		definition.attributes.externalReference = formKey
		this.dropAttr(owner, "formKey")
		const embedded = formKey.startsWith("embedded:")
		this.add(
			owner,
			"camunda:formKey",
			embedded ? "manual" : "convertible",
			`Form key "${formKey}" became a custom form reference (zeebe:formDefinition externalReference).`,
			embedded
				? "Tasklist does not render embedded HTML forms: rebuild it as a Camunda Form, or serve it from a custom task application that reads externalReference."
				: "Your task application resolves externalReference; Tasklist does not show custom forms.",
			true,
		)
	}

	// -----------------------------------------------------------------------
	// Call activities
	// -----------------------------------------------------------------------

	private convertCallActivity(owner: Owner): void {
		const calledElement = owner.unknownAttributes.calledElement
		if (calledElement !== undefined) {
			const processId = this.staticOrExpression(calledElement)
			const target = processId.ok ? this.zeebe(owner, "calledElement") : undefined
			if (!processId.ok || target === undefined) {
				this.add(
					owner,
					"calledElement",
					"manual",
					`Called element "${calledElement}" could not be translated${processId.ok ? "" : `: ${processId.reason}`}.`,
					"Set zeebe:calledElement processId by hand.",
					false,
				)
			} else {
				target.attributes.processId = processId.value
				this.convertBinding(owner, target, "calledElement")
				this.add(
					owner,
					"calledElement",
					"convertible",
					`Calls "${processId.value}" through zeebe:calledElement.`,
					"zeebe:calledElement",
					true,
				)
				this.convertVariablePassing(owner, target)
			}
		}
		if (this.attr(owner, "calledElementTenantId") !== undefined) {
			this.keepAttr(owner, "calledElementTenantId")
			this.add(
				owner,
				"camunda:calledElementTenantId",
				"unsupported",
				"Camunda 8 calls the process in the caller's tenant.",
				"Deploy the called process to the same tenant.",
				false,
			)
		}
		for (const local of ["variableMappingClass", "variableMappingDelegateExpression"]) {
			if (this.attr(owner, local) === undefined) continue
			this.keepAttr(owner, local)
			this.add(
				owner,
				`camunda:${local}`,
				"manual",
				"Delegated variable mapping runs Java in the engine.",
				"Express the mapping as zeebe:ioMapping inputs and outputs.",
				false,
			)
		}
		if (
			owner.unknownAttributes.caseRef !== undefined ||
			this.attr(owner, "caseRef") !== undefined
		) {
			this.keepAttr(owner, "caseRef")
			this.add(
				owner,
				"caseRef",
				"unsupported",
				"Camunda 8 has no CMMN.",
				"Model the case as a BPMN process (ad-hoc sub-process).",
				false,
			)
		}
	}

	/**
	 * Camunda 7 passes nothing across a call activity unless `camunda:in` /
	 * `camunda:out` say so; Camunda 8 passes everything by default. Both
	 * directions are pinned so the converted model keeps Camunda 7's scope.
	 */
	private convertVariablePassing(owner: Owner, calledElement: XmlElement): void {
		const ins = this.exts(owner, "in")
		const outs = this.exts(owner, "out")
		const allIn = ins.some((element) => element.attributes.variables === "all")
		const allOut = outs.some((element) => element.attributes.variables === "all")
		let mapped = 0
		const mapping = (direction: "input" | "output", element: XmlElement): boolean => {
			const target = element.attributes.target
			const source =
				element.attributes.sourceExpression !== undefined
					? this.feelValue(element.attributes.sourceExpression)
					: element.attributes.source !== undefined && isFeelName(element.attributes.source)
						? ({ ok: true, value: element.attributes.source } as const)
						: ({
								ok: false,
								reason: `"${element.attributes.source ?? ""}" is not a valid FEEL name`,
							} as const)
			if (
				target === undefined ||
				!isFeelPath(target) ||
				!source.ok ||
				element.attributes.local === "true"
			) {
				return false
			}
			const io = this.zeebe(owner, "ioMapping")
			io?.children.push({
				name: `zeebe:${direction}`,
				attributes: { source: `=${source.value}`, target },
				children: [],
			})
			mapped++
			return true
		}
		for (const element of ins) {
			if (element.attributes.variables === "all" && element.attributes.local !== "true") {
				this.dropExt(owner, element)
				continue
			}
			const businessKey = element.attributes.businessKey
			if (businessKey !== undefined) {
				if (/^[$#]\{\s*execution\.processBusinessKey\s*\}$/.test(businessKey.trim())) {
					this.dropExt(owner, element)
					this.add(
						owner,
						"camunda:in businessKey",
						"convertible",
						"Passing the parent's business key is Camunda 8's default: a child instance inherits the parent's business ID (Camunda 8.9+).",
						"Nothing to model on 8.9+. On earlier versions pass the key as a variable.",
						true,
					)
				} else {
					this.keepExt(element)
					this.add(
						owner,
						"camunda:in businessKey",
						"manual",
						`Business key expression "${businessKey}" was not converted.`,
						'Set zeebe:calledElement businessId="=…" (Camunda 8.10+).',
						false,
					)
				}
				continue
			}
			if (mapping("input", element)) this.dropExt(owner, element)
			else {
				this.keepExt(element)
				this.add(
					owner,
					"camunda:in",
					"manual",
					`Input variable mapping to "${element.attributes.target ?? ""}" was not converted.`,
					"Write it as a zeebe:input mapping by hand.",
					false,
				)
			}
		}
		for (const element of outs) {
			if (element.attributes.variables === "all" && element.attributes.local !== "true") {
				this.dropExt(owner, element)
				continue
			}
			if (mapping("output", element)) this.dropExt(owner, element)
			else {
				this.keepExt(element)
				this.add(
					owner,
					"camunda:out",
					"manual",
					`Output variable mapping to "${element.attributes.target ?? ""}" was not converted.`,
					"Write it as a zeebe:output mapping by hand.",
					false,
				)
			}
		}
		if (!allIn) calledElement.attributes.propagateAllParentVariables = "false"
		const hasOutputs = owner.extensionElements.some(
			(element) =>
				element.name === "zeebe:ioMapping" &&
				element.children.some((child) => child.name === "zeebe:output"),
		)
		if (!allOut && !hasOutputs) calledElement.attributes.propagateAllChildVariables = "false"
		if (ins.length + outs.length > 0 || !allIn) {
			this.add(
				owner,
				"camunda:in / camunda:out",
				"convertible",
				`Variable passing kept as in Camunda 7: ${allIn ? "all parent variables" : `${mapped > 0 ? "only mapped" : "no"} parent variables`} in, ${allOut ? "all child variables" : hasOutputs ? "only mapped child variables" : "no child variables"} out.`,
				"zeebe:calledElement propagateAllParentVariables / propagateAllChildVariables and zeebe:ioMapping",
				true,
			)
		}
	}

	// -----------------------------------------------------------------------
	// Scripts
	// -----------------------------------------------------------------------

	private convertScriptTask(owner: Owner): void {
		const format = owner.unknownAttributes.scriptFormat ?? ""
		const children = owner.unknownChildren ?? []
		const script = children.find((child) => localName(child.name) === "script")
		const resource = this.attr(owner, "resource")
		if (resource !== undefined) {
			this.keepAttr(owner, "resource")
			this.add(
				owner,
				"camunda:resource",
				"manual",
				`External script resource "${resource}" is not part of the model.`,
				"Inline it as a FEEL zeebe:script, or implement it as a job worker.",
				false,
			)
			return
		}
		const text = (script?.text ?? "").trim()
		const normalised = format.toLowerCase()
		const converted: Translated =
			normalised === "feel"
				? this.checkedFeel(text)
				: normalised === "juel"
					? (() => {
							const result = translateJuelToFeel(text)
							return result.ok
								? ({ ok: true, value: result.feel } as const)
								: ({ ok: false, reason: result.reason } as const)
						})()
					: { ok: false, reason: `${format || "untyped"} scripts do not run in Camunda 8` }
		const resultVariable = this.attr(owner, "resultVariable")
		if (!converted.ok || resultVariable === undefined) {
			if (resultVariable !== undefined) this.keepAttr(owner, "resultVariable")
			this.add(
				owner,
				`scriptFormat="${format}"`,
				"manual",
				converted.ok
					? "A FEEL script without camunda:resultVariable: Camunda 8 requires a result variable."
					: `Script was not converted: ${converted.reason}.`,
				"Rewrite it as a FEEL expression in zeebe:script (expression, resultVariable), or implement it as a job worker with zeebe:taskDefinition.",
				false,
			)
			return
		}
		const target = this.zeebe(owner, "script")
		if (target === undefined) return
		target.attributes.expression = `=${converted.value}`
		target.attributes.resultVariable = resultVariable
		this.dropAttr(owner, "resultVariable")
		Reflect.deleteProperty(owner.unknownAttributes, "scriptFormat")
		if (script !== undefined) children.splice(children.indexOf(script), 1)
		this.add(
			owner,
			`scriptFormat="${format}"`,
			"convertible",
			`${format.toUpperCase()} script became zeebe:script, result in "${resultVariable}".`,
			"zeebe:script",
			true,
		)
	}

	// -----------------------------------------------------------------------
	// Events, conditions, loops
	// -----------------------------------------------------------------------

	private checkCorrelation(owner: Owner, messageRef: string | undefined): void {
		if (messageRef === undefined || this.hasZeebe(owner, "subscription")) return
		const message = this.definitions.messages.find((candidate) => candidate.id === messageRef)
		if (message?.extensionElements?.some((element) => element.name === "zeebe:subscription")) return
		this.add(
			owner,
			"message correlation",
			"manual",
			`Camunda 7 correlates message "${message?.name ?? messageRef}" by API call (business key, process variables or instance id); the model names no key, and Camunda 8 requires one.`,
			`Add <zeebe:subscription correlationKey="=…"/> to message "${messageRef}", naming the variable publishers correlate on.`,
			false,
		)
	}

	private convertEventDefinitions(owner: Owner, definitions: BpmnEventDefinition[]): void {
		for (const definition of definitions) {
			if (definition.type === "timer") {
				for (const part of ["timeDuration", "timeDate", "timeCycle"] as const) {
					const value = definition[part]
					if (value === undefined) continue
					const trimmed = value.trim()
					if (containsJuel(trimmed)) {
						const converted = this.staticOrExpression(trimmed)
						if (converted.ok) {
							definition[part] = converted.value
							this.add(
								owner,
								`timer ${part}`,
								"convertible",
								`Timer expression "${trimmed}" became "${converted.value}".`,
								"FEEL timer expression",
								true,
							)
						} else {
							this.add(
								owner,
								`timer ${part}`,
								"manual",
								`Timer expression "${trimmed}" was not translated: ${converted.reason}.`,
								"Rewrite it as a FEEL expression returning an ISO 8601 duration, date-time or cycle.",
								false,
							)
						}
					} else if (part === "timeCycle" && !trimmed.startsWith("R") && /\s/.test(trimmed)) {
						this.add(
							owner,
							"timer timeCycle",
							"manual",
							`Cron cycle "${trimmed}" uses Camunda 7's Quartz-style syntax.`,
							"Check it against Camunda 8's cron syntax, or use an ISO 8601 repeating interval.",
							false,
						)
					}
				}
			}
			if (definition.type === "conditional" && definition.condition !== undefined) {
				const converted = this.condition(definition.condition, definition.conditionAttributes ?? {})
				if (converted.ok) {
					definition.condition = converted.value
					this.add(
						owner,
						"conditional event condition",
						"convertible",
						`Condition became "${converted.value}".`,
						"FEEL condition (conditional events need Camunda 8.9+)",
						true,
					)
				} else {
					this.add(
						owner,
						"conditional event condition",
						"manual",
						`Condition "${definition.condition}" was not translated: ${converted.reason}.`,
						"Rewrite it as a FEEL expression.",
						false,
					)
				}
			}
		}
		for (const definition of definitions) {
			for (const local of ["variableName", "variableEvents"]) {
				const value = this.attr(definition, local)
				if (value === undefined) continue
				this.keepAttr(definition, local)
				this.add(
					owner,
					`camunda:${local}`,
					"manual",
					`Conditional event filter ${local}="${value}" is not converted.`,
					"Use zeebe:conditionalFilter (variableNames, variableEvents).",
					false,
				)
			}
			for (const local of ["errorCodeVariable", "errorMessageVariable", "escalationCodeVariable"]) {
				const value = this.attr(definition, local)
				if (value === undefined) continue
				this.keepAttr(definition, local)
				this.add(
					owner,
					`camunda:${local}`,
					"manual",
					`Camunda 8 does not write the caught code or message into "${value}".`,
					"Have the thrower pass the values as variables and map them with an output mapping on the catch event.",
					false,
				)
			}
		}
	}

	/** A condition text as `=feel`, when its JUEL is provable. */
	private condition(text: string, attributes: Record<string, string>): Translated {
		const language = attributes.language
		if (language !== undefined && language.toLowerCase() !== "juel") {
			return { ok: false, reason: `it is a ${language} script condition` }
		}
		const trimmed = text.trim()
		if (trimmed.startsWith("=")) return { ok: true, value: trimmed }
		if (!containsJuel(trimmed)) return { ok: false, reason: "it is not a JUEL expression" }
		const result = translateJuelToFeel(trimmed)
		return result.ok ? { ok: true, value: `=${result.feel}` } : { ok: false, reason: result.reason }
	}

	private convertFlow(flow: BpmnSequenceFlow, owner: Owner): void {
		if (flow.conditionExpression !== undefined) {
			const { text, attributes } = flow.conditionExpression
			const converted = this.condition(text, attributes)
			if (converted.ok && converted.value !== text.trim()) {
				flow.conditionExpression.text = converted.value
				Reflect.deleteProperty(flow.conditionExpression.attributes, "language")
				this.add(
					owner,
					"conditionExpression",
					"convertible",
					`Condition "${text.trim()}" became "${converted.value}".`,
					"FEEL condition",
					true,
				)
			} else if (!converted.ok) {
				this.add(
					owner,
					"conditionExpression",
					"manual",
					`Condition "${text.trim()}" was not translated: ${converted.reason}.`,
					"Rewrite it as a FEEL expression (=…).",
					false,
				)
			}
		}
		this.convertCommon(owner)
	}

	private convertLoop(owner: Owner, loop: BpmnMultiInstanceLoopCharacteristics): void {
		if (!loop.extensionElements.some((element) => element.name === "zeebe:loopCharacteristics")) {
			const collection = this.attr(loop, "collection")
			const elementVariable = this.attr(loop, "elementVariable")
			if (collection !== undefined) {
				const source = containsJuel(collection)
					? this.staticOrExpression(collection)
					: isFeelName(collection)
						? ({ ok: true, value: `=${collection}` } as const)
						: ({ ok: false, reason: `"${collection}" is not a valid FEEL name` } as const)
				if (source.ok) {
					const attributes: Record<string, string> = { inputCollection: source.value }
					if (elementVariable !== undefined) attributes.inputElement = elementVariable
					this.dropAttr(loop, "collection")
					this.dropAttr(loop, "elementVariable")
					loop.extensionElements.push({
						name: "zeebe:loopCharacteristics",
						attributes,
						children: [],
					})
					this.add(
						owner,
						"camunda:collection",
						"convertible",
						`Multi-instance over "${collection}" became zeebe:loopCharacteristics inputCollection="${source.value}"${attributes.inputElement === undefined ? "" : ` inputElement="${attributes.inputElement}"`}.`,
						"zeebe:loopCharacteristics",
						true,
					)
				} else {
					this.keepAttr(loop, "collection")
					this.keepAttr(loop, "elementVariable")
					this.add(
						owner,
						"camunda:collection",
						"manual",
						`Multi-instance collection "${collection}" was not translated: ${source.reason}.`,
						"Set zeebe:loopCharacteristics inputCollection by hand.",
						false,
					)
				}
			} else if (loop.loopCardinality !== undefined) {
				this.add(
					owner,
					"loopCardinality",
					"manual",
					`Camunda 8 has no loop cardinality ("${loop.loopCardinality.text.trim()}"); a multi-instance activity iterates over a collection.`,
					'Set zeebe:loopCharacteristics inputCollection, e.g. "=for i in 1..n return i" when n ≥ 1.',
					false,
				)
			} else {
				this.add(
					owner,
					"multiInstanceLoopCharacteristics",
					"manual",
					"The multi-instance activity names no collection.",
					"Set zeebe:loopCharacteristics inputCollection (and inputElement).",
					false,
				)
			}
		}
		if (loop.completionCondition !== undefined) {
			const text = loop.completionCondition.text.trim()
			if (containsJuel(text)) {
				const converted = this.staticOrExpression(text, true)
				if (converted.ok) {
					loop.completionCondition.text = converted.value
					this.add(
						owner,
						"completionCondition",
						"convertible",
						`Completion condition became "${converted.value}" (nrOf… variables renamed to numberOf…).`,
						"FEEL completion condition",
						true,
					)
				} else {
					this.add(
						owner,
						"completionCondition",
						"manual",
						`Completion condition "${text}" was not translated: ${converted.reason}.`,
						"Rewrite it as a FEEL expression.",
						false,
					)
				}
			}
		}
	}

	private setExecutionPlatform(): void {
		const d = this.definitions
		const version = this.options.executionPlatformVersion ?? DEFAULT_PLATFORM_VERSION
		const before = d.unknownAttributes["modeler:executionPlatform"]
		d.namespaces.zeebe ??= ZEEBE_NS
		d.namespaces.modeler ??= MODELER_NS
		d.unknownAttributes["modeler:executionPlatform"] = "Camunda Cloud"
		d.unknownAttributes["modeler:executionPlatformVersion"] = version
		this.processId = ""
		this.add(
			{ id: d.id, type: "definitions" },
			"modeler:executionPlatform",
			"convertible",
			`Execution platform set to Camunda Cloud ${version}${before === undefined ? "" : ` (was ${before})`}.`,
			"Camunda Modeler opens the file as a Camunda 8 diagram.",
			true,
		)
	}
}

const DELEGATE_LABEL: Readonly<Record<string, string>> = {
	class: "Java delegate class",
	delegateExpression: "Delegate expression",
	expression: "Expression",
}

const TASK_LISTENER_EVENTS: Readonly<Record<string, string>> = {
	create: "creating",
	assignment: "assigning",
	update: "updating",
	complete: "completing",
	delete: "canceling",
}

function describeImplementation(listener: XmlElement, prefix: string | undefined): string {
	for (const key of ["class", "delegateExpression", "expression"]) {
		const value = listener.attributes[key]
		if (value !== undefined) return `${key} "${value}"`
	}
	const script = listener.children.find((child) => child.name === `${prefix ?? "camunda"}:script`)
	return script === undefined
		? "no implementation"
		: `${script.attributes.scriptFormat ?? "script"} script`
}

/** A Camunda 8 mapping target: a FEEL name, optionally a dotted path into a context. */
function isFeelPath(target: string): boolean {
	return target.split(".").every((part) => isFeelName(part))
}
