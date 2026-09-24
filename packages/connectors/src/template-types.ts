/**
 * TypeScript types matching the Camunda element template JSON schema.
 * https://github.com/camunda/element-templates-json-schema
 */

export interface ElementTemplate {
	/** Unique template identifier (reverse-domain, e.g. "io.camunda.connectors.HttpJson.v2"). */
	id: string
	/** Display name shown in the template catalog. */
	name: string
	/** Short description. */
	description?: string
	/** Integer version; templates with the same id + different version are distinct. */
	version?: number
	/** BPMN element types this template applies to (e.g. "bpmn:ServiceTask", "bpmn:Task"). */
	appliesTo: string[]
	/**
	 * Forces the element to be converted to this type on apply. `eventDefinition`
	 * (e.g. `"bpmn:MessageEventDefinition"`) makes an event the matching kind.
	 */
	elementType?: { value: string; eventDefinition?: string }
	/** UI section definitions (collapsible groups). */
	groups?: TemplateGroup[]
	/** All property definitions. */
	properties: TemplateProperty[]
	/** Link to external documentation. */
	documentationRef?: string
	/** Custom icon: { contents: "data:image/svg+xml;base64,..." } */
	icon?: { contents: string }
}

export interface TemplateGroup {
	id: string
	label: string
	tooltip?: string
	openByDefault?: boolean
}

export interface TemplateProperty {
	/** Unique key used in condition references. Falls back to binding name if absent. */
	id?: string
	/** Label shown above the input. Hidden properties have no label. */
	label?: string
	/** Hint text shown below the input. */
	description?: string
	/** UI control type. */
	type: "String" | "Text" | "Hidden" | "Dropdown" | "Boolean" | "Number"
	/** Default value applied when the template is first used. */
	value?: string | number | boolean
	/**
	 * A value generated once per element when none is given — inbound templates
	 * use it for a unique message name. `applyTemplateToElement` derives it from
	 * the template and element ids, so re-applying produces the same value.
	 */
	generatedValue?: { type: "uuid" }
	/** Placeholder text. */
	placeholder?: string
	/** If true, empty values are not written to the BPMN XML. */
	optional?: boolean
	/** FEEL expression mode (only relevant for String/Text). */
	feel?: "optional" | "required" | "static"
	/** Which template group this property belongs to. */
	group?: string
	/** Tooltip text. */
	tooltip?: string
	/** How this property maps to the BPMN XML. */
	binding: TemplateBinding
	/** Conditional visibility. */
	condition?: TemplateCondition
	/** Required for Dropdown type. */
	choices?: Array<{ name: string; value: string }>
	/** Validation constraints. */
	constraints?: {
		notEmpty?: boolean
		minLength?: number
		maxLength?: number
		pattern?: string | { value: string; message: string }
	}
}

/** All supported binding types. */
export type TemplateBinding =
	| { type: "property"; name: string }
	/**
	 * Camunda's legacy spelling of the binding below, superseded upstream by
	 * `{ type: "zeebe:taskDefinition", property: "type" }`.
	 *
	 * Not deprecated *here*, and not going anywhere: templates in the wild — the
	 * bundled catalogue included — still use it, and `apply`, `catalog` and
	 * `validate` all handle it. Under the stability policy a template that
	 * validates today does not stop validating, so this member stays in the union
	 * however long upstream keeps the form alive. Prefer the newer spelling when
	 * authoring; expect this one when reading.
	 */
	| { type: "zeebe:taskDefinition:type" }
	| { type: "zeebe:taskDefinition"; property: "type" | "retries" }
	| { type: "zeebe:input"; name: string }
	| { type: "zeebe:output"; source: string }
	| { type: "zeebe:taskHeader"; key: string }
	| { type: "zeebe:property"; name: string }
	| {
			type: "zeebe:adHoc"
			property: "outputCollection" | "outputElement" | "activeElementsCollection"
	  }
	/**
	 * Inbound-connector bindings — the root `bpmn:Message` an event or receive
	 * task references, and that message's `zeebe:subscription` — and the
	 * `zeebe:linkedResources` binding used by RPA templates.
	 */
	| { type: "bpmn:Message#property"; name: string }
	| { type: "bpmn:Message#zeebe:subscription#property"; name: string }
	| { type: "zeebe:linkedResource"; property: string; linkName: string }

/** Condition controlling whether a property is shown in the UI. */
export type TemplateCondition =
	| { property: string; equals: string; type?: string }
	| { property: string; oneOf: string[]; type?: string }
	| { property: string; isActive: boolean; type?: string }
	| {
			allMatch: Array<{ property: string; equals?: string; oneOf?: string[]; isActive?: boolean }>
	  }
