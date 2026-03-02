import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";

/** Input field types supported by the config panel renderer. */
export type FieldType = "text" | "select" | "textarea" | "feel-expression" | "toggle" | "action";

export interface SelectOption {
	value: string;
	label: string;
}

/** Describes a single configurable field. */
export interface FieldSchema {
	/** Unique key used to read/write the value via the adapter. */
	key: string;
	label: string;
	type: FieldType;
	placeholder?: string;
	/** Options for `select` fields. */
	options?: SelectOption[];
	/** Short hint displayed below the field. */
	hint?: string;
	/** Tooltip text shown on hover over the field label. */
	tooltip?: string;
	/** Link to external documentation. */
	docsUrl?: string;
	/** Mask the input (password-style) for secret values. */
	secret?: boolean;
	/** If true, the field is mandatory — shown with an asterisk and a red border when empty. */
	required?: boolean;
	/** If provided, the field is only shown when this returns true. */
	condition?: (values: Record<string, FieldValue>) => boolean;
	/**
	 * For `type: "action"` fields — called when the button is clicked.
	 * Receives the current field values and a `setValue` helper that updates a
	 * field in the panel and immediately writes it back to the diagram.
	 */
	onClick?: (
		values: Record<string, FieldValue>,
		setValue: (key: string, val: FieldValue) => void,
	) => void;
	/**
	 * For `type: "feel-expression"` fields — optional callback to open the
	 * expression in an external playground/editor.
	 */
	openInPlayground?: (values: Record<string, FieldValue>) => void;
}

/** A named group of fields shown as a section in the full editor. */
export interface GroupSchema {
	id: string;
	label: string;
	fields: FieldSchema[];
	/** If provided, the group (and its tab) is only shown when this returns true. */
	condition?: (values: Record<string, FieldValue>) => boolean;
}

/** Describes the full config panel for an element type. */
export interface PanelSchema {
	/** Optional link to documentation for this element type. Shown as a ? button in the panel header. */
	docsUrl?: string;
	/** Optional connector/template name shown in the panel header (e.g. "REST Connector"). */
	templateName?: string;
	/** Fields shown in the compact (right-rail) panel. */
	compact: FieldSchema[];
	/** All field groups shown in the full overlay editor. */
	groups: GroupSchema[];
}

export type FieldValue = string | boolean | undefined;

/** Bridges between the generic field schema and the BPMN data model. */
export interface PanelAdapter {
	/** Read current values for the selected element. */
	read(defs: BpmnDefinitions, id: string): Record<string, FieldValue>;
	/** Apply updated values and return new definitions. */
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions;
	/**
	 * Optional: dynamically resolve a different schema+adapter for this specific element instance.
	 * Called on each select and diagram-change event. When it returns non-null the renderer uses
	 * the returned registration instead of the one stored in the schema registry.
	 *
	 * Typical use: detect a `zeebe:modelerTemplate` attribute and switch to the matching template
	 * schema without requiring a separate registration for every possible template.
	 */
	resolve?(
		defs: BpmnDefinitions,
		id: string,
	): { schema: PanelSchema; adapter: PanelAdapter } | null;
}

/** The config panel plugin — extends CanvasPlugin with a schema registration API. */
export interface ConfigPanelPlugin extends CanvasPlugin {
	registerSchema(elementType: string, schema: PanelSchema, adapter: PanelAdapter): void;
}

export interface ConfigPanelOptions {
	getDefinitions: () => BpmnDefinitions | null;
	applyChange: (fn: (defs: BpmnDefinitions) => BpmnDefinitions) => void;
	/** Render into this element instead of document.body. */
	container?: HTMLElement;
	/** Called when an element is selected and the panel appears. */
	onPanelShow?: () => void;
	/** Called when the panel is hidden (element deselected). */
	onPanelHide?: () => void;
}
