import type {
	FormComponent,
	FormDefinition,
	FormExporter,
	FormLayout,
	FormUnknownComponent,
	FormValidation,
	FormValueOption,
} from "./form-model.js";

const KNOWN_COMPONENT_TYPES = new Set([
	"text",
	"textfield",
	"textarea",
	"select",
	"radio",
	"checkbox",
	"checklist",
	"group",
	"number",
	"datetime",
	"button",
	"taglist",
	"table",
	"image",
	"dynamiclist",
	"iframe",
	"separator",
	"spacer",
	"documentPreview",
	"html",
	"expression",
	"filepicker",
]);

/** Parses a Camunda Form JSON string into a typed FormDefinition. */
export function parseForm(json: string): FormDefinition {
	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch (e) {
		throw new Error(`Failed to parse form JSON: ${(e as Error).message}`);
	}

	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error("Form JSON must be an object");
	}

	const obj = raw as Record<string, unknown>;

	if (typeof obj.id !== "string" || obj.id.length === 0) {
		throw new Error("Form must have a non-empty 'id' string");
	}
	if (typeof obj.type !== "string") {
		throw new Error("Form must have a 'type' string");
	}
	if (!Array.isArray(obj.components)) {
		throw new Error("Form must have a 'components' array");
	}

	const definition: FormDefinition = {
		id: obj.id,
		type: obj.type,
		components: obj.components.map((c: unknown, i: number) =>
			parseComponent(c, `components[${i}]`),
		),
	};

	if (typeof obj.executionPlatform === "string") {
		definition.executionPlatform = obj.executionPlatform;
	}
	if (typeof obj.executionPlatformVersion === "string") {
		definition.executionPlatformVersion = obj.executionPlatformVersion;
	}
	if (typeof obj.schemaVersion === "number") {
		definition.schemaVersion = obj.schemaVersion;
	}
	if (typeof obj.generated === "boolean") {
		definition.generated = obj.generated;
	}
	if (typeof obj.exporter === "object" && obj.exporter !== null) {
		const exp = obj.exporter as Record<string, unknown>;
		definition.exporter = {
			name: String(exp.name ?? ""),
			version: String(exp.version ?? ""),
		} satisfies FormExporter;
	}

	return definition;
}

function parseComponent(raw: unknown, path: string): FormComponent {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error(`${path}: component must be an object`);
	}

	const obj = raw as Record<string, unknown>;

	if (typeof obj.type !== "string") {
		throw new Error(`${path}: component must have a 'type' string`);
	}
	if (typeof obj.id !== "string" || obj.id.length === 0) {
		throw new Error(`${path}: component must have a non-empty 'id'`);
	}

	const layout = parseLayout(obj.layout, path);

	if (!KNOWN_COMPONENT_TYPES.has(obj.type)) {
		return parseUnknownComponent(obj, layout);
	}

	switch (obj.type) {
		case "text": {
			if (typeof obj.text !== "string") {
				throw new Error(`${path}: text component must have a 'text' string`);
			}
			const c: FormComponent = { type: "text", id: obj.id, text: obj.text };
			if (typeof obj.label === "string") c.label = obj.label;
			if (layout) c.layout = layout;
			return c;
		}
		case "textfield":
			return parseFieldComponent(obj, "textfield", path, layout);
		case "textarea":
			return parseFieldComponent(obj, "textarea", path, layout);
		case "select":
			return parseSelectComponent(obj, path, layout);
		case "radio":
			return parseValuesComponent(obj, "radio", path, layout);
		case "checkbox":
			return parseCheckboxComponent(obj, path, layout);
		case "checklist":
			return parseValuesComponent(obj, "checklist", path, layout);
		case "group":
			return parseGroupComponent(obj, path, layout);
		case "number":
			return parseNumberComponent(obj, path, layout);
		case "datetime":
			return parseDatetimeComponent(obj, path, layout);
		case "button":
			return parseButtonComponent(obj, path, layout);
		case "taglist":
			return parseTaglistComponent(obj, path, layout);
		case "table":
			return parseTableComponent(obj, path, layout);
		case "image":
			return parseImageComponent(obj, path, layout);
		case "dynamiclist":
			return parseDynamicListComponent(obj, path, layout);
		case "iframe":
			return parseIframeComponent(obj, path, layout);
		case "separator":
			return parseSeparatorComponent(obj, layout);
		case "spacer":
			return parseSpacerComponent(obj, layout);
		case "documentPreview":
			return parseDocumentPreviewComponent(obj, layout);
		case "html":
			return parseHtmlComponent(obj, layout);
		case "expression":
			return parseExpressionComponent(obj, layout);
		case "filepicker":
			return parseFilepickerComponent(obj, layout);
		default:
			return parseUnknownComponent(obj, layout);
	}
}

