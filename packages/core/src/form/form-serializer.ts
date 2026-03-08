import type {
	FormComponent,
	FormDefinition,
	FormDynamicListComponent,
	FormGroupComponent,
	FormIframeComponent,
	FormLayout,
	FormTableComponent,
	FormUnknownComponent,
} from "./form-model.js";

/** Serializes a FormDefinition to a JSON string. */
export function exportForm(form: FormDefinition): string {
	const obj: Record<string, unknown> = {};

	if (form.executionPlatform !== undefined) {
		obj.executionPlatform = form.executionPlatform;
	}
	if (form.executionPlatformVersion !== undefined) {
		obj.executionPlatformVersion = form.executionPlatformVersion;
	}
	if (form.exporter !== undefined) {
		obj.exporter = { name: form.exporter.name, version: form.exporter.version };
	}
	if (form.schemaVersion !== undefined) {
		obj.schemaVersion = form.schemaVersion;
	}
	obj.id = form.id;
	obj.components = form.components.map(serializeComponent);
	if (form.generated !== undefined) {
		obj.generated = form.generated;
	}
	obj.type = form.type;

	return JSON.stringify(obj, null, 2);
}

function serializeComponent(component: FormComponent): Record<string, unknown> {
	// Use the type discriminant, casting where TypeScript can't narrow through FormUnknownComponent
	const type = component.type;
	switch (type) {
		case "text":
			return buildObj(component, ["text", "label", "type", "layout", "id"]);
		case "textfield":
		case "textarea":
			return buildObj(component, [
				"label",
				"type",
				"layout",
				"id",
				"key",
				"validate",
				"defaultValue",
			]);
		case "select":
			return buildObj(component, [
				"label",
				"values",
				"valuesKey",
				"type",
				"layout",
				"id",
				"key",
				"validate",
				"searchable",
				"defaultValue",
			]);
		case "radio":
			return buildObj(component, [
				"label",
				"values",
				"type",
				"layout",
				"id",
				"key",
				"validate",
				"defaultValue",
			]);
		case "checkbox":
			return buildObj(component, [
				"label",
				"type",
				"id",
				"defaultValue",
				"validate",
				"key",
				"layout",
			]);
		case "checklist":
			return buildObj(component, ["label", "values", "type", "layout", "id", "key", "validate"]);
		case "group":
			return buildGroupObj(component as FormGroupComponent);
		case "number":
			return buildObj(component, [
				"label",
				"type",
				"layout",
				"id",
				"key",
				"validate",
				"defaultValue",
			]);
		case "datetime":
			return buildObj(component, [
				"subtype",
				"dateLabel",
				"timeLabel",
				"type",
				"layout",
				"id",
				"key",
				"validate",
			]);
		case "button":
			return buildObj(component, ["label", "action", "type", "layout", "id"]);
		case "taglist":
			return buildObj(component, [
				"label",
				"values",
				"valuesKey",
				"type",
				"layout",
				"id",
				"key",
				"validate",
			]);
		case "table":
			return buildTableObj(component as FormTableComponent);
		case "image":
			return buildObj(component, ["source", "alt", "type", "layout", "id"]);
		case "dynamiclist":
			return buildDynamicListObj(component as FormDynamicListComponent);
		case "iframe":
			return buildIframeObj(component as FormIframeComponent);
		case "separator":
			return buildObj(component, ["type", "layout", "id"]);
		case "spacer":
			return buildObj(component, ["height", "type", "layout", "id"]);
		case "documentPreview":
			return buildObj(component, ["label", "type", "layout", "id"]);
		case "html":
			return buildObj(component, ["content", "type", "layout", "id"]);
		case "expression":
			return buildObj(component, ["computeOn", "type", "layout", "id", "key", "expression"]);
		case "filepicker":
			return buildObj(component, ["label", "type", "layout", "id", "key", "multiple"]);
		default:
			return buildUnknownObj(component as unknown as FormUnknownComponent);
	}
}

function buildObj(component: FormComponent, keys: readonly string[]): Record<string, unknown> {
	const src = component as unknown as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const key of keys) {
		const value = src[key];
		if (value === undefined) continue;
		if (key === "layout") {
			out.layout = serializeLayout(value as FormLayout);
		} else if (key === "validate") {
			out.validate = { ...(value as Record<string, unknown>) };
		} else if (key === "values") {
			out.values = (value as Array<Record<string, unknown>>).map((v) => ({
				label: v.label,
				value: v.value,
			}));
		} else {
			out[key] = value;
		}
	}
	return out;
}

function buildGroupObj(component: FormGroupComponent): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	out.label = component.label;
	out.components = component.components.map(serializeComponent);
	if (component.showOutline !== undefined) out.showOutline = component.showOutline;
	out.type = "group";
	if (component.layout !== undefined) out.layout = serializeLayout(component.layout);
	out.id = component.id;
	return out;
}

function serializeLayout(layout: FormLayout): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (layout.row !== undefined) out.row = layout.row;
	if (layout.columns !== undefined) {
		out.columns = layout.columns;
	} else {
		out.columns = null;
	}
	return out;
}

function buildTableObj(component: FormTableComponent): Record<string, unknown> {
	const out: Record<string, unknown> = { type: "table", id: component.id };
	if (component.label !== undefined) out.label = component.label;
	if (component.dataSource !== undefined) out.dataSource = component.dataSource;
	if (component.rowCount !== undefined) out.rowCount = component.rowCount;
	if (component.columns !== undefined && component.columns !== null) {
		out.columns = component.columns.map((c) => ({ label: c.label, key: c.key }));
	}
	if (component.layout !== undefined) out.layout = serializeLayout(component.layout);
	return out;
}

function buildDynamicListObj(component: FormDynamicListComponent): Record<string, unknown> {
	const out: Record<string, unknown> = { type: "dynamiclist", id: component.id };
	if (component.label !== undefined) out.label = component.label;
	out.components = component.components.map(serializeComponent);
	if (component.path !== undefined) out.path = component.path;
	if (component.isRepeating !== undefined) out.isRepeating = component.isRepeating;
	if (component.allowAddRemove !== undefined) out.allowAddRemove = component.allowAddRemove;
	if (component.defaultRepetitions !== undefined)
		out.defaultRepetitions = component.defaultRepetitions;
	if (component.showOutline !== undefined) out.showOutline = component.showOutline;
	if (component.layout !== undefined) out.layout = serializeLayout(component.layout);
	return out;
}

function buildIframeObj(component: FormIframeComponent): Record<string, unknown> {
	const out: Record<string, unknown> = { type: "iframe", id: component.id };
	if (component.label !== undefined) out.label = component.label;
	if (component.url !== undefined) out.url = component.url;
	if (component.height !== undefined) out.height = component.height;
	if (component.security !== undefined) out.security = { ...component.security };
	if (component.layout !== undefined) out.layout = serializeLayout(component.layout);
	return out;
}

function buildUnknownObj(component: FormUnknownComponent): Record<string, unknown> {
	const out: Record<string, unknown> = { ...component };
	if (component.layout !== undefined) out.layout = serializeLayout(component.layout as FormLayout);
	return out;
}
