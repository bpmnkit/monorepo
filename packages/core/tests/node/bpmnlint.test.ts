import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { applyBpmnlintConfig } from "../../src/bpmn/bpmnlint.js"
import { Bpmn } from "../../src/bpmn/index.js"
import { optimize } from "../../src/bpmn/optimize/index.js"
import {
	findBpmnlintrc,
	prepareBpmnlint,
	readBpmnlintrc,
	runBpmnlint,
} from "../../src/node/bpmnlint.js"

// bpmnlint and bpmn-moddle are root devDependencies purely for this file — the
// published packages never depend on them.
const here = createRequire(import.meta.url)
const BPMNLINT_DIR = dirname(here.resolve("bpmnlint/package.json"))
const MODDLE_DIR = dirname(dirname(here.resolve("bpmn-moddle")))

/** An unnamed task joined by two flows: bpmnlint's `label-required` and `fake-join`. */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Started"><bpmn:outgoing>f1</bpmn:outgoing><bpmn:outgoing>f2</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="todo" name="TODO: write this"><bpmn:incoming>f1</bpmn:incoming><bpmn:incoming>f2</bpmn:incoming><bpmn:outgoing>f3</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="end" name="Done"><bpmn:incoming>f3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="todo" />
    <bpmn:sequenceFlow id="f2" sourceRef="start" targetRef="todo" />
    <bpmn:sequenceFlow id="f3" sourceRef="todo" targetRef="end" />
  </bpmn:process>
