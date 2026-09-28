import type {
	AdHocSubProcessOptions,
	BoundaryEventOptions,
	IntermediateCatchEventOptions,
	ServiceTaskOptions,
	StartEventOptions,
} from "@bpmnkit/core"
import { parseExpression } from "@bpmnkit/feel"
import { getTemplate, propertyKey } from "./catalog.js"
import type {
	ElementTemplate,
	TemplateBinding,
	TemplateCondition,
	TemplateProperty,
} from "./template-types.js"

export interface ApplyProblem {
	/** The property key this problem is about, if any. */
	key?: string
	message: string
	/**
	 * What kind of problem this is — distinguishes a genuinely unmet required
	 * field ("missing-required") from an unrecognized values key
	 * ("unknown-key"), a FEEL syntax error ("invalid-feel"), or a template
	 * with no resolvable task type ("no-task-type"). Callers that specifically
	 * want "what's still required" (e.g. the deploy-lint connector check)
	 * must filter on `kind === "missing-required"` — an unknown key is not
	 * evidence that some other field is missing.
	 */
	kind?: "missing-required" | "unknown-key" | "invalid-feel" | "no-task-type"
}

/**
 * The result of applying a connector template — exactly one of `serviceTask`,
 * `adHocSubProcess`, `startEvent`, `boundaryEvent`, or `intermediateEvent` is
 * set, matching the template's direction. `problems` is always present and
 * must be checked: a non-empty array means the template could not be fully
 * applied (missing required value, unknown value key, or a FEEL parse error).
 */
export interface ApplyResult {
	serviceTask?: ServiceTaskOptions
	adHocSubProcess?: Partial<AdHocSubProcessOptions>
	startEvent?: Partial<StartEventOptions>
	boundaryEvent?: Partial<BoundaryEventOptions>
	intermediateEvent?: Partial<IntermediateCatchEventOptions>
	problems: ApplyProblem[]
}

/** Everything a template's active properties resolve to, before it is written anywhere. */
export interface Accumulator {
	inputs: Array<{ source: string; target: string }>
	outputs: Array<{ source: string; target: string }>
	taskHeaders: Record<string, string>
	zeebeProperties: Array<{ name: string; value: string }>
	taskType?: string
	retries?: string
	adHoc: { outputCollection?: string; outputElement?: string; activeElementsCollection?: string }
	/** `bpmn:Message#property` bindings — attribute name to value, e.g. `name`. */
	message: Record<string, string>
	/** `bpmn:Message#zeebe:subscription#property` bindings, e.g. `correlationKey`. */
	subscription: Record<string, string>
	/** `zeebe:linkedResource` bindings, by `linkName` in template order. */
	linkedResources: Map<string, Record<string, string>>
}

function evalCondition(cond: TemplateCondition, values: Record<string, string>): boolean {
	if ("allMatch" in cond) {
		return cond.allMatch.every((c) => evalCondition(c as TemplateCondition, values))
	}
	// `String()` because a Boolean property's condition compares against `true`/`false`,
	// while every resolved value is the string the XML will carry.
	if ("equals" in cond) return values[cond.property] === String(cond.equals)
	if ("oneOf" in cond) return cond.oneOf.includes(values[cond.property] ?? "")
	if ("isActive" in cond) return Boolean(values[cond.property]) === cond.isActive
	return true
}

function defaultValueOf(prop: TemplateProperty): string | undefined {
	if (prop.value === undefined) return undefined
	return String(prop.value)
}

/** Resolves every property to its effective string value: user override, else template default. */
function resolveValues(
	template: ElementTemplate,
	values: Record<string, string>,
): Record<string, string> {
	const resolved: Record<string, string> = {}
	for (const prop of template.properties) {
		const key = propertyKey(prop)
		if (!key) continue
		const value = values[key] ?? defaultValueOf(prop)
		if (value !== undefined) resolved[key] = value
	}
	return resolved
}

/**
 * The binding types `applyBinding` below writes.
 *
 * Declared beside the switch so the two are edited together: anything the
 * switch gains belongs here, and `validateElementTemplate` warns about every
 * binding that is valid but absent from this set — otherwise a template using
 * one would apply silently and do nothing.
 */
export const APPLIED_BINDING_TYPES: ReadonlySet<string> = new Set([
	"zeebe:input",
	"zeebe:output",
	"zeebe:taskHeader",
	"zeebe:taskDefinition",
	"zeebe:taskDefinition:type",
	"zeebe:property",
	"zeebe:adHoc",
	"property",
	"bpmn:Message#property",
	"bpmn:Message#zeebe:subscription#property",
	"zeebe:linkedResource",
])