function parseLayout(raw: unknown, path: string): FormLayout | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw !== "object" || Array.isArray(raw)) {
		throw new Error(`${path}.layout: must be an object`);
	}
	const obj = raw as Record<string, unknown>;
	const layout: FormLayout = {};
	if (typeof obj.row === "string") layout.row = obj.row;
	if (obj.columns === null) {
		layout.columns = null;
	} else if (typeof obj.columns === "number") {
		layout.columns = obj.columns;
	}
	return layout;
}

function parseValidation(raw: unknown, path: string): FormValidation | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw !== "object" || Array.isArray(raw)) {
		throw new Error(`${path}.validate: must be an object`);
	}
	const obj = raw as Record<string, unknown>;
	const v: FormValidation = {};
	if (typeof obj.required === "boolean") v.required = obj.required;
	if (typeof obj.minLength === "number") v.minLength = obj.minLength;
	if (typeof obj.maxLength === "number") v.maxLength = obj.maxLength;
	return v;
}

function parseValues(raw: unknown, path: string): FormValueOption[] {
	if (!Array.isArray(raw)) {
		throw new Error(`${path}.values: must be an array`);
	}
	return raw.map((v: unknown, i: number) => {
		if (typeof v !== "object" || v === null) {
			throw new Error(`${path}.values[${i}]: must be an object`);
		}
		const vo = v as Record<string, unknown>;
		return {
			label: String(vo.label ?? ""),
			value: String(vo.value ?? ""),
		};
	});
}

function parseFieldComponent(
	obj: Record<string, unknown>,
	type: "textfield" | "textarea",
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: ${type} must have a 'label' string`);
	}
	if (typeof obj.key !== "string") {
		throw new Error(`${path}: ${type} must have a 'key' string`);
	}
	const validate = parseValidation(obj.validate, path);
	const base = {
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
		...(validate ? { validate } : {}),
		...(typeof obj.defaultValue === "string" ? { defaultValue: obj.defaultValue } : {}),
		...(layout ? { layout } : {}),
	};
	if (type === "textfield") return { type: "textfield", ...base };
	return { type: "textarea", ...base };
}

function parseSelectComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: select must have a 'label' string`);
	}
	if (typeof obj.key !== "string") {
		throw new Error(`${path}: select must have a 'key' string`);
	}
	const c: FormComponent = {
		type: "select",
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
	};
	if (Array.isArray(obj.values)) {
		c.values = parseValues(obj.values, path);
	}
	if (typeof obj.valuesKey === "string") c.valuesKey = obj.valuesKey;
	const validate = parseValidation(obj.validate, path);
	if (validate) c.validate = validate;
	if (typeof obj.searchable === "boolean") c.searchable = obj.searchable;
	if (typeof obj.defaultValue === "string") c.defaultValue = obj.defaultValue;
	if (layout) c.layout = layout;
	return c;
}

