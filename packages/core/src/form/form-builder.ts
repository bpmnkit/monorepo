import { generateId } from "../types/id-generator.js"
import { compositeKey, stableToken } from "../types/stable-key.js"
import type {
	FormCheckboxComponent,
	FormChecklistComponent,
	FormComponent,
	FormDefinition,
	FormExporter,
	FormGroupComponent,
	FormLayoutInput,
	FormRadioComponent,
	FormSelectComponent,
	FormTextAreaComponent,
	FormTextComponent,
	FormTextFieldComponent,
	FormValidation,
	FormValueOption,
} from "./form-model.js"

/** A layout the builder has filled in: both fields present, the way Camunda writes them. */
interface ResolvedLayout {
	row: string
	columns: number | null
}

/** The id and layout a component ends up with. */
interface ComponentNames {
	id: string
	layout: ResolvedLayout
}

/** The parts of a component's options that naming reads. */
interface NamingOptions {
	id?: string
	layout?: FormLayoutInput
}

/**
 * Mints the id and layout row for the components of one scope — a form, or a
 * group inside it.
 *
 * Every generated component carries a layout because Camunda Modeler and the
 * form-js importer read a missing `layout` as a legacy schema and backfill a
 * row/columns pair on open, showing a spurious diff on a form this builder just
 * produced. Both values are derived from the component's own identity — its
 * field key, or its text for a static block — rather than from its position or
 * from a random draw, so rebuilding an unchanged form is byte-identical and
 * reordering two fields moves nothing but their order. The row lives in its own
 * `"row"` namespace so it never equals the id derived from the same identity.
 *
 * `occurrences` covers the one case identity cannot: two components of a type
 * that are genuinely indistinguishable. Nothing intrinsic separates them, so
 * they are numbered in the order they were added.
 */
class ScopeNames {
	private readonly scope: string
	private readonly occurrences = new Map<string, number>()

	constructor(scope: string) {
		this.scope = scope
	}

	/**
	 * @param type - The component's `type` discriminator.
	 * @param identity - What the component is known by: its field key, or its
	 *   text or label when it has no key.
	 */
	resolve(type: string, identity: string, options?: NamingOptions): ComponentNames {
		const segments = [this.scope, type, identity]
		const key = compositeKey(segments)
		const occurrence = (this.occurrences.get(key) ?? 0) + 1
		this.occurrences.set(key, occurrence)
		if (occurrence > 1) segments.push(`#${occurrence}`)
		return {
			id: options?.id ?? stableToken("Field", segments),
			layout: {
				// `??` is the whole null asymmetry documented on FormLayoutInput: a
				// null row falls through to a generated one, a null columns lands on
				// null and is kept.
				row: options?.layout?.row ?? stableToken("Row", [...segments, "row"]),
				columns: options?.layout?.columns ?? null,
			},
		}
	}
}

/** Builder for constructing Camunda Forms programmatically. */
export class FormBuilder {
	private _id: string
	private _type = "default"
	private _executionPlatform = "Camunda Cloud"
	private _executionPlatformVersion = "8.7.0"
	private _exporter?: FormExporter
	private _schemaVersion?: number
	private _generated?: boolean
	private readonly _components: FormComponent[] = []
	private _names: ScopeNames

	constructor(id?: string) {
		this._id = id ?? generateId("Form")
		this._names = new ScopeNames(this._id)
	}

	/**
	 * Sets the form ID.
	 *
	 * Set it before adding components. The form id is what scopes their generated
	 * ids and rows — so that one field key means different ids in two different
	 * forms — and components added earlier keep the names they were given under
	 * the previous id. Output stays deterministic either way; it just is not the
	 * same output as passing the id to the constructor.
	 */
	id(id: string): this {
		this._id = id
		this._names = new ScopeNames(id)
		return this
	}

	/** Sets the execution platform. */
	executionPlatform(platform: string): this {
		this._executionPlatform = platform
		return this
	}

	/** Sets the execution platform version. */
	executionPlatformVersion(version: string): this {
		this._executionPlatformVersion = version
		return this
	}

