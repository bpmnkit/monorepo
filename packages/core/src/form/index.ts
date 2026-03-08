export type {
	FormComponent,
	FormCheckboxComponent,
	FormChecklistComponent,
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

export { parseForm } from "./form-parser.js";
export { exportForm } from "./form-serializer.js";
export { FormBuilder, GroupBuilder } from "./form-builder.js";
export type {
	TextFieldOptions,
	SelectOptions,
	RadioOptions,
	CheckboxOptions,
	ChecklistOptions,
	GroupOptions,
} from "./form-builder.js";

import { FormBuilder } from "./form-builder.js";
import type { FormDefinition } from "./form-model.js";
import { parseForm } from "./form-parser.js";
import { exportForm } from "./form-serializer.js";

/** Top-level Form namespace providing create, parse, and export entry points. */
export const Form = {
	/** Creates a new form using a fluent builder. */
	create(id?: string): FormBuilder {
		return new FormBuilder(id);
	},

	/** Parses a JSON string into a FormDefinition. */
	parse(json: string): FormDefinition {
		return parseForm(json);
	},

	/** Exports a FormDefinition to a JSON string. */
	export(form: FormDefinition): string {
		return exportForm(form);
	},
} as const;
