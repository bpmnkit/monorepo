import { beforeEach, describe, expect, it } from "vitest";
import { FormBuilder } from "../../src/form/form-builder.js";
import type { FormComponent, FormGroupComponent } from "../../src/form/form-model.js";
import { parseForm } from "../../src/form/form-parser.js";
import { exportForm } from "../../src/form/form-serializer.js";
import { resetIdCounter } from "../../src/types/id-generator.js";

beforeEach(() => {
	resetIdCounter();
});

function at<T>(arr: readonly T[], index: number): T {
	const item = arr[index];
	if (item === undefined) throw new Error(`No item at index ${index}`);
	return item;
}

function asGroup(c: FormComponent): FormGroupComponent {
	if (c.type !== "group") throw new Error(`Expected group, got ${c.type}`);
	return c;
}

describe("FormBuilder", () => {
	it("creates an empty form with defaults", () => {
		const form = new FormBuilder("test-form").build();
		expect(form.id).toBe("test-form");
		expect(form.type).toBe("default");
		expect(form.executionPlatform).toBe("Camunda Cloud");
		expect(form.components).toEqual([]);
	});

	it("sets metadata", () => {
		const form = new FormBuilder("f1")
			.executionPlatform("Camunda Cloud")
			.executionPlatformVersion("8.5.0")
			.exporter("Test", "1.0")
			.schemaVersion(18)
			.generated(true)
			.build();

		expect(form.executionPlatform).toBe("Camunda Cloud");
		expect(form.executionPlatformVersion).toBe("8.5.0");
		expect(form.exporter).toEqual({ name: "Test", version: "1.0" });
		expect(form.schemaVersion).toBe(18);
		expect(form.generated).toBe(true);
	});

	it("adds text component", () => {
		const form = new FormBuilder("f1").text("Hello world").build();
		expect(form.components).toHaveLength(1);
		const c = at(form.components, 0);
		expect(c.type).toBe("text");
		if (c.type !== "text") throw new Error("unreachable");
		expect(c.text).toBe("Hello world");
		expect(c.id).toMatch(/^Field_/);
	});

	it("adds text with label and layout", () => {
		const form = new FormBuilder("f1")
			.text("Title", { label: "Heading", layout: { row: "r1", columns: 4 } })
			.build();
		const c = at(form.components, 0);
		if (c.type !== "text") throw new Error("unreachable");
		expect(c.label).toBe("Heading");
		expect(c.layout).toEqual({ row: "r1", columns: 4 });
	});

	it("adds textfield component", () => {
		const form = new FormBuilder("f1")
			.textfield("Name", "name", { validate: { required: true } })
			.build();
		const c = at(form.components, 0);
		expect(c.type).toBe("textfield");
		if (c.type !== "textfield") throw new Error("unreachable");
		expect(c.label).toBe("Name");
		expect(c.key).toBe("name");
		expect(c.validate).toEqual({ required: true });
	});

	it("adds textarea component", () => {
		const form = new FormBuilder("f1")
			.textarea("Description", "desc", {
				validate: { minLength: 10, maxLength: 500 },
				defaultValue: "N/A",
			})
			.build();
		const c = at(form.components, 0);
		expect(c.type).toBe("textarea");
		if (c.type !== "textarea") throw new Error("unreachable");
		expect(c.label).toBe("Description");
		expect(c.key).toBe("desc");
		expect(c.validate).toEqual({ minLength: 10, maxLength: 500 });
		expect(c.defaultValue).toBe("N/A");
	});

	it("adds select component with values", () => {
		const form = new FormBuilder("f1")
			.select("Color", "color", {
				values: [
					{ label: "Red", value: "red" },
					{ label: "Blue", value: "blue" },
				],
				validate: { required: true },
			})
			.build();
		const c = at(form.components, 0);
		expect(c.type).toBe("select");
		if (c.type !== "select") throw new Error("unreachable");
		expect(c.values).toHaveLength(2);
	});

	it("adds select component with valuesKey and searchable", () => {
		const form = new FormBuilder("f1")
			.select("User", "user", { valuesKey: "users", searchable: true })
			.build();
		const c = at(form.components, 0);
		if (c.type !== "select") throw new Error("unreachable");
		expect(c.valuesKey).toBe("users");
		expect(c.searchable).toBe(true);
	});

	it("adds radio component", () => {
		const form = new FormBuilder("f1")
			.radio(
				"Agree?",
				"agree",
				[
					{ label: "Yes", value: "true" },
					{ label: "No", value: "false" },
				],
				{ defaultValue: "false" },
			)
			.build();
		const c = at(form.components, 0);
		expect(c.type).toBe("radio");
		if (c.type !== "radio") throw new Error("unreachable");
		expect(c.values).toHaveLength(2);
		expect(c.defaultValue).toBe("false");
	});

	it("adds checkbox component", () => {
		const form = new FormBuilder("f1")
			.checkbox("Accept terms", "terms", {
				validate: { required: true },
				defaultValue: false,
			})
			.build();
		const c = at(form.components, 0);
		expect(c.type).toBe("checkbox");
		if (c.type !== "checkbox") throw new Error("unreachable");
		expect(c.defaultValue).toBe(false);
	});

	it("adds checklist component", () => {
		const form = new FormBuilder("f1")
			.checklist("Skills", "skills", [
				{ label: "TypeScript", value: "ts" },
				{ label: "Rust", value: "rs" },
			])
			.build();
		const c = at(form.components, 0);
		expect(c.type).toBe("checklist");
		if (c.type !== "checklist") throw new Error("unreachable");
		expect(c.values).toHaveLength(2);
	});

	it("adds group with nested components", () => {
		const form = new FormBuilder("f1")
			.group(
				"Details",
				(g) => {
					g.textfield("Name", "name").textarea("Bio", "bio");
				},
				{ showOutline: true },
			)
			.build();
		const c = asGroup(at(form.components, 0));
		expect(c.label).toBe("Details");
		expect(c.showOutline).toBe(true);
		expect(c.components).toHaveLength(2);
		expect(at(c.components, 0).type).toBe("textfield");
		expect(at(c.components, 1).type).toBe("textarea");
	});

	it("supports nested groups (recursive)", () => {
		const form = new FormBuilder("f1")
			.group("Outer", (outer) => {
				outer.group("Inner", (inner) => {
					inner.text("Deeply nested");
				});
			})
			.build();
		const outer = asGroup(at(form.components, 0));
		expect(outer.components).toHaveLength(1);
		const inner = asGroup(at(outer.components, 0));
		expect(inner.type).toBe("group");
		expect(inner.components).toHaveLength(1);
		expect(at(inner.components, 0).type).toBe("text");
	});

	it("chains all component types fluently", () => {
		const form = new FormBuilder("f1")
			.text("Header")
			.textfield("Name", "name")
			.textarea("Desc", "desc")
			.select("Type", "type", { values: [{ label: "A", value: "a" }] })
			.radio("Confirm", "confirm", [{ label: "Yes", value: "y" }])
			.checkbox("Accept", "accept")
			.checklist("Options", "opts", [{ label: "X", value: "x" }])
			.group("Group", (g) => g.text("Inside"))
			.build();

		expect(form.components).toHaveLength(8);
		const types = form.components.map((c) => c.type);
		expect(types).toEqual([
			"text",
			"textfield",
			"textarea",
			"select",
			"radio",
			"checkbox",
			"checklist",
			"group",
		]);
	});

	it("generates unique IDs", () => {
		const form = new FormBuilder().text("A").text("B").text("C").build();
		const ids = new Set(form.components.map((c) => c.id));
		expect(ids.size).toBe(3);
	});

	it("roundtrips builder output through parse/export", () => {
		const form = new FormBuilder("roundtrip-test")
			.schemaVersion(18)
			.text("Welcome")
			.textfield("Name", "userName", { validate: { required: true } })
			.group(
				"Settings",
				(g) => {
					g.radio("Theme", "theme", [
						{ label: "Light", value: "light" },
						{ label: "Dark", value: "dark" },
					]);
					g.checkbox("Notifications", "notifications", { defaultValue: true });
				},
				{ showOutline: true },
			)
			.build();

		const json = exportForm(form);
		const reparsed = parseForm(json);

		expect(reparsed.id).toBe("roundtrip-test");
		expect(reparsed.components).toHaveLength(3);
		expect(at(reparsed.components, 2).type).toBe("group");
	});

	it("group builder supports all component types", () => {
		const form = new FormBuilder("f1")
			.group("All types", (g) => {
				g.text("T")
					.textfield("TF", "tf")
					.textarea("TA", "ta")
					.select("S", "s")
					.radio("R", "r", [{ label: "A", value: "a" }])
					.checkbox("CB", "cb")
					.checklist("CL", "cl", [{ label: "A", value: "a" }])
					.group("Nested", (ng) => ng.text("Deep"));
			})
			.build();

		const group = asGroup(at(form.components, 0));
		expect(group.components).toHaveLength(8);
	});
});