function parseValuesComponent(
	obj: Record<string, unknown>,
	type: "radio" | "checklist",
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: ${type} must have a 'label' string`);
	}
	if (typeof obj.key !== "string") {
		throw new Error(`${path}: ${type} must have a 'key' string`);
	}
	if (!Array.isArray(obj.values)) {
		throw new Error(`${path}: ${type} must have a 'values' array`);
	}
	const values = parseValues(obj.values, path);

	if (type === "radio") {
		const c: FormComponent = {
			type: "radio",
			id: obj.id as string,
			label: obj.label,
			key: obj.key,
			values,
		};
		const validate = parseValidation(obj.validate, path);
		if (validate) c.validate = validate;
		if (typeof obj.defaultValue === "string") c.defaultValue = obj.defaultValue;
		if (layout) c.layout = layout;
		return c;
	}

	const c: FormComponent = {
		type: "checklist",
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
		values,
	};
	const validate = parseValidation(obj.validate, path);
	if (validate) c.validate = validate;
	if (layout) c.layout = layout;
	return c;
}

function parseCheckboxComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: checkbox must have a 'label' string`);
	}
	if (typeof obj.key !== "string") {
		throw new Error(`${path}: checkbox must have a 'key' string`);
	}
	const c: FormComponent = {
		type: "checkbox",
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
	};
	const validate = parseValidation(obj.validate, path);
	if (validate) c.validate = validate;
	if (typeof obj.defaultValue === "boolean") c.defaultValue = obj.defaultValue;
	if (layout) c.layout = layout;
	return c;
}

function parseGroupComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") {
		throw new Error(`${path}: group must have a 'label' string`);
	}
	if (!Array.isArray(obj.components)) {
		throw new Error(`${path}: group must have a 'components' array`);
	}
	const components = obj.components.map((c: unknown, i: number) =>
		parseComponent(c, `${path}.components[${i}]`),
	);
	const c: FormComponent = {
		type: "group",
		id: obj.id as string,
		label: obj.label,
		components,
	};
	if (typeof obj.showOutline === "boolean") c.showOutline = obj.showOutline;
	if (layout) c.layout = layout;
	return c;
}

function parseNumberComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") throw new Error(`${path}: number must have a 'label' string`);
	if (typeof obj.key !== "string") throw new Error(`${path}: number must have a 'key' string`);
	const c: FormComponent = { type: "number", id: obj.id as string, label: obj.label, key: obj.key };
	const validate = parseValidation(obj.validate, path);
	if (validate) c.validate = validate;
	if (typeof obj.defaultValue === "number") c.defaultValue = obj.defaultValue;
	if (layout) c.layout = layout;
	return c;
}

function parseDatetimeComponent(
	obj: Record<string, unknown>,
	_path: string,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "datetime", id: obj.id as string, key: String(obj.key ?? "") };
	if (typeof obj.subtype === "string") c.subtype = obj.subtype;
	if (typeof obj.dateLabel === "string") c.dateLabel = obj.dateLabel;
	if (typeof obj.timeLabel === "string") c.timeLabel = obj.timeLabel;
	if (layout) c.layout = layout;
	return c;
}

function parseButtonComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") throw new Error(`${path}: button must have a 'label' string`);
	const c: FormComponent = { type: "button", id: obj.id as string, label: obj.label };
	if (typeof obj.action === "string") c.action = obj.action;
	if (layout) c.layout = layout;
	return c;
}

function parseTaglistComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	if (typeof obj.label !== "string") throw new Error(`${path}: taglist must have a 'label' string`);
	if (typeof obj.key !== "string") throw new Error(`${path}: taglist must have a 'key' string`);
	const c: FormComponent = {
		type: "taglist",
		id: obj.id as string,
		label: obj.label,
		key: obj.key,
	};
	if (Array.isArray(obj.values)) c.values = parseValues(obj.values, path);
	if (typeof obj.valuesKey === "string") c.valuesKey = obj.valuesKey;
	if (layout) c.layout = layout;
	return c;
}

function parseTableComponent(
	obj: Record<string, unknown>,
	_path: string,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "table", id: obj.id as string };
	if (typeof obj.label === "string") c.label = obj.label;
	if (typeof obj.dataSource === "string") c.dataSource = obj.dataSource;
	if (typeof obj.rowCount === "number") c.rowCount = obj.rowCount;
	if (Array.isArray(obj.columns)) {
		c.columns = obj.columns.map((col: unknown) => {
			const co = col as Record<string, unknown>;
			return { label: String(co.label ?? ""), key: String(co.key ?? "") };
		});
	}
	if (layout) c.layout = layout;
	return c;
}

