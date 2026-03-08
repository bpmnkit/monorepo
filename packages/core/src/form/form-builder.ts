import { generateId } from "../types/id-generator.js";
import type {
	FormCheckboxComponent,
	FormChecklistComponent,
	FormComponent,
	FormDefinition,
	FormExporter,
	FormGroupComponent,
	FormLayout,
	FormRadioComponent,
	FormSelectComponent,
	FormTextAreaComponent,
	FormTextComponent,
	FormTextFieldComponent,
	FormValidation,
	FormValueOption,
} from "./form-model.js";

/** Builder for constructing Camunda Forms programmatically. */
export class FormBuilder {
	private _id: string;
	private _type = "default";
	private _executionPlatform = "Camunda Cloud";
	private _executionPlatformVersion = "8.7.0";
	private _exporter?: FormExporter;
	private _schemaVersion?: number;
	private _generated?: boolean;
	private readonly _components: FormComponent[] = [];

	constructor(id?: string) {
		this._id = id ?? generateId("Form");
	}

	/** Sets the form ID. */
	id(id: string): this {
		this._id = id;
		return this;
	}

	/** Sets the execution platform. */
	executionPlatform(platform: string): this {
		this._executionPlatform = platform;
		return this;
	}

	/** Sets the execution platform version. */
	executionPlatformVersion(version: string): this {
		this._executionPlatformVersion = version;
		return this;
	}

	/** Sets the exporter metadata. */
	exporter(name: string, version: string): this {
		this._exporter = { name, version };
		return this;
	}

	/** Sets the schema version. */
	schemaVersion(version: number): this {
		this._schemaVersion = version;
		return this;
	}

	/** Marks this form as generated. */
	generated(value: boolean): this {
		this._generated = value;
		return this;
	}

