import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RunContext } from "../types.js"
import { lintGroup } from "./lint.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * A task joined by two flows (BPMN Kit's `flow/multi-incoming-task`, an error;
 * bpmnlint's `fake-join`) and an inclusive gateway nobody asked BPMN Kit about.
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Started"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:parallelGateway id="fork"><bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing><bpmn:outgoing>f3</bpmn:outgoing></bpmn:parallelGateway>
    <bpmn:task id="join" name="Join"><bpmn:incoming>f2</bpmn:incoming><bpmn:incoming>f3</bpmn:incoming><bpmn:outgoing>f4</bpmn:outgoing></bpmn:task>
    <bpmn:inclusiveGateway id="or"><bpmn:incoming>f4</bpmn:incoming><bpmn:outgoing>f5</bpmn:outgoing></bpmn:inclusiveGateway>
    <bpmn:endEvent id="end" name="Done"><bpmn:incoming>f5</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="fork" />
    <bpmn:sequenceFlow id="f2" sourceRef="fork" targetRef="join" />
    <bpmn:sequenceFlow id="f3" sourceRef="fork" targetRef="join" />
    <bpmn:sequenceFlow id="f4" sourceRef="join" targetRef="or" />
    <bpmn:sequenceFlow id="f5" sourceRef="or" targetRef="end" />
  </bpmn:process>
</bpmn:definitions>`

// ── Harness ───────────────────────────────────────────────────────────────────

interface Captured {
	printed: unknown[]
	ok: string[]
	info: string[]
	error?: Error
}

const lintCmd = lintGroup.commands.find((c) => c.name === "lint")

let dir: string
let file: string

async function run(flags: Record<string, string | boolean> = {}): Promise<Captured> {
	const captured: Captured = { printed: [], ok: [], info: [] }
	const ctx = {
		positional: [file],
		flags,
		output: {
			print: (data: unknown) => captured.printed.push(data),
			ok: (msg: string) => captured.ok.push(msg),
			info: (msg: string) => captured.info.push(msg),
		},
	} as unknown as RunContext
	if (lintCmd === undefined) throw new Error("lint command is not registered")
	try {
		await lintCmd.run(ctx)
	} catch (err) {
		captured.error = err instanceof Error ? err : new Error(String(err))
	}
	return captured
}

function text(captured: Captured): string {
	return [...captured.info, ...captured.ok].join("\n")
}

function rc(config: unknown): void {
	writeFileSync(join(dir, ".bpmnlintrc"), JSON.stringify(config))
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "casen-bpmnlint-"))
	mkdirSync(join(dir, "diagrams"))
	file = join(dir, "diagrams", "order.bpmn")
	writeFileSync(file, XML)
})

afterEach(() => {
	rmSync(dir, { recursive: true, force: true })
	vi.restoreAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("casen lint — .bpmnlintrc", () => {
	it("without one, reports and fails as before", async () => {
		const result = await run()
		expect(text(result)).toContain("has 2 incoming flows")
		expect(text(result)).not.toContain(".bpmnlintrc")
		expect(result.error?.message).toMatch(/Lint failed/)
	})

	it("found in a parent directory, re-levels the equivalent finding and names the rule", async () => {
		rc({ rules: { "fake-join": "warn" } })
		const result = await run()
		expect(text(result)).toContain(`Using ${join(dir, ".bpmnlintrc")}`)
		expect(text(result)).toMatch(/⚠ \[flow\] \[join\] .*has 2 incoming flows.* \(fake-join\)/)
		// It was the only error; as a warning it no longer fails the run.
		expect(result.error).toBeUndefined()
	})

	it("turns the equivalent finding off", async () => {
		rc({ extends: "bpmnlint:correctness", rules: { "fake-join": "off" } })
		const result = await run()
		expect(text(result)).not.toContain("incoming flows")
	})

	it("runs the native equivalents of the rules it enables", async () => {
		rc({ rules: { "no-inclusive-gateway": "error" } })
		const result = await run()
		expect(text(result)).toMatch(
			/✖ \[pattern\] \[or\] .*inclusive gateway.* \(no-inclusive-gateway\)/,
		)
	})

	it("says which configured rules it could not apply", async () => {
		rc({ extends: "plugin:camunda-compat/camunda-cloud-8-6", rules: { "acme/x": "error" } })
		const notice = text(await run())
		expect(notice).toContain("Not applied — no BPMN Kit equivalent")
		expect(notice).toContain("plugin:camunda-compat/camunda-cloud-8-6")
		expect(notice).toContain("acme/x")
	})

	it("--no-bpmnlintrc ignores it", async () => {
		rc({ rules: { "fake-join": "off" } })
		const result = await run({ bpmnlintrc: false })
		expect(text(result)).toContain("has 2 incoming flows")
		expect(text(result)).not.toContain(".bpmnlintrc")
	})

	it("fails with the path when the file is not valid", async () => {
		writeFileSync(join(dir, ".bpmnlintrc"), "{ not json")
		const result = await run()
		expect(result.error?.message).toContain(join(dir, ".bpmnlintrc"))
	})

	it("keeps --format json a plain array, rule name included, notices on stderr", async () => {
		rc({ rules: { "fake-join": "warn" } })
		const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
		const result = await run({ format: "json" })
		const [findings] = result.printed as { id: string; bpmnlintRule?: string }[][]
		expect(findings?.find((f) => f.id === "flow/multi-incoming-task")?.bpmnlintRule).toBe(
			"fake-join",
		)
		expect(String(stderr.mock.calls[0]?.[0])).toContain(".bpmnlintrc")
	})
})

describe("casen lint — the project's own bpmnlint", () => {
	beforeEach(() => {
		// Install bpmnlint into the "project" the way npm would, from the root's devDependencies.
		const here = createRequire(import.meta.url)
		const modules = join(dir, "node_modules")
		mkdirSync(modules)
		symlinkSync(dirname(here.resolve("bpmnlint/package.json")), join(modules, "bpmnlint"), "dir")
		symlinkSync(dirname(dirname(here.resolve("bpmn-moddle"))), join(modules, "bpmn-moddle"), "dir")
	})

	it("reports bpmnlint's findings under their rule, instead of BPMN Kit's equivalents", async () => {
		rc({ rules: { "fake-join": "warn" } })
		const result = await run()
		const out = text(result)
		expect(out).toMatch(/Using .*\.bpmnlintrc \(bpmnlint \d+\.\d+\.\d+\)/)
		expect(out).toMatch(/⚠ \[bpmnlint\] \[join\] Incoming flows do not join \(fake-join\)/)
		expect(out).not.toContain("has 2 incoming flows")
		expect(result.error).toBeUndefined()
	})

	it("--categories without bpmnlint keeps BPMN Kit's equivalents instead", async () => {
		rc({ rules: { "fake-join": "warn" } })
		const out = text(await run({ categories: "flow" }))
		expect(out).not.toContain("[bpmnlint]")
		expect(out).toMatch(/has 2 incoming flows.* \(fake-join\)/)
	})
})
