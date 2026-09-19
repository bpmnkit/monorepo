import { describe, expect, it } from "vitest"
import { FormBuilder } from "../../src/form/form-builder.js"
import type { FormComponent, FormGroupComponent } from "../../src/form/form-model.js"
import { exportForm } from "../../src/form/form-serializer.js"

/**
 * Generated forms are rebuilt constantly and reviewed as a diff, so an unchanged
 * builder script has to produce byte-identical output. Nothing here calls
 * `resetIdCounter()`: the point is that stability does not depend on it.
 */

function at<T>(arr: readonly T[], index: number): T {
	const item = arr[index]
	if (item === undefined) throw new Error(`No item at index ${index}`)
	return item
}

function asGroup(c: FormComponent): FormGroupComponent {
	if (c.type !== "group") throw new Error(`Expected group, got ${c.type}`)
	return c
}

/** XML NCName: what an id attribute is allowed to be. */
const NC_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/

const sample = () =>
	new FormBuilder("f1")
		.text("Welcome")
		.textfield("Name", "name", { validate: { required: true } })
		.select("Colour", "colour", { values: [{ label: "Red", value: "red" }] })
		.group("Settings", (g) => {
			g.checkbox("Notify", "notify")
		})
		.build()

describe("deterministic component ids and rows", () => {
	it("exports byte-identical output on a rebuild", () => {
		expect(exportForm(sample())).toBe(exportForm(sample()))
	})

	it("names a field after its key, not its position", () => {
		const forward = new FormBuilder("f1").textfield("A", "a").textfield("B", "b").build()
		const reversed = new FormBuilder("f1").textfield("B", "b").textfield("A", "a").build()

		expect(at(reversed.components, 1).id).toBe(at(forward.components, 0).id)
		expect(at(reversed.components, 1).layout).toEqual(at(forward.components, 0).layout)
	})

	it("scopes ids by form, so one key means different ids in two forms", () => {
		const one = new FormBuilder("f1").textfield("Name", "name").build()
		const two = new FormBuilder("f2").textfield("Name", "name").build()
		expect(at(two.components, 0).id).not.toBe(at(one.components, 0).id)
	})

	it("separates the id from the row of the same component", () => {
		const c = at(new FormBuilder("f1").textfield("Name", "name").build().components, 0)
		expect(c.layout?.row).not.toBe(c.id)
	})

	it("separates components that differ only by type", () => {
		const form = new FormBuilder("f1").textfield("X", "x").textarea("X", "x").build()
		expect(at(form.components, 0).id).not.toBe(at(form.components, 1).id)
	})

	it("numbers components nothing intrinsic tells apart", () => {
		const form = new FormBuilder("f1").text("A").text("A").text("A").build()
		const ids = new Set(form.components.map((c) => c.id))
		const rows = new Set(form.components.map((c) => c.layout?.row))
		expect(ids.size).toBe(3)
		expect(rows.size).toBe(3)
		// Still deterministic — the numbering is by add order, which the script fixes.
		expect(exportForm(form)).toBe(
			exportForm(new FormBuilder("f1").text("A").text("A").text("A").build()),
		)
	})

	it("keeps a nested tree deterministic all the way down", () => {
		const build = () =>
			new FormBuilder("f1")
				.group("Outer", (outer) => {
					outer.group("Inner", (inner) => {
						inner.textfield("Name", "name")
					})
				})
				.build()

		const first = build()
		const second = build()
		const nested = (form: ReturnType<typeof build>) =>
			at(asGroup(at(asGroup(at(form.components, 0)).components, 0)).components, 0)

		expect(nested(second).id).toBe(nested(first).id)
		expect(nested(second).layout).toEqual(nested(first).layout)
	})

	it("scopes a group's children by the group, so one key survives in two groups", () => {
		const form = new FormBuilder("f1")
			.group("A", (g) => g.textfield("Name", "name"))
			.group("B", (g) => g.textfield("Name", "name"))
			.build()

		const inA = at(asGroup(at(form.components, 0)).components, 0)
		const inB = at(asGroup(at(form.components, 1)).components, 0)
		expect(inB.id).not.toBe(inA.id)
		expect(inB.layout?.row).not.toBe(inA.layout?.row)
	})

	it("generates valid NCNames", () => {
		const form = new FormBuilder("f1").text("a b").textfield("Ünïcødé", "kéy").build()
		for (const c of form.components) {
			expect(c.id).toMatch(NC_NAME)
			expect(c.layout?.row).toMatch(NC_NAME)
		}
	})
})

describe("layout null semantics", () => {
	it("treats a null row as unset and fills in a generated one", () => {
		const form = new FormBuilder("f1").textfield("Name", "name", { layout: { row: null } }).build()
		const bare = new FormBuilder("f1").textfield("Name", "name").build()

		expect(at(form.components, 0).layout?.row).toBe(at(bare.components, 0).layout?.row)
	})

	it("treats a null columns as the intentional default and keeps it", () => {
		const form = new FormBuilder("f1")
			.textfield("Name", "name", { layout: { columns: null } })
			.build()
		expect(at(form.components, 0).layout?.columns).toBeNull()
	})

	it("completes a half-built layout rather than passing it through", () => {
		const form = new FormBuilder("f1")
			.textfield("Cols only", "cols", { layout: { columns: 4 } })
			.textfield("Row only", "row", { layout: { row: "Row_custom" } })
			.build()

		expect(at(form.components, 0).layout?.columns).toBe(4)
		expect(at(form.components, 0).layout?.row).toMatch(/^Row_/)
		expect(at(form.components, 1).layout).toEqual({ row: "Row_custom", columns: null })
	})

	it("leaves a fully supplied layout untouched", () => {
		const form = new FormBuilder("f1")
			.textfield("Full", "full", { layout: { row: "Row_custom", columns: 8 } })
			.build()
		expect(at(form.components, 0).layout).toEqual({ row: "Row_custom", columns: 8 })
	})

	it("keeps a caller-supplied id", () => {
		const form = new FormBuilder("f1").textfield("Name", "name", { id: "Field_mine" }).build()
		expect(at(form.components, 0).id).toBe("Field_mine")
	})
})
