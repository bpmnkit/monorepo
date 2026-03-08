/** Layout positioning for a form component. */
export interface FormLayout {
	row?: string;
	columns?: number | null;
}

/** Validation constraints for a form field. */
export interface FormValidation {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
}

/** A label/value option used by select, radio, and checklist components. */
export interface FormValueOption {
	label: string;
	value: string;
}

/** Base properties shared by all form components. */
interface FormComponentBase {
	id: string;
	type: string;
	layout?: FormLayout;
}

/** Static text/markdown display component. */
export interface FormTextComponent extends FormComponentBase {
	type: "text";
	text: string;
	label?: string;
}

/** Single-line text input. */
export interface FormTextFieldComponent extends FormComponentBase {
	type: "textfield";
	label: string;
	key: string;
	validate?: FormValidation;
	defaultValue?: string;
}

/** Multi-line text input. */
export interface FormTextAreaComponent extends FormComponentBase {
	type: "textarea";
	label: string;
	key: string;
	validate?: FormValidation;
	defaultValue?: string;
}

/** Dropdown select input. */
export interface FormSelectComponent extends FormComponentBase {
	type: "select";
	label: string;
	key: string;
	values?: FormValueOption[];
	valuesKey?: string;
	validate?: FormValidation;
	searchable?: boolean;
	defaultValue?: string;
}

/** Radio button group. */
export interface FormRadioComponent extends FormComponentBase {
	type: "radio";
	label: string;
	key: string;
	values: FormValueOption[];
	validate?: FormValidation;
	defaultValue?: string;
}

/** Single checkbox. */
export interface FormCheckboxComponent extends FormComponentBase {
	type: "checkbox";
	label: string;
	key: string;
	validate?: FormValidation;
	defaultValue?: boolean;
}

/** Multi-select checklist. */
export interface FormChecklistComponent extends FormComponentBase {
	type: "checklist";
	label: string;
	key: string;
	values: FormValueOption[];
	validate?: FormValidation;
}

/** Container that groups nested components. */
export interface FormGroupComponent extends FormComponentBase {
	type: "group";
	label: string;
	components: FormComponent[];
	showOutline?: boolean;
}

/** Numeric input field. */
export interface FormNumberComponent extends FormComponentBase {
	type: "number";
	label: string;
	key: string;
	validate?: FormValidation;
	defaultValue?: number;
}

/** Date and/or time picker. */
export interface FormDatetimeComponent extends FormComponentBase {
	type: "datetime";
	key: string;
	/** Subtype: "date", "time", or "datetime". */
	subtype?: string;
	dateLabel?: string;
	timeLabel?: string;
	validate?: FormValidation;
}

/** Submit or action button. */
export interface FormButtonComponent extends FormComponentBase {
	type: "button";
	label: string;
	/** Button action: "submit" or "reset". */
	action?: string;
}

/** Multi-value tag list input. */
export interface FormTaglistComponent extends FormComponentBase {
	type: "taglist";
	label: string;
	key: string;
	values?: FormValueOption[];
	valuesKey?: string;
	validate?: FormValidation;
}

/** Read-only data table. */
export interface FormTableComponent extends FormComponentBase {
	type: "table";
	label?: string;
	dataSource?: string;
	rowCount?: number;
	columns?: Array<{ label: string; key: string }>;
}

/** Image display component. */
export interface FormImageComponent extends FormComponentBase {
	type: "image";
	/** URL or FEEL expression for the image source. */
	source?: string;
	alt?: string;
}

/** Repeating list of sub-components. */
export interface FormDynamicListComponent extends FormComponentBase {
	type: "dynamiclist";
	label?: string;
	path?: string;
	components: FormComponent[];
	isRepeating?: boolean;
	allowAddRemove?: boolean;
	defaultRepetitions?: number;
	showOutline?: boolean;
}

/** Embedded iframe component. */
export interface FormIframeComponent extends FormComponentBase {
	type: "iframe";
	label?: string;
	url?: string;
	height?: number;
	security?: { allowScripts?: boolean };
}

/** Visual separator line. */
export interface FormSeparatorComponent extends FormComponentBase {
	type: "separator";
}

/** Blank spacer. */
export interface FormSpacerComponent extends FormComponentBase {
	type: "spacer";
	height?: number;
}

/** Document preview component. */
export interface FormDocumentPreviewComponent extends FormComponentBase {
	type: "documentPreview";
	label?: string;
}

/** Raw HTML content component. */
export interface FormHtmlComponent extends FormComponentBase {
	type: "html";
	content?: string;
}

/** FEEL expression component. */
export interface FormExpressionComponent extends FormComponentBase {
	type: "expression";
	key?: string;
	expression?: string;
	/** When to evaluate: "change" or "submit". */
	computeOn?: string;
}

/** File upload picker component. */
export interface FormFilepickerComponent extends FormComponentBase {
	type: "filepicker";
	label?: string;
	key?: string;
	multiple?: boolean;
}

/** Passthrough for unknown/future component types — preserves roundtrip fidelity. */
export interface FormUnknownComponent extends FormComponentBase {
	type: string;
	[key: string]: unknown;
}

/** Discriminated union of all form component types. */
export type FormComponent =
	| FormTextComponent
	| FormTextFieldComponent
	| FormTextAreaComponent
	| FormSelectComponent
	| FormRadioComponent
	| FormCheckboxComponent
	| FormChecklistComponent
	| FormGroupComponent
	| FormNumberComponent
	| FormDatetimeComponent
	| FormButtonComponent
	| FormTaglistComponent
	| FormTableComponent
	| FormImageComponent
	| FormDynamicListComponent
	| FormIframeComponent
	| FormSeparatorComponent
	| FormSpacerComponent
	| FormDocumentPreviewComponent
	| FormHtmlComponent
	| FormExpressionComponent
	| FormFilepickerComponent
	| FormUnknownComponent;

/** Exporter metadata. */
export interface FormExporter {
	name: string;
	version: string;
}

/** Root form definition model. */
export interface FormDefinition {
	id: string;
	type: string;
	executionPlatform?: string;
	executionPlatformVersion?: string;
	exporter?: FormExporter;
	schemaVersion?: number;
	components: FormComponent[];
	generated?: boolean;
}