	/** Sets the exporter metadata. */
	exporter(name: string, version: string): this {
		this._exporter = { name, version }
		return this
	}

	/** Sets the schema version. */
	schemaVersion(version: number): this {
		this._schemaVersion = version
		return this
	}

	/** Marks this form as generated. */
	generated(value: boolean): this {
		this._generated = value
		return this
	}

	/** Adds a static text component. */
	text(text: string, options?: { id?: string; label?: string; layout?: FormLayoutInput }): this {
		const names = this._names.resolve("text", text, options)
		const component: FormTextComponent = {
			type: "text",
			id: names.id,
			text,
		}
		if (options?.label !== undefined) component.label = options.label
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	/** Adds a text field component. */
	textfield(label: string, key: string, options?: TextFieldOptions): this {
		const names = this._names.resolve("textfield", key, options)
		const component: FormTextFieldComponent = {
			type: "textfield",
			id: names.id,
			label,
			key,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	/** Adds a textarea component. */
	textarea(label: string, key: string, options?: TextFieldOptions): this {
		const names = this._names.resolve("textarea", key, options)
		const component: FormTextAreaComponent = {
			type: "textarea",
			id: names.id,
			label,
			key,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	/** Adds a select dropdown component. */
	select(label: string, key: string, options?: SelectOptions): this {
		const names = this._names.resolve("select", key, options)
		const component: FormSelectComponent = {
			type: "select",
			id: names.id,
			label,
			key,
		}
		if (options?.values !== undefined) component.values = options.values
		if (options?.valuesKey !== undefined) component.valuesKey = options.valuesKey
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.searchable !== undefined) component.searchable = options.searchable
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	/** Adds a radio button group component. */
	radio(label: string, key: string, values: FormValueOption[], options?: RadioOptions): this {
		const names = this._names.resolve("radio", key, options)
		const component: FormRadioComponent = {
			type: "radio",
			id: names.id,
			label,
			key,
			values,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	/** Adds a checkbox component. */
	checkbox(label: string, key: string, options?: CheckboxOptions): this {
		const names = this._names.resolve("checkbox", key, options)
		const component: FormCheckboxComponent = {
			type: "checkbox",
			id: names.id,
			label,
			key,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	/** Adds a checklist component. */
	checklist(
		label: string,
		key: string,
		values: FormValueOption[],
		options?: ChecklistOptions,
	): this {
		const names = this._names.resolve("checklist", key, options)
		const component: FormChecklistComponent = {
			type: "checklist",
			id: names.id,
			label,
			key,
			values,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	/** Adds a group component with nested children built via a callback. */
	group(label: string, builder: (group: GroupBuilder) => void, options?: GroupOptions): this {
		const names = this._names.resolve("group", label, options)
		const groupBuilder = new GroupBuilder(names.id)
		builder(groupBuilder)
		const component: FormGroupComponent = {
			type: "group",
			id: groupBuilder._id,
			label,
			components: groupBuilder._components,
		}
		if (options?.showOutline !== undefined) component.showOutline = options.showOutline
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	/** Builds the final FormDefinition. */
	build(): FormDefinition {
		const definition: FormDefinition = {
			id: this._id,
			type: this._type,
			components: this._components,
		}
		if (this._executionPlatform !== undefined) {
			definition.executionPlatform = this._executionPlatform
		}
		if (this._executionPlatformVersion !== undefined) {
			definition.executionPlatformVersion = this._executionPlatformVersion
		}
		if (this._exporter !== undefined) definition.exporter = this._exporter
		if (this._schemaVersion !== undefined) definition.schemaVersion = this._schemaVersion
		if (this._generated !== undefined) definition.generated = this._generated
		return definition
	}
}

/** Sub-builder for group components. Supports the same component methods as FormBuilder. */
export class GroupBuilder {
	/** @internal */
	readonly _id: string
	/** @internal */
	readonly _components: FormComponent[] = []
	private readonly _names: ScopeNames

	/**
	 * @param id - The group component's id, and the scope its children's generated
	 *   ids and rows hang off. `FormBuilder.group()` passes the id it resolved for
	 *   the group, which is itself derived from the form id, so a nested tree is
	 *   deterministic all the way down. A group built standalone without an id
	 *   gets a random one, and its children inherit that instability.
	 */
	constructor(id?: string) {
		this._id = id ?? generateId("Field")
		this._names = new ScopeNames(this._id)
	}

	text(text: string, options?: { id?: string; label?: string; layout?: FormLayoutInput }): this {
		const names = this._names.resolve("text", text, options)
		const component: FormTextComponent = {
			type: "text",
			id: names.id,
			text,
		}
		if (options?.label !== undefined) component.label = options.label
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	textfield(label: string, key: string, options?: TextFieldOptions): this {
		const names = this._names.resolve("textfield", key, options)
		const component: FormTextFieldComponent = {
			type: "textfield",
			id: names.id,
			label,
			key,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	textarea(label: string, key: string, options?: TextFieldOptions): this {
		const names = this._names.resolve("textarea", key, options)
		const component: FormTextAreaComponent = {
			type: "textarea",
			id: names.id,
			label,
			key,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	select(label: string, key: string, options?: SelectOptions): this {
		const names = this._names.resolve("select", key, options)
		const component: FormSelectComponent = {
			type: "select",
			id: names.id,
			label,
			key,
		}
		if (options?.values !== undefined) component.values = options.values
		if (options?.valuesKey !== undefined) component.valuesKey = options.valuesKey
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.searchable !== undefined) component.searchable = options.searchable
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	radio(label: string, key: string, values: FormValueOption[], options?: RadioOptions): this {
		const names = this._names.resolve("radio", key, options)
		const component: FormRadioComponent = {
			type: "radio",
			id: names.id,
			label,
			key,
			values,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	checkbox(label: string, key: string, options?: CheckboxOptions): this {
		const names = this._names.resolve("checkbox", key, options)
		const component: FormCheckboxComponent = {
			type: "checkbox",
			id: names.id,
			label,
			key,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		if (options?.defaultValue !== undefined) component.defaultValue = options.defaultValue
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	checklist(
		label: string,
		key: string,
		values: FormValueOption[],
		options?: ChecklistOptions,
	): this {
		const names = this._names.resolve("checklist", key, options)
		const component: FormChecklistComponent = {
			type: "checklist",
			id: names.id,
			label,
			key,
			values,
		}
		if (options?.validate !== undefined) component.validate = options.validate
		component.layout = names.layout
		this._components.push(component)
		return this
	}

	group(label: string, builder: (group: GroupBuilder) => void, options?: GroupOptions): this {
		const names = this._names.resolve("group", label, options)
		const groupBuilder = new GroupBuilder(names.id)
		builder(groupBuilder)
		const component: FormGroupComponent = {
			type: "group",
			id: groupBuilder._id,
			label,
			components: groupBuilder._components,
		}
		if (options?.showOutline !== undefined) component.showOutline = options.showOutline
		component.layout = names.layout
		this._components.push(component)
		return this
	}
}

/** Options for textfield/textarea components. */
export interface TextFieldOptions {
	id?: string
	validate?: FormValidation
	defaultValue?: string
	layout?: FormLayoutInput
}

/** Options for select components. */
export interface SelectOptions {
	id?: string
	values?: FormValueOption[]
	valuesKey?: string
	validate?: FormValidation
	searchable?: boolean
	defaultValue?: string
	layout?: FormLayoutInput
}

/** Options for radio components. */
export interface RadioOptions {
	id?: string
	validate?: FormValidation
	defaultValue?: string
	layout?: FormLayoutInput
}

/** Options for checkbox components. */
export interface CheckboxOptions {
	id?: string
	validate?: FormValidation
	defaultValue?: boolean
	layout?: FormLayoutInput
}

/** Options for checklist components. */
export interface ChecklistOptions {
	id?: string
	validate?: FormValidation
	layout?: FormLayoutInput
}

/** Options for group components. */
export interface GroupOptions {
	id?: string
	showOutline?: boolean
	layout?: FormLayoutInput
}