function applyBinding(binding: TemplateBinding, value: string, accum: Accumulator): void {
	switch (binding.type) {
		case "zeebe:input":
			accum.inputs.push({ source: value, target: binding.name })
			return
		case "zeebe:output":
			// `binding.source` is the template's fixed FEEL read expression (e.g. "=response");
			// `value` is the user-chosen process-variable name to write it to.
			accum.outputs.push({ source: binding.source, target: value })
			return
		case "zeebe:taskHeader":
			accum.taskHeaders[binding.key] = value
			return
		case "zeebe:taskDefinition":
			if (binding.property === "type") accum.taskType = value
			else accum.retries = value
			return
		case "zeebe:taskDefinition:type":
			accum.taskType = value
			return
		case "zeebe:property":
			accum.zeebeProperties.push({ name: binding.name, value })
			return
		case "zeebe:adHoc":
			accum.adHoc[binding.property] = value
			return
		case "property":
			// "name" binds to the element's display name — handled by the caller, not here.
			return
		case "bpmn:Message#property":
			accum.message[binding.name] = value
			return
		case "bpmn:Message#zeebe:subscription#property":
			accum.subscription[binding.name] = value
			return
		case "zeebe:linkedResource": {
			const link = accum.linkedResources.get(binding.linkName) ?? {}
			link[binding.property] = value
			accum.linkedResources.set(binding.linkName, link)
			return
		}
		default:
			return
	}
}

/** A binding the template resolved but the builder options have no field for. */
function notExpressible(what: string): ApplyProblem {
	return {
		message: `${what} cannot be carried by builder options — use applyTemplateToElement() to write the template onto a model instead.`,
	}
}

function directionOf(template: ElementTemplate): string {
	return template.elementType?.value ?? template.appliesTo[0] ?? ""
}

/**
 * Resolves a template and a set of values into the bindings its active
 * properties write — the half of applying a template that does not depend on
 * where the result goes, shared by {@link applyElementTemplate} and
 * `applyTemplateToElement`.
 *
 * @param generate - Supplies a value for an active property that declares a
 *   `generatedValue` and was given none. Returning `undefined` leaves the
 *   binding unwritten; the callback reports that however suits its caller.
 */
export function resolveBindings(
	template: ElementTemplate,
	values: Record<string, string>,
	generate: (key: string, prop: TemplateProperty) => string | undefined,
): { accum: Accumulator; problems: ApplyProblem[] } {
	const resolved = resolveValues(template, values)
	const problems: ApplyProblem[] = []

	const knownKeys = new Set(template.properties.map(propertyKey).filter(Boolean))
	for (const key of Object.keys(values)) {
		if (key !== "name" && !knownKeys.has(key)) {
			problems.push({
				key,
				kind: "unknown-key",
				message: `Unknown value key "${key}" for template "${template.id}"`,
			})
		}
	}

	const accum: Accumulator = {
		inputs: [],
		outputs: [],
		taskHeaders: {},
		zeebeProperties: [],
		adHoc: {},
		message: {},
		subscription: {},
		linkedResources: new Map(),
	}

	for (const prop of template.properties) {
		const key = propertyKey(prop)
		if (prop.condition && !evalCondition(prop.condition, resolved)) continue

		let value = resolved[key]
		if ((value === undefined || value === "") && prop.generatedValue) {
			value = generate(key, prop)
		}
		if (value === undefined || value === "") {
			if (prop.type !== "Hidden" && prop.constraints?.notEmpty) {
				problems.push({
					key,
					kind: "missing-required",
					message: `Missing required value for "${prop.label ?? key}" (${key})`,
				})
			}
			continue
		}

		if ((prop.feel === "required" || prop.feel === "optional") && value.startsWith("=")) {
			const { errors } = parseExpression(value.slice(1))
			for (const err of errors) {
				problems.push({
					key,
					kind: "invalid-feel",
					message: `Invalid FEEL expression for "${key}": ${err.message}`,
				})
			}
		}

		applyBinding(prop.binding, value, accum)
	}

	return { accum, problems }
}

/**
 * Applies a Camunda 8 out-of-the-box connector element template deterministically.
 *
 * Unlike a naive apply that only handles `zeebe:input`, this resolves every
 * binding kind (`zeebe:input`, `zeebe:output`, `zeebe:taskHeader`,
 * `zeebe:taskDefinition(:type)`, `zeebe:property`, `zeebe:adHoc`), respects
 * dropdown-gated `condition`s, validates required fields, and parse-validates
 * any value that looks like a FEEL expression (leading "=").
 *
 * The result is builder options, which have no field for some bindings: a
 * message start event's correlation key and `zeebe:linkedResource` come back
 * as problems rather than being dropped, and a message name the template
 * generates per element (`generatedValue`) must be passed in `values`. Inbound
 * intermediate and boundary templates' `zeebe:property` bindings are returned
 * but not written by `@bpmnkit/core`'s builder. {@link applyTemplateToElement}
 * writes every binding onto an existing element of a parsed model instead.
 *
 * `values` keys match `ConnectorSummary.requiredInputs[].key` /
 * `optionalInputs[].key` from `listConnectors()`/`searchConnectors()`.
 *
 * Operates on any {@link ElementTemplate} object — not just the bundled OOTB
 * catalog — so custom/generated templates (e.g. from `@bpmnkit/connector-gen`)
 * work the same way. Use {@link applyConnectorTemplate} to apply by bundled
 * template id instead.
 */
