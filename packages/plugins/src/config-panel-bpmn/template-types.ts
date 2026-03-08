/**
 * TypeScript types matching the Camunda element template JSON schema.
 * https://github.com/camunda/element-templates-json-schema
 */

export interface ElementTemplate {
	/** Unique template identifier (reverse-domain, e.g. "io.camunda.connectors.HttpJson.v2"). */
	id: string;
	/** Display name shown in the template catalog. */
	name: string;
	/** Short description. */
	description?: string;
	/** Integer version; templates with the same id + different version are distinct. */
	version?: number;
	/** BPMN element types this template applies to (e.g. "bpmn:ServiceTask", "bpmn:Task"). */
	appliesTo: string[];
	/** Forces the element to be converted to this type on apply. */
	elementType?: { value: string };
	/** UI section definitions (collapsible groups). */
	groups?: TemplateGroup[];
	/** All property definitions. */
	properties: TemplateProperty[];
	/** Link to external documentation. */
	documentationRef?: string;
	/** Custom icon: { contents: "data:image/svg+xml;base64,..." } */
	icon?: { contents: string };
}

export interface TemplateGroup {
	id: string;
	label: string;
	tooltip?: string;
	openByDefault?: boolean;
}

export interface TemplateProperty {
	/** Unique key used in condition references. Falls back to binding name if absent. */
	id?: string;
	/** Label shown above the input. Hidden properties have no label. */
	label?: string;
	/** Hint text shown below the input. */
	description?: string;
	/** UI control type. */
	type: "String" | "Text" | "Hidden" | "Dropdown" | "Boolean" | "Number";
	/** Default value applied when the template is first used. */
	value?: string | number | boolean;
	/** Placeholder text. */
	placeholder?: string;
	/** If true, empty values are not written to the BPMN XML. */
	optional?: boolean;
	/** FEEL expression mode (only relevant for String/Text). */
	feel?: "optional" | "required" | "static";
	/** Which template group this property belongs to. */
	group?: string;
	/** Tooltip text. */
	tooltip?: string;
	/** How this property maps to the BPMN XML. */
	binding: TemplateBinding;
	/** Conditional visibility. */
	condition?: TemplateCondition;
	/** Required for Dropdown type. */
	choices?: Array<{ name: string; value: string }>;
	/** Validation constraints. */
	constraints?: {
		notEmpty?: boolean;
		minLength?: number;
		maxLength?: number;
		pattern?: string | { value: string; message: string };
	};
}

/** All supported binding types. */
export type TemplateBinding =
	| { type: "property"; name: string }
	/** @deprecated Use zeebe:taskDefinition with property field instead. */
	| { type: "zeebe:taskDefinition:type" }
	| { type: "zeebe:taskDefinition"; property: "type" | "retries" }
	| { type: "zeebe:input"; name: string }
	| { type: "zeebe:output"; source: string }
	| { type: "zeebe:taskHeader"; key: string }
	| { type: "zeebe:property"; name: string }
	| {
			type: "zeebe:adHoc";
			property: "outputCollection" | "outputElement" | "activeElementsCollection";
	  };

/** Condition controlling whether a property is shown in the UI. */
export type TemplateCondition =
	| { property: string; equals: string; type?: string }
	| { property: string; oneOf: string[]; type?: string }
	| { property: string; isActive: boolean; type?: string }
	| {
			allMatch: Array<{ property: string; equals?: string; oneOf?: string[]; isActive?: boolean }>;
	  };
