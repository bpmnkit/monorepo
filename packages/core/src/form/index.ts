export type {
	FormComponent,
	FormButtonComponent,
	FormCheckboxComponent,
	FormChecklistComponent,
	FormDatetimeComponent,
	FormDefinition,
	FormDocumentPreviewComponent,
	FormDynamicListComponent,
	FormExporter,
	FormExpressionComponent,
	FormFilepickerComponent,
	FormGroupComponent,
	FormHtmlComponent,
	FormIframeComponent,
	FormImageComponent,
	FormLayout,
	FormNumberComponent,
	FormRadioComponent,
	FormSelectComponent,
	FormSeparatorComponent,
	FormSpacerComponent,
	FormTableComponent,
	FormTaglistComponent,
	FormTextAreaComponent,
	FormTextComponent,
	FormTextFieldComponent,
	FormUnknownComponent,
	FormValidation,
	FormValueOption,
} from "./form-model.js"

export { parseForm } from "./form-parser.js"
export { exportForm } from "./form-serializer.js"
export { FormBuilder, GroupBuilder } from "./form-builder.js"
export type {
	TextFieldOptions,
	SelectOptions,
	RadioOptions,
	CheckboxOptions,
	ChecklistOptions,
	GroupOptions,
} from "./form-builder.js"
export { compactifyForm, expandForm } from "./compact.js"
export type { CompactForm, CompactFormField } from "./compact.js"

import { generateId } from "../types/id-generator.js"
import { compactifyForm, expandForm } from "./compact.js"
import type { CompactForm } from "./compact.js"
import { FormBuilder } from "./form-builder.js"
import type { FormDefinition } from "./form-model.js"
import { parseForm } from "./form-parser.js"
import { exportForm } from "./form-serializer.js"

/** Top-level Form namespace providing create, parse, and export entry points. */
export const Form = {
	/** Creates a new form using a fluent builder. */
	create(id?: string): FormBuilder {
		return new FormBuilder(id)
	},

	/** Returns a minimal empty FormDefinition. Useful for "New Form" actions. */
	makeEmpty(id?: string): FormDefinition {
		const formId = id ?? generateId("Form")
		return {
			id: formId,
			type: "default",
			schemaVersion: 16,
			components: [{ type: "button", id: generateId("submit"), label: "Submit" }],
		}
	},

	/** Parses a JSON string into a FormDefinition. */
	parse(json: string): FormDefinition {
		return parseForm(json)
	},

	/** Exports a FormDefinition to a JSON string. */
	export(form: FormDefinition): string {
		return exportForm(form)
	},

	/** Convert a FormDefinition to a token-efficient compact representation. */
	compactify(form: FormDefinition): ReturnType<typeof compactifyForm> {
		return compactifyForm(form)
	},

	/** Convert a compact form representation back to a FormDefinition. */
	expand(compact: CompactForm): FormDefinition {
		return expandForm(compact)
	},
} as const