function parseImageComponent(
	obj: Record<string, unknown>,
	_path: string,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "image", id: obj.id as string };
	if (typeof obj.source === "string") c.source = obj.source;
	if (typeof obj.alt === "string") c.alt = obj.alt;
	if (layout) c.layout = layout;
	return c;
}

function parseDynamicListComponent(
	obj: Record<string, unknown>,
	path: string,
	layout: FormLayout | undefined,
): FormComponent {
	const components = Array.isArray(obj.components)
		? obj.components.map((c: unknown, i: number) => parseComponent(c, `${path}.components[${i}]`))
		: [];
	const c: FormComponent = { type: "dynamiclist", id: obj.id as string, components };
	if (typeof obj.label === "string") c.label = obj.label;
	if (typeof obj.path === "string") c.path = obj.path;
	if (typeof obj.isRepeating === "boolean") c.isRepeating = obj.isRepeating;
	if (typeof obj.allowAddRemove === "boolean") c.allowAddRemove = obj.allowAddRemove;
	if (typeof obj.defaultRepetitions === "number") c.defaultRepetitions = obj.defaultRepetitions;
	if (typeof obj.showOutline === "boolean") c.showOutline = obj.showOutline;
	if (layout) c.layout = layout;
	return c;
}

function parseIframeComponent(
	obj: Record<string, unknown>,
	_path: string,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "iframe", id: obj.id as string };
	if (typeof obj.label === "string") c.label = obj.label;
	if (typeof obj.url === "string") c.url = obj.url;
	if (typeof obj.height === "number") c.height = obj.height;
	if (typeof obj.security === "object" && obj.security !== null) {
		const sec = obj.security as Record<string, unknown>;
		c.security = {
			allowScripts: typeof sec.allowScripts === "boolean" ? sec.allowScripts : undefined,
		};
	}
	if (layout) c.layout = layout;
	return c;
}

function parseSeparatorComponent(
	obj: Record<string, unknown>,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "separator", id: obj.id as string };
	if (layout) c.layout = layout;
	return c;
}

function parseSpacerComponent(
	obj: Record<string, unknown>,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "spacer", id: obj.id as string };
	if (typeof obj.height === "number") c.height = obj.height;
	if (layout) c.layout = layout;
	return c;
}

function parseDocumentPreviewComponent(
	obj: Record<string, unknown>,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "documentPreview", id: obj.id as string };
	if (typeof obj.label === "string") c.label = obj.label;
	if (layout) c.layout = layout;
	return c;
}

function parseHtmlComponent(
	obj: Record<string, unknown>,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "html", id: obj.id as string };
	if (typeof obj.content === "string") c.content = obj.content;
	if (layout) c.layout = layout;
	return c;
}

function parseExpressionComponent(
	obj: Record<string, unknown>,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "expression", id: obj.id as string };
	if (typeof obj.key === "string") c.key = obj.key;
	if (typeof obj.expression === "string") c.expression = obj.expression;
	if (typeof obj.computeOn === "string") c.computeOn = obj.computeOn;
	if (layout) c.layout = layout;
	return c;
}

function parseFilepickerComponent(
	obj: Record<string, unknown>,
	layout: FormLayout | undefined,
): FormComponent {
	const c: FormComponent = { type: "filepicker", id: obj.id as string };
	if (typeof obj.label === "string") c.label = obj.label;
	if (typeof obj.key === "string") c.key = obj.key;
	if (typeof obj.multiple === "boolean") c.multiple = obj.multiple;
	if (layout) c.layout = layout;
	return c;
}

function parseUnknownComponent(
	obj: Record<string, unknown>,
	layout: FormLayout | undefined,
): FormUnknownComponent {
	const c: FormUnknownComponent = { ...obj, type: obj.type as string, id: obj.id as string };
	if (layout) c.layout = layout;
	return c;
}