</bpmn:definitions>`

/** A third-party plugin, the way one ships on npm: CommonJS, rules under `rules/`. */
function installPlugin(project: string): void {
	const plugin = join(project, "node_modules", "bpmnlint-plugin-acme")
	mkdirSync(join(plugin, "rules"), { recursive: true })
	writeFileSync(
		join(plugin, "package.json"),
		JSON.stringify({ name: "bpmnlint-plugin-acme", version: "1.0.0", main: "index.js" }),
	)
	writeFileSync(
		join(plugin, "index.js"),
		`module.exports = { configs: { recommended: { rules: { "no-todo": "warn" } } } }`,
	)
	writeFileSync(
		join(plugin, "rules", "no-todo.js"),
		`module.exports = function () {
			return {
				check(node, reporter) {
					if (node.$type === "bpmn:Task" && /TODO/.test(node.name || "")) {
						reporter.report(node.id, "Task is still a TODO")
					}
				}
			}
		}`,
	)
}

/** Links the root's bpmnlint and bpmn-moddle into a project, as `npm install` would. */
function installBpmnlint(project: string): void {
	const modules = join(project, "node_modules")
	mkdirSync(modules, { recursive: true })
	symlinkSync(BPMNLINT_DIR, join(modules, "bpmnlint"), "dir")
	symlinkSync(MODDLE_DIR, join(modules, "bpmn-moddle"), "dir")
}

let project: string

beforeEach(() => {
	project = mkdtempSync(join(tmpdir(), "bpmnlint-"))
})

afterEach(() => {
	rmSync(project, { recursive: true, force: true })
})

describe("findBpmnlintrc", () => {
	it("finds the nearest config in the file's directory or above", async () => {
		mkdirSync(join(project, "a", "b"), { recursive: true })
		writeFileSync(join(project, ".bpmnlintrc"), "{}")
		expect(await findBpmnlintrc(join(project, "a", "b"))).toBe(join(project, ".bpmnlintrc"))
		writeFileSync(join(project, "a", ".bpmnlintrc"), "{}")
		expect(await findBpmnlintrc(join(project, "a", "b"))).toBe(join(project, "a", ".bpmnlintrc"))
	})

	it("returns undefined when there is none", async () => {
		// The temp directory's ancestors are outside any project.
		const found = await findBpmnlintrc(project)
		expect(found === undefined || !found.startsWith(project)).toBe(true)
	})
})

describe("readBpmnlintrc", () => {
	it("names the file when it is invalid", async () => {
		const path = join(project, ".bpmnlintrc")
		writeFileSync(path, "{ nope")
		await expect(readBpmnlintrc(path)).rejects.toThrow(path)
	})
})

describe("runBpmnlint", () => {
	it("reports what is missing when the project has not installed bpmnlint", async () => {
		const result = await runBpmnlint(XML, { extends: "bpmnlint:recommended" }, project)
		expect(result).toEqual({ status: "unavailable", missing: ["bpmnlint", "bpmn-moddle"] })
	})

	it("runs the project's bpmnlint, plugins included", async () => {
		installBpmnlint(project)
		installPlugin(project)
		const result = await runBpmnlint(
			XML,
			{
				extends: ["bpmnlint:recommended", "plugin:acme/recommended"],
				rules: { "label-required": "off" },
			},
			project,
		)
		expect(result.status).toBe("ok")
		if (result.status !== "ok") return

		expect(result.reports).toContainEqual({
			rule: "acme/no-todo",
			severity: "warning",
			message: "Task is still a TODO",
			elementId: "todo",
		})
		expect(result.reports).toContainEqual(
			expect.objectContaining({ rule: "fake-join", severity: "warning", elementId: "todo" }),
		)
		expect(result.reports.some((r) => r.rule === "label-required")).toBe(false)
		// bpmnlint's own view of the rules, with the plugin config expanded.
		expect(result.config.rules["acme/no-todo"]).toEqual({ severity: "warn" })
		expect(result.config.rules["label-required"]).toEqual({ severity: "off" })
		expect(result.config.unresolvedExtends).toEqual([])
	})

	it("fails with bpmnlint's reason when a configured plugin is not installed", async () => {
		installBpmnlint(project)
		const result = await runBpmnlint(XML, { extends: "plugin:missing/recommended" }, project)
		expect(result.status).toBe("failed")
		if (result.status === "failed") expect(result.error).toMatch(/missing/)
	})
})

describe("prepareBpmnlint", () => {
	it("returns undefined without a .bpmnlintrc", async () => {
		mkdirSync(join(project, "x"))
		const file = join(project, "x", "a.bpmn")
		const setup = await prepareBpmnlint(file, XML)
		// Only a config outside the temp dir could apply — and none should.
		expect(setup === undefined || !setup.path.startsWith(project)).toBe(true)
	})

	it("stands BPMN Kit's equivalents in when bpmnlint is not installed", async () => {
		writeFileSync(join(project, ".bpmnlintrc"), JSON.stringify({ rules: { "fake-join": "warn" } }))
		const setup = await prepareBpmnlint(join(project, "a.bpmn"), XML)
		expect(setup).toMatchObject({ delegated: false, reports: [] })
		expect(setup?.failure).toBeUndefined()
	})

	it("delegates to real bpmnlint when installed, without double-reporting", async () => {
		installBpmnlint(project)
		writeFileSync(join(project, ".bpmnlintrc"), JSON.stringify({ rules: { "fake-join": "warn" } }))
		const setup = await prepareBpmnlint(join(project, "a.bpmn"), XML)
		expect(setup?.delegated).toBe(true)
		expect(setup?.reports.map((r) => r.rule)).toEqual(["fake-join"])

		const defs = Bpmn.parse(XML)
		const own = optimize(defs).findings
		expect(own.some((f) => f.id === "flow/multi-incoming-task")).toBe(true)
		if (setup === undefined) return
		const { findings } = applyBpmnlintConfig(defs, own, setup.config, { delegated: true })
		expect(findings.some((f) => f.id === "flow/multi-incoming-task")).toBe(false)
	})

	it("can be told not to run real bpmnlint", async () => {
		installBpmnlint(project)
		writeFileSync(join(project, ".bpmnlintrc"), JSON.stringify({ rules: { "fake-join": "warn" } }))
		const setup = await prepareBpmnlint(join(project, "a.bpmn"), XML, { runBpmnlint: false })
		expect(setup).toMatchObject({ delegated: false, reports: [] })
	})

	it("falls back, and says why, when real bpmnlint fails", async () => {
		installBpmnlint(project)
		writeFileSync(join(project, ".bpmnlintrc"), JSON.stringify({ extends: "plugin:missing/all" }))
		const setup = await prepareBpmnlint(join(project, "a.bpmn"), XML)
		expect(setup?.delegated).toBe(false)
		expect(setup?.failure).toMatch(/missing/)
		expect(setup?.config.unresolvedExtends).toEqual(["plugin:missing/all"])
	})
})
