import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PathError, discoverFiles, kindOf, resolveProjectPath } from "./project.js"

let root: string
let outside: string

beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "casen-dev-project-")))
	outside = realpathSync(mkdtempSync(join(tmpdir(), "casen-dev-outside-")))
})

afterEach(() => {
	rmSync(root, { recursive: true, force: true })
	rmSync(outside, { recursive: true, force: true })
})

function touch(rel: string, text = ""): void {
	const full = join(root, rel)
	mkdirSync(join(full, ".."), { recursive: true })
	writeFileSync(full, text)
}

describe("kindOf", () => {
	it("classifies by name, sidecars before plain BPMN", () => {
		expect(kindOf("a/order.bpmn")).toBe("bpmn")
		expect(kindOf("a/order.bpmn.tests.json")).toBe("tests")
		expect(kindOf("risk.DMN")).toBe("dmn")
		expect(kindOf("start.form")).toBe("form")
		expect(kindOf("notes.json")).toBeNull()
	})
})

describe("discoverFiles", () => {
	it("lists models sorted, flags sidecars, and skips hidden and build directories", async () => {
		touch("orders/order.bpmn")
		touch("orders/order.bpmn.tests.json", "[]")
		touch("orders/refund.bpmn")
		touch("decisions/risk.dmn")
		touch("forms/start.form")
		touch("README.md")
		touch(".git/stash.bpmn")
		touch("node_modules/pkg/x.bpmn")
		touch("dist/copy.bpmn")

		expect(await discoverFiles(root)).toEqual([
			{ path: "decisions/risk.dmn", kind: "dmn", hasTests: false },
			{ path: "forms/start.form", kind: "form", hasTests: false },
			{ path: "orders/order.bpmn", kind: "bpmn", hasTests: true },
			{ path: "orders/refund.bpmn", kind: "bpmn", hasTests: false },
		])
	})

	it("does not follow a symlinked directory out of the project", async () => {
		writeFileSync(join(outside, "secret.bpmn"), "")
		symlinkSync(outside, join(root, "linked"))
		expect(await discoverFiles(root)).toEqual([])
	})
})

describe("resolveProjectPath", () => {
	it("resolves a project file", async () => {
		touch("orders/order.bpmn")
		const resolved = await resolveProjectPath(root, "orders/order.bpmn")
		expect(resolved).toEqual({
			absolute: join(root, "orders", "order.bpmn"),
			relative: "orders/order.bpmn",
			kind: "bpmn",
		})
	})

	it("accepts a file that does not exist yet, such as a new tests sidecar", async () => {
		const resolved = await resolveProjectPath(root, "order.bpmn.tests.json")
		expect(resolved.kind).toBe("tests")
	})

	it.each([
		["../escape.bpmn", /Outside the project/],
		["orders/../../escape.bpmn", /Outside the project/],
		["/etc/passwd.bpmn", /Not a project-relative path/],
		["C:/x.bpmn", /Not a project-relative path/],
		[".git/config.bpmn", /Hidden paths/],
		["orders/.hidden.bpmn", /Hidden paths/],
		["package.json", /Not a \.bpmn/],
		["", /required/],
		["a\0.bpmn", /required/],
	])("rejects %j", async (requested, message) => {
		await expect(resolveProjectPath(root, requested)).rejects.toThrow(message)
		await expect(resolveProjectPath(root, requested)).rejects.toBeInstanceOf(PathError)
	})

	it("rejects a symlink that points out of the project", async () => {
		writeFileSync(join(outside, "secret.bpmn"), "<x/>")
		symlinkSync(join(outside, "secret.bpmn"), join(root, "innocent.bpmn"))
		await expect(resolveProjectPath(root, "innocent.bpmn")).rejects.toThrow(/Outside the project/)
	})
})