export function applyElementTemplate(
	template: ElementTemplate,
	values: Record<string, string> = {},
): ApplyResult {
	const ungenerated: string[] = []
	const { accum, problems } = resolveBindings(template, values, (key) => {
		ungenerated.push(key)
		return undefined
	})
	// Builder options name no element, so there is nothing to derive a per-element value from.
	for (const key of ungenerated) {
		problems.push({
			key,
			message:
				`"${key}" is generated per element (generatedValue) and no value was given. ` +
				`Pass values["${key}"], or apply with applyTemplateToElement(), which derives one from the element id.`,
		})
	}
	if (accum.linkedResources.size > 0) {
		problems.push(notExpressible("zeebe:linkedResource bindings"))
	}

	const modelerTemplate = template.id
	const modelerTemplateVersion =
		template.version !== undefined ? String(template.version) : undefined
	const modelerTemplateIcon = template.icon?.contents
	const name = values.name ?? template.name

	const direction = directionOf(template)

	if (direction === "bpmn:AdHocSubProcess") {
		return {
			adHocSubProcess: {
				name,
				taskDefinition: accum.taskType
					? { type: accum.taskType, retries: accum.retries }
					: undefined,
				ioMapping:
					accum.inputs.length || accum.outputs.length
						? { inputs: accum.inputs, outputs: accum.outputs }
						: undefined,
				taskHeaders: Object.keys(accum.taskHeaders).length > 0 ? accum.taskHeaders : undefined,
				zeebeProperties: accum.zeebeProperties.length > 0 ? accum.zeebeProperties : undefined,
				outputCollection: accum.adHoc.outputCollection,
				outputElement: accum.adHoc.outputElement,
				activeElementsCollection: accum.adHoc.activeElementsCollection,
				modelerTemplate,
				modelerTemplateVersion,
				modelerTemplateIcon,
			},
			problems,
		}
	}

	if (
		direction === "bpmn:StartEvent" ||
		direction === "bpmn:BoundaryEvent" ||
		direction === "bpmn:IntermediateCatchEvent" ||
		direction === "bpmn:ReceiveTask"
	) {
		if (
			accum.inputs.length > 0 ||
			accum.outputs.length > 0 ||
			Object.keys(accum.taskHeaders).length > 0
		) {
			problems.push({
				message:
					"Template uses zeebe:input/output/taskHeader bindings on an event-attached element; " +
					"applyConnectorTemplate() only maps zeebe:property for start/boundary/intermediate events. " +
					"Apply the remaining bindings manually.",
			})
		}
		const partial = {
			name,
			zeebeProperties: accum.zeebeProperties.length > 0 ? accum.zeebeProperties : undefined,
			modelerTemplate,
			modelerTemplateVersion,
			modelerTemplateIcon,
			messageName: accum.message.name,
		}
		const correlationKey = accum.subscription.correlationKey
		if (direction === "bpmn:StartEvent") {
			if (correlationKey !== undefined) {
				problems.push(notExpressible("A message start event's correlation key"))
			}
			return { startEvent: partial, problems }
		}
		if (direction === "bpmn:BoundaryEvent") {
			return { boundaryEvent: { ...partial, correlationKey }, problems }
		}
		return { intermediateEvent: { ...partial, correlationKey }, problems }
	}

	// Default: outbound service task (bpmn:ServiceTask, bpmn:SendTask, bpmn:EndEvent, bpmn:Task, ...)
	if (!accum.taskType) {
		problems.push({
			kind: "no-task-type",
			message: `Template "${template.id}" produced no zeebe:taskDefinition type`,
		})
	}
	return {
		serviceTask: {
			name,
			taskType: accum.taskType ?? "",
			retries: accum.retries,
			ioMapping:
				accum.inputs.length || accum.outputs.length
					? { inputs: accum.inputs, outputs: accum.outputs }
					: undefined,
			taskHeaders: Object.keys(accum.taskHeaders).length > 0 ? accum.taskHeaders : undefined,
			zeebeProperties: accum.zeebeProperties.length > 0 ? accum.zeebeProperties : undefined,
			modelerTemplate,
			modelerTemplateVersion,
			modelerTemplateIcon,
		},
		problems,
	}
}

/**
 * Applies a bundled Camunda 8 out-of-the-box connector element template by
 * id — see {@link applyElementTemplate} for the full binding-resolution
 * behavior. Returns a single `problems` entry if `templateId` isn't in the
 * bundled catalog (use `applyElementTemplate` directly for custom templates).
 */
export function applyConnectorTemplate(
	templateId: string,
	values: Record<string, string> = {},
): ApplyResult {
	const template = getTemplate(templateId)
	if (!template) {
		return { problems: [{ message: `Unknown connector template "${templateId}"` }] }
	}
	return applyElementTemplate(template, values)
}