	/** Adds a static text component. */
	text(text: string, options?: { id?: string; label?: string; layout?: FormLayout }): this {
		const component: FormTextComponent = {
			type: "text",
			id: options?.id ?? generateId("Field"),
			text,
		};
		if (options?.label !== undefined) component.label = options.label;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	/** Adds a text field component. */
	textfield(label: string, key: string, options?: TextFieldOptions): this {
		const component: FormTextFieldComponent = {
			type: "textfield",
			id: options?.id ?? generateId("Field"),
			label,
			key,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	/** Adds a textarea component. */
	textarea(label: string, key: string, options?: TextFieldOptions): this {
		const component: FormTextAreaComponent = {
			type: "textarea",
			id: options?.id ?? generateId("Field"),
			label,
			key,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	/** Adds a select dropdown component. */
	select(label: string, key: string, options?: SelectOptions): this {
		const component: FormSelectComponent = {
			type: "select",
			id: options?.id ?? generateId("Field"),
			label,
			key,
		};
		if (options?.values !== undefined) component.values = options.values;
		if (options?.valuesKey !== undefined) component.valuesKey = options.valuesKey;
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.searchable !== undefined) component.searchable = options.searchable;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	/** Adds a radio button group component. */
	radio(label: string, key: string, values: FormValueOption[], options?: RadioOptions): this {
		const component: FormRadioComponent = {
			type: "radio",
			id: options?.id ?? generateId("Field"),
			label,
			key,
			values,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	/** Adds a checkbox component. */
	checkbox(label: string, key: string, options?: CheckboxOptions): this {
		const component: FormCheckboxComponent = {
			type: "checkbox",
			id: options?.id ?? generateId("Field"),
			label,
			key,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	/** Adds a checklist component. */
	checklist(
		label: string,
		key: string,
		values: FormValueOption[],
		options?: ChecklistOptions,
	): this {
		const component: FormChecklistComponent = {
			type: "checklist",
			id: options?.id ?? generateId("Field"),
			label,
			key,
			values,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	/** Adds a group component with nested children built via a callback. */
	group(label: string, builder: (group: GroupBuilder) => void, options?: GroupOptions): this {
		const groupBuilder = new GroupBuilder(options?.id);
		builder(groupBuilder);
		const component: FormGroupComponent = {
			type: "group",
			id: groupBuilder._id,
			label,
			components: groupBuilder._components,
		};
		if (options?.showOutline !== undefined) component.showOutline = options.showOutline;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	/** Builds the final FormDefinition. */
	build(): FormDefinition {
		const definition: FormDefinition = {
			id: this._id,
			type: this._type,
			components: this._components,
		};
		if (this._executionPlatform !== undefined) {
			definition.executionPlatform = this._executionPlatform;
		}
		if (this._executionPlatformVersion !== undefined) {
			definition.executionPlatformVersion = this._executionPlatformVersion;
		}
		if (this._exporter !== undefined) definition.exporter = this._exporter;
		if (this._schemaVersion !== undefined) definition.schemaVersion = this._schemaVersion;
		if (this._generated !== undefined) definition.generated = this._generated;
		return definition;
	}
}

/** Sub-builder for group components. Supports the same component methods as FormBuilder. */
export class GroupBuilder {
	/** @internal */
	readonly _id: string;
	/** @internal */
	readonly _components: FormComponent[] = [];

	constructor(id?: string) {
		this._id = id ?? generateId("Field");
	}

	text(text: string, options?: { id?: string; label?: string; layout?: FormLayout }): this {
		const component: FormTextComponent = {
			type: "text",
			id: options?.id ?? generateId("Field"),
			text,
		};
		if (options?.label !== undefined) component.label = options.label;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	textfield(label: string, key: string, options?: TextFieldOptions): this {
		const component: FormTextFieldComponent = {
			type: "textfield",
			id: options?.id ?? generateId("Field"),
			label,
			key,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	textarea(label: string, key: string, options?: TextFieldOptions): this {
		const component: FormTextAreaComponent = {
			type: "textarea",
			id: options?.id ?? generateId("Field"),
			label,
			key,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	select(label: string, key: string, options?: SelectOptions): this {
		const component: FormSelectComponent = {
			type: "select",
			id: options?.id ?? generateId("Field"),
			label,
			key,
		};
		if (options?.values !== undefined) component.values = options.values;
		if (options?.valuesKey !== undefined) component.valuesKey = options.valuesKey;
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.searchable !== undefined) component.searchable = options.searchable;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	radio(label: string, key: string, values: FormValueOption[], options?: RadioOptions): this {
		const component: FormRadioComponent = {
			type: "radio",
			id: options?.id ?? generateId("Field"),
			label,
			key,
			values,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	checkbox(label: string, key: string, options?: CheckboxOptions): this {
		const component: FormCheckboxComponent = {
			type: "checkbox",
			id: options?.id ?? generateId("Field"),
			label,
			key,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	checklist(
		label: string,
		key: string,
		values: FormValueOption[],
		options?: ChecklistOptions,
	): this {
		const component: FormChecklistComponent = {
			type: "checklist",
			id: options?.id ?? generateId("Field"),
			label,
			key,
			values,
		};
		if (options?.validate !== undefined) component.validate = options.validate;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}

	group(label: string, builder: (group: GroupBuilder) => void, options?: GroupOptions): this {
		const groupBuilder = new GroupBuilder(options?.id);
		builder(groupBuilder);
		const component: FormGroupComponent = {
			type: "group",
			id: groupBuilder._id,
			label,
			components: groupBuilder._components,
		};
		if (options?.showOutline !== undefined) component.showOutline = options.showOutline;
		if (options?.layout !== undefined) component.layout = options.layout;
		this._components.push(component);
		return this;
	}
}

/** Options for textfield/textarea components. */
export interface TextFieldOptions {
	id?: string;
	validate?: FormValidation;
	defaultValue?: string;
	layout?: FormLayout;
}

/** Options for select components. */
export interface SelectOptions {
	id?: string;
	values?: FormValueOption[];
	valuesKey?: string;
	validate?: FormValidation;
	searchable?: boolean;
	defaultValue?: string;
	layout?: FormLayout;
}

/** Options for radio components. */
export interface RadioOptions {
	id?: string;
	validate?: FormValidation;
	defaultValue?: string;
	layout?: FormLayout;
}

/** Options for checkbox components. */
export interface CheckboxOptions {
	id?: string;
	validate?: FormValidation;
	defaultValue?: boolean;
	layout?: FormLayout;
}

/** Options for checklist components. */
export interface ChecklistOptions {
	id?: string;
	validate?: FormValidation;
	layout?: FormLayout;
}

/** Options for group components. */
export interface GroupOptions {
	id?: string;
	showOutline?: boolean;
	layout?: FormLayout;
}
