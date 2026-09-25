import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
	BPMNLINT_RULE_MAP,
	type ResolvedBpmnlintConfig,
	applyBpmnlintConfig,
	bpmnlintRuleForFinding,
	normalizeBpmnlintRuleName,
	parseBpmnlintConfig,
	resolveBpmnlintConfig,
} from "../src/bpmn/bpmnlint.js"
import { Bpmn } from "../src/bpmn/index.js"
import { lintDiagram } from "../src/bpmn/lint.js"
import { optimize } from "../src/bpmn/optimize/index.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NS = `xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`

/** A definitions document around the given process body (and optional extras). */
function doc(body: string, extras = "", di = ""): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  ${extras}
  <bpmn:process id="proc" isExecutable="true">
    ${body}
  </bpmn:process>
  ${di}
</bpmn:definitions>`
}

function flow(id: string, from: string, to: string, extra = ""): string {
	return `<bpmn:sequenceFlow id="${id}" sourceRef="${from}" targetRef="${to}"${extra} />`
}

function cond(id: string, from: string, to: string): string {
	return `<bpmn:sequenceFlow id="${id}" sourceRef="${from}" targetRef="${to}"><bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">= ok</bpmn:conditionExpression></bpmn:sequenceFlow>`
}

/** start → a → end, all named: a model BPMN Kit's default rules have little to say about. */
const LINEAR = `
  <bpmn:startEvent id="start" name="Started" />
  <bpmn:task id="a" name="Do A" />
  <bpmn:endEvent id="end" name="Done" />
  ${flow("f1", "start", "a")}
  ${flow("f2", "a", "end")}`

function config(rules: ResolvedBpmnlintConfig["rules"]): ResolvedBpmnlintConfig {
	return { rules, unresolvedExtends: [] }
}

/** Findings for one enabled bpmnlint rule, with the rest of the config empty. */
function withRule(xml: string, rule: string, options?: unknown) {
	const defs = Bpmn.parse(xml)
	const setting =
		options === undefined ? { severity: "error" as const } : { severity: "error" as const, options }
	return applyBpmnlintConfig(defs, [], config({ [rule]: setting })).findings
}

// ── Parsing ───────────────────────────────────────────────────────────────────

describe("parseBpmnlintConfig", () => {
	it("reads extends as a string or an array, and rule settings in every accepted form", () => {
		expect(parseBpmnlintConfig('{ "extends": "bpmnlint:recommended" }')).toEqual({
			extends: "bpmnlint:recommended",
		})
		const parsed = parseBpmnlintConfig(
			JSON.stringify({
				extends: ["bpmnlint:correctness", "plugin:camunda-compat/camunda-cloud-8-6"],
				rules: {
					"label-required": "off",
					"fake-join": ["WARN"],
					"standard-size": [2, { x: 1 }],
					global: 3,
				},
			}),
		)
		expect(parsed.extends).toEqual([
			"bpmnlint:correctness",
			"plugin:camunda-compat/camunda-cloud-8-6",
		])
		expect(Object.keys(parsed.rules ?? {})).toHaveLength(4)
	})

	it("says what is wrong with an invalid file", () => {
		expect(() => parseBpmnlintConfig("{ extends: ")).toThrow(/not valid JSON/)
		expect(() => parseBpmnlintConfig("[]")).toThrow(/JSON object/)
		expect(() => parseBpmnlintConfig('{ "extends": 1 }')).toThrow(/"extends" must be/)
		expect(() => parseBpmnlintConfig('{ "rules": { "fake-join": "loud" } }')).toThrow(
			/rule "fake-join" has setting "loud"/,
		)
		expect(() => parseBpmnlintConfig('{ "rules": { "fake-join": 7 } }')).toThrow(/0–3/)
	})
})

describe("normalizeBpmnlintRuleName", () => {
	it("folds the spellings bpmnlint treats as one rule", () => {
		expect(normalizeBpmnlintRuleName("label-required")).toBe("label-required")
		expect(normalizeBpmnlintRuleName("bpmnlint/label-required")).toBe("label-required")
		expect(normalizeBpmnlintRuleName("bpmnlint-plugin-camunda-compat/timer")).toBe(
			"camunda-compat/timer",
		)
		expect(normalizeBpmnlintRuleName("camunda-compat/timer")).toBe("camunda-compat/timer")
		expect(normalizeBpmnlintRuleName("@acme/bpmnlint-plugin-x/y")).toBe("@acme/x/y")
	})
})

describe("resolveBpmnlintConfig", () => {
	it("expands the built-in presets and lets the file's rules win", () => {
		const resolved = resolveBpmnlintConfig(
			parseBpmnlintConfig(
				JSON.stringify({
					extends: "bpmnlint:recommended",
					rules: { "fake-join": "error", "bpmnlint/label-required": "off" },
				}),
			),
		)
		expect(resolved.rules["no-disconnected"]).toEqual({ severity: "error" })
		expect(resolved.rules["no-inclusive-gateway"]).toEqual({ severity: "warn" })
		expect(resolved.rules["fake-join"]).toEqual({ severity: "error" })
		expect(resolved.rules["label-required"]).toEqual({ severity: "off" })
		expect(resolved.unresolvedExtends).toEqual([])
	})

	it("expands all and correctness, maps numeric levels, and keeps options", () => {
		const all = resolveBpmnlintConfig({ extends: "bpmnlint:all" })
		expect(Object.keys(all.rules)).toHaveLength(28)
		const correctness = resolveBpmnlintConfig({
			extends: ["bpmnlint:correctness"],
			rules: { "standard-size": [1, { "bpmn:Task": { width: 120, height: 80 } }], global: 3 },
		})
		expect(correctness.rules["no-duplicate-sequence-flows"]).toEqual({ severity: "warn" })
		expect(correctness.rules["standard-size"]).toEqual({
			severity: "warn",
			options: { "bpmn:Task": { width: 120, height: 80 } },
		})
		expect(correctness.rules.global).toEqual({ severity: "info" })
	})

	it("lists plugin configs it cannot expand instead of dropping them", () => {
		const resolved = resolveBpmnlintConfig({
			extends: ["bpmnlint:recommended", "plugin:camunda-compat/camunda-cloud-8-6"],
		})
		expect(resolved.unresolvedExtends).toEqual(["plugin:camunda-compat/camunda-cloud-8-6"])
	})
})

// ── Mapping table ─────────────────────────────────────────────────────────────

describe("BPMNLINT_RULE_MAP", () => {
	it("covers every bpmnlint built-in rule, each finding id at most once", () => {
		expect(Object.keys(BPMNLINT_RULE_MAP)).toHaveLength(28)
		const ids = Object.values(BPMNLINT_RULE_MAP).flatMap((m) => m.findings)
		expect(new Set(ids).size).toBe(ids.length)
		for (const [rule, mapping] of Object.entries(BPMNLINT_RULE_MAP)) {
			if (mapping.match === "approximate") expect(mapping.note, rule).toBeTruthy()
		}
		const replaced = Object.values(BPMNLINT_RULE_MAP).flatMap((m) => m.replaces ?? [])
		expect(new Set(replaced).size).toBe(replaced.length)
		for (const id of replaced) expect(ids, id).not.toContain(id)
	})

	it("maps back from a finding to its rule", () => {
		expect(bpmnlintRuleForFinding("flow/mixed-gateway")).toBe("no-gateway-join-fork")
		expect(bpmnlintRuleForFinding("pattern/user-task-no-timer")).toBeUndefined()
		// Replaced findings no longer stand in for the rule; its native finding does.
		expect(bpmnlintRuleForFinding("flow/implicit-end")).toBe("no-implicit-end")
		expect(bpmnlintRuleForFinding("flow/dead-end")).toBeUndefined()
	})

	it("names only finding ids some rule actually emits", () => {
		const emitted = new Set(
			readdirSync(OPTIMIZE_DIR)
				.filter((file) => file.endsWith(".ts"))
				.flatMap((file) => [
					...readFileSync(join(OPTIMIZE_DIR, file), "utf-8").matchAll(
						/"((?:flow|feel|naming|pattern)\/[a-z-]+)"/g,
					),
				])
				.map((match) => match[1]),
		)
		for (const [rule, mapping] of Object.entries(BPMNLINT_RULE_MAP)) {
			for (const id of [...mapping.findings, ...(mapping.replaces ?? [])]) {
				expect(emitted, `${rule} → ${id}`).toContain(id)
			}
		}
	})
})

const OPTIMIZE_DIR = fileURLToPath(new URL("../src/bpmn/optimize/", import.meta.url))

// ── Applying a config to existing findings ────────────────────────────────────

/** A task joined by two flows — BPMN Kit's `flow/multi-incoming-task`, bpmnlint's `fake-join`. */
const FAKE_JOIN = doc(`
  <bpmn:startEvent id="start" name="Started" />
  <bpmn:parallelGateway id="fork" />
  <bpmn:task id="a" name="Do A" />
  <bpmn:task id="b" name="Do B" />
  <bpmn:task id="join" name="Join" />
  <bpmn:endEvent id="end" name="Done" />
  ${flow("f1", "start", "fork")}
  ${flow("f2", "fork", "a")}
  ${flow("f3", "fork", "b")}
  ${flow("f4", "a", "join")}
  ${flow("f5", "b", "join")}
  ${flow("f6", "join", "end")}`)

describe("applyBpmnlintConfig — severity", () => {
	const defs = Bpmn.parse(FAKE_JOIN)
	const findings = optimize(defs).findings
	const fakeJoin = (list: { id: string }[]) =>
		list.filter((f) => f.id === "flow/multi-incoming-task")

	it("takes the configured level and names the rule", () => {
		expect(fakeJoin(findings)[0]?.severity).toBe("error")
		const applied = applyBpmnlintConfig(
			defs,
			findings,
			config({ "fake-join": { severity: "warn" } }),
		)
		const [finding] = fakeJoin(applied.findings)
		expect(finding).toMatchObject({ severity: "warning", bpmnlintRule: "fake-join" })
		// The fix travels with the finding.
		expect(typeof (finding as { applyFix?: unknown }).applyFix).toBe("function")
	})

	it("drops the finding when the rule is off", () => {
		const applied = applyBpmnlintConfig(
			defs,
			findings,
			config({ "fake-join": { severity: "off" } }),
		)
		expect(fakeJoin(applied.findings)).toEqual([])
	})

	it("leaves findings alone when the config does not mention their rule", () => {
		const applied = applyBpmnlintConfig(defs, findings, config({}))
		expect(applied.findings).toEqual(findings)
	})

	it("maps info to info", () => {
		const applied = applyBpmnlintConfig(
			defs,
			findings,
			config({ "fake-join": { severity: "info" } }),
		)
		expect(fakeJoin(applied.findings)[0]?.severity).toBe("info")
	})

	it("drops covered findings entirely when real bpmnlint already reported the rule", () => {
		const applied = applyBpmnlintConfig(
			defs,
			findings,
			config({ "fake-join": { severity: "warn" }, "no-disconnected": { severity: "error" } }),
			{ delegated: true },
		)
		expect(fakeJoin(applied.findings)).toEqual([])
		expect(applied.findings.some((f) => f.id === "flow/disconnected")).toBe(false)
		expect(applied.unsupported).toEqual([])
	})
})

describe("applyBpmnlintConfig — replaced findings", () => {
	// `a` has no outgoing flow: BPMN Kit's `flow/dead-end`, bpmnlint's `no-implicit-end`.
	const defs = Bpmn.parse(
		doc(
			`<bpmn:startEvent id="start" name="S" /><bpmn:task id="a" name="A" />${flow("f1", "start", "a")}`,
		),
	)
	const findings = optimize(defs).findings
	const deadEnds = (list: { id: string }[]) => list.filter((f) => f.id === "flow/dead-end")

	it("keeps BPMN Kit's own finding when the config does not set the rule", () => {
		expect(deadEnds(findings)).toHaveLength(1)
		expect(deadEnds(applyBpmnlintConfig(defs, findings, config({})).findings)).toHaveLength(1)
	})

	it("reports the rule with its native finding instead, at the configured level", () => {
		const applied = applyBpmnlintConfig(
			defs,
			findings,
			config({ "no-implicit-end": { severity: "warn" } }),
		).findings
		expect(deadEnds(applied)).toEqual([])
		expect(applied.filter((f) => f.bpmnlintRule === "no-implicit-end")).toMatchObject([
			{ id: "flow/implicit-end", severity: "warning", elementIds: ["a"] },
		])
	})

	it("drops it when the rule is off or real bpmnlint reported it", () => {
		const off = config({ "no-implicit-end": { severity: "off" } })
		expect(deadEnds(applyBpmnlintConfig(defs, findings, off).findings)).toEqual([])
		const on = config({ "no-implicit-end": { severity: "error" } })
		const delegated = applyBpmnlintConfig(defs, findings, on, { delegated: true }).findings
		expect(deadEnds(delegated)).toEqual([])
		expect(delegated.some((f) => f.id === "flow/implicit-end")).toBe(false)
	})
})

describe("applyBpmnlintConfig — unsupported rules", () => {
	it("reports plugin rules, unknown rules and unexpanded plugin configs", () => {
		const defs = Bpmn.parse(doc(LINEAR))
		const resolved = resolveBpmnlintConfig({
			extends: ["bpmnlint:correctness", "plugin:camunda-compat/camunda-cloud-8-6"],
			rules: { "camunda-compat/timer": "error", "no-such-rule": "warn", "acme/x": "off" },
		})
		const { unsupported } = applyBpmnlintConfig(defs, [], resolved)
		expect(unsupported).toEqual([
			{ name: "plugin:camunda-compat/camunda-cloud-8-6", reason: "unresolved-extends" },
			{ name: "camunda-compat/timer", reason: "plugin-rule", severity: "error" },
			{ name: "no-such-rule", reason: "unknown-rule", severity: "warn" },
		])
	})
})

describe("lintDiagram with a .bpmnlintrc", () => {
	it("applies the config and reports what it could not honour", () => {
		const report = lintDiagram(Bpmn.parse(FAKE_JOIN), {
			bpmnlint: resolveBpmnlintConfig({
				rules: { "fake-join": "warn", "camunda-compat/no-loop": "error" },
			}),
		})
		const diagnostic = report.diagnostics.find((d) => d.id === "flow/multi-incoming-task")
		expect(diagnostic).toMatchObject({
			severity: "warning",
			bpmnlintRule: "fake-join",
			fixable: true,
		})
		// camunda-compat rules BPMN Kit checks itself are governed, not listed.
		expect(report.bpmnlintUnsupported).toEqual([
			{ name: "camunda-compat/no-loop", reason: "plugin-rule", severity: "error" },
		])
	})

	it("says nothing about bpmnlint without a config", () => {
		const report = lintDiagram(Bpmn.parse(FAKE_JOIN))
		expect(report.bpmnlintUnsupported).toBeUndefined()
		expect(report.diagnostics.every((d) => d.bpmnlintRule === undefined)).toBe(true)
	})

	it("runs native equivalents only within the requested categories", () => {
		const xml = doc(`${LINEAR}<bpmn:inclusiveGateway id="or" />`)
		const on = lintDiagram(Bpmn.parse(xml), {
			bpmnlint: resolveBpmnlintConfig({ rules: { "no-inclusive-gateway": "warn" } }),
		})
		expect(on.diagnostics.some((d) => d.id === "pattern/inclusive-gateway")).toBe(true)
		const narrowed = lintDiagram(Bpmn.parse(xml), {
			categories: ["flow"],
			bpmnlint: resolveBpmnlintConfig({ rules: { "no-inclusive-gateway": "warn" } }),
		})
		expect(narrowed.diagnostics.some((d) => d.id === "pattern/inclusive-gateway")).toBe(false)
	})
})

// ── Native equivalents ────────────────────────────────────────────────────────

const ids = (findings: { id: string; elementIds: string[] }[]) =>
	findings.map((f) => `${f.id}@${f.elementIds.join(",")}`)

describe("native bpmnlint rules", () => {
	it("do not run unless the config enables them", () => {
		const xml = doc(`${LINEAR}<bpmn:inclusiveGateway id="or" />`)
		const defs = Bpmn.parse(xml)
		expect(applyBpmnlintConfig(defs, [], config({})).findings).toEqual([])
		expect(
			applyBpmnlintConfig(defs, [], config({ "no-inclusive-gateway": { severity: "off" } }))
				.findings,
		).toEqual([])
	})

	it("carry the configured severity and rule name", () => {
		const defs = Bpmn.parse(doc(`${LINEAR}<bpmn:complexGateway id="cx" />`))
		const [finding] = applyBpmnlintConfig(
			defs,
			[],
			config({ "no-complex-gateway": { severity: "info" } }),
		).findings
		expect(finding).toMatchObject({
			id: "pattern/complex-gateway",
			severity: "info",
			bpmnlintRule: "no-complex-gateway",
			category: "pattern",
			processId: "proc",
			elementIds: ["cx"],
		})
	})

	it("ad-hoc-sub-process: start and end events inside an ad-hoc sub-process", () => {
		const xml = doc(`${LINEAR}
		  <bpmn:adHocSubProcess id="adhoc"><bpmn:startEvent id="s" /><bpmn:task id="t" /><bpmn:endEvent id="e" /></bpmn:adHocSubProcess>`)
		expect(ids(withRule(xml, "ad-hoc-sub-process"))).toEqual([
			"flow/ad-hoc-start-end-event@s",
			"flow/ad-hoc-start-end-event@e",
		])
	})

	it("conditional-event: a conditional event with no condition, in executable processes", () => {
		const body = `${LINEAR}
		  <bpmn:intermediateCatchEvent id="c1"><bpmn:conditionalEventDefinition id="cd1" /></bpmn:intermediateCatchEvent>
		  <bpmn:intermediateCatchEvent id="c2"><bpmn:conditionalEventDefinition id="cd2"><bpmn:condition xsi:type="bpmn:tFormalExpression">= x</bpmn:condition></bpmn:conditionalEventDefinition></bpmn:intermediateCatchEvent>`
		expect(ids(withRule(doc(body), "conditional-event"))).toEqual([
			"flow/conditional-event-no-condition@c1",
		])
		expect(
			withRule(
				doc(body).replace('isExecutable="true"', 'isExecutable="false"'),
				"conditional-event",
			),
		).toEqual([])
	})

	it("start-/end-event-required: sub-processes (top level is flow/no-start-event)", () => {
		const xml = doc(`${LINEAR}<bpmn:subProcess id="sub"><bpmn:task id="t" /></bpmn:subProcess>
		  <bpmn:adHocSubProcess id="adhoc"><bpmn:task id="t2" /></bpmn:adHocSubProcess>`)
		expect(ids(withRule(xml, "start-event-required"))).toEqual([
			"flow/sub-process-no-start-event@sub",
		])
		expect(ids(withRule(xml, "end-event-required"))).toEqual(["flow/sub-process-no-end-event@sub"])
	})

	it("event-based-gateway: fewer than two outgoing flows, or a conditional one", () => {
		const xml = doc(`${LINEAR}
		  <bpmn:eventBasedGateway id="g1" />
		  <bpmn:intermediateCatchEvent id="m1"><bpmn:timerEventDefinition /></bpmn:intermediateCatchEvent>
		  <bpmn:eventBasedGateway id="g2" />
		  <bpmn:intermediateCatchEvent id="m2"><bpmn:timerEventDefinition /></bpmn:intermediateCatchEvent>
		  <bpmn:intermediateCatchEvent id="m3"><bpmn:timerEventDefinition /></bpmn:intermediateCatchEvent>
		  ${flow("e1", "g1", "m1")}
		  ${cond("e2", "g2", "m2")}
		  ${flow("e3", "g2", "m3")}`)
		expect(ids(withRule(xml, "event-based-gateway"))).toEqual([
			"flow/event-gateway-invalid@g1",
			"flow/event-gateway-invalid@e2",
		])
	})

	it("event-sub-process-typed-start-event and sub-process-blank-start-event", () => {
		const xml = doc(`${LINEAR}
		  <bpmn:subProcess id="evt" triggeredByEvent="true"><bpmn:startEvent id="blank" /></bpmn:subProcess>
		  <bpmn:subProcess id="sub"><bpmn:startEvent id="typed"><bpmn:timerEventDefinition /></bpmn:startEvent></bpmn:subProcess>`)
		expect(ids(withRule(xml, "event-sub-process-typed-start-event"))).toEqual([
			"flow/event-sub-process-untyped-start@blank",
		])
		expect(ids(withRule(xml, "sub-process-blank-start-event"))).toEqual([
			"flow/sub-process-typed-start@typed",
		])
	})

	it("global: unnamed, unused and duplicate-named root elements", () => {
		const extras = `
		  <bpmn:error id="err1" name="Failed" errorCode="E1" />
		  <bpmn:error id="err2" name="Failed" errorCode="E2" />
		  <bpmn:message id="msg1" />
		  <bpmn:signal id="sig1" name="Go" />`
		const body = `${LINEAR}
		  <bpmn:boundaryEvent id="b1" attachedToRef="a"><bpmn:errorEventDefinition errorRef="err1" /></bpmn:boundaryEvent>
		  <bpmn:receiveTask id="r" name="Wait" messageRef="msg1" />
		  <bpmn:intermediateThrowEvent id="t"><bpmn:signalEventDefinition signalRef="sig1" /></bpmn:intermediateThrowEvent>`
		const messages = withRule(doc(body, extras), "global").map((f) => f.message)
		expect(messages).toEqual([
			'Global error "err1" shares its name with another error.',
			'Global error "err2" is not referenced by any element.',
			'Global error "err2" shares its name with another error.',
			'Global message "msg1" has no name.',
		])
	})

	it("link-event: unnamed, unpaired and duplicate link events", () => {
		const link = (id: string, kind: "Throw" | "Catch", name?: string) =>
			`<bpmn:intermediate${kind}Event id="${id}"><bpmn:linkEventDefinition id="${id}_d"${name === undefined ? "" : ` name="${name}"`} /></bpmn:intermediate${kind}Event>`
		const xml = doc(`${LINEAR}
		  ${link("t1", "Throw", "A")}${link("c1", "Catch", "A")}
		  ${link("t2", "Throw", "B")}
		  ${link("c3", "Catch", "C")}${link("c4", "Catch", "C")}
		  ${link("t5", "Throw", "D")}${link("t6", "Throw", "D")}
		  ${link("x", "Throw")}`)
		expect(ids(withRule(xml, "link-event"))).toEqual([
			"flow/link-event-mismatch@x",
			"flow/link-event-mismatch@t2",
			"flow/link-event-mismatch@c3",
			"flow/link-event-mismatch@c4",
			"flow/link-event-mismatch@t5",
			"flow/link-event-mismatch@t6",
		])
	})

	it("no-bpmndi: elements without a shape or edge", () => {
		const di = `<bpmndi:BPMNDiagram id="d"><bpmndi:BPMNPlane id="p" bpmnElement="proc">
		  <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="0" y="0" width="36" height="36" /></bpmndi:BPMNShape>
		  <bpmndi:BPMNShape id="s2" bpmnElement="a"><dc:Bounds x="100" y="0" width="100" height="80" /></bpmndi:BPMNShape>
		  <bpmndi:BPMNEdge id="e1" bpmnElement="f1"><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="36" y="18" /><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="100" y="18" /></bpmndi:BPMNEdge>
		</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>`
		const xml = doc(`${LINEAR}<bpmn:dataObject id="data" />`, "", di)
		expect(ids(withRule(xml, "no-bpmndi"))).toEqual([
			"pattern/missing-di@end",
			"pattern/missing-di@f2",
		])
	})

	it("no-disconnected: no incoming and no outgoing flow", () => {
		const xml = doc(`${LINEAR}
		  <bpmn:task id="lonely" />
		  <bpmn:task id="handler" isForCompensation="true" />
		  <bpmn:subProcess id="evt" triggeredByEvent="true" />
		  <bpmn:adHocSubProcess id="adhoc"><bpmn:task id="free" /></bpmn:adHocSubProcess>`)
		expect(ids(withRule(xml, "no-disconnected"))).toEqual([
			"flow/disconnected@lonely",
			"flow/disconnected@adhoc",
		])
	})

	it("no-duplicate-sequence-flows: same source, target and condition", () => {
		const xml = doc(`${LINEAR}${flow("dup", "a", "end")}`)
		expect(ids(withRule(xml, "no-duplicate-sequence-flows"))).toEqual([
			"flow/duplicate-sequence-flow@dup,a,end",
		])
	})

	it("no-implicit-split: two unconditional flows out of an activity", () => {
		const xml = doc(`${LINEAR}<bpmn:task id="b" name="B" />${flow("f3", "a", "b")}
		  <bpmn:task id="c" name="C" /><bpmn:task id="d" name="D" />${cond("f4", "c", "d")}${flow("f5", "c", "end")}`)
		expect(ids(withRule(xml, "no-implicit-split"))).toEqual(["flow/implicit-split@a"])
	})

	it("single-blank-start-event and single-event-definition", () => {
		const xml = doc(`${LINEAR}<bpmn:startEvent id="start2" />
		  <bpmn:intermediateCatchEvent id="multi"><bpmn:timerEventDefinition /><bpmn:messageEventDefinition /></bpmn:intermediateCatchEvent>`)
		expect(ids(withRule(xml, "single-blank-start-event"))).toEqual([
			"flow/multiple-blank-start-events@proc",
		])
		expect(ids(withRule(xml, "single-event-definition"))).toEqual([
			"flow/multiple-event-definitions@multi",
		])
	})

	it("superfluous-label: a label on a flow that carries no condition", () => {
		const xml = doc(`
		  <bpmn:startEvent id="start" />
		  <bpmn:exclusiveGateway id="gw" default="no" />
		  <bpmn:endEvent id="e1" /><bpmn:endEvent id="e2" />
		  ${flow("in", "start", "gw", ' name="go"')}
		  ${flow("no", "gw", "e1", ' name="No"')}
		  ${flow("yes", "gw", "e2", ' name="Yes"')}`)
		expect(ids(withRule(xml, "superfluous-label"))).toEqual(["naming/superfluous-flow-label@in"])
	})

	it("superfluous-termination: a terminate end that is the only end", () => {
		const terminate = `<bpmn:startEvent id="start" /><bpmn:endEvent id="end"><bpmn:terminateEventDefinition /></bpmn:endEvent>${flow("f", "start", "end")}`
		expect(ids(withRule(doc(terminate), "superfluous-termination"))).toEqual([
			"flow/superfluous-termination@end",
		])
		const withPlainEnd = `${terminate}<bpmn:endEvent id="plain" />${flow("g", "start", "plain")}`
		expect(withRule(doc(withPlainEnd), "superfluous-termination")).toEqual([])
	})

	describe("in every scope, with bpmnlint's exemptions", () => {
		// Also compared with real bpmnlint in tests/node/bpmnlint-parity.test.ts.
		const xml = readFileSync(
			fileURLToPath(new URL("fixtures/bpmnlint/scopes-and-exemptions.bpmn", import.meta.url)),
			"utf-8",
		)
		const elements = (rule: string) => withRule(xml, rule).flatMap((f) => f.elementIds)

		it("conditional-flows: an unconditional non-default flow beside a condition or default", () => {
			// gw_xor forks without conditions or a default flow, so its flows are fine.
			expect(ids(withRule(xml, "conditional-flows"))).toEqual([
				"feel/missing-condition@f_plain",
				"feel/missing-condition@f_x1_other",
				"feel/missing-condition@sf9",
			])
		})

		it("fake-join: sub-processes and start events (the rest is flow/multi-incoming-task)", () => {
			expect(ids(withRule(xml, "fake-join"))).toEqual([
				"flow/multi-incoming-task@start_joined",
				"flow/multi-incoming-task@sub_join_task",
			])
		})

		it("label-required: pools, lanes, events, blank names and conditional flows", () => {
			expect(elements("label-required")).toEqual([
				"pool",
				"blackbox",
				"lane_unnamed",
				"lane_child",
				"task_blank",
				"f_cond",
				"sub_start",
				"sub_catch",
				"tx_start",
				"tx_task",
				"evt_start",
				"adhoc_unnamed",
			])
		})

		it("no-gateway-join-fork and superfluous-gateway: gateways inside sub-processes", () => {
			expect(ids(withRule(xml, "no-gateway-join-fork"))).toEqual(["flow/mixed-gateway@sub_mixed"])
			expect(ids(withRule(xml, "superfluous-gateway"))).toEqual([
				"flow/redundant-gateway@sub_redundant",
			])
		})

		it("no-implicit-end: exempts end, link throw, compensation and ad-hoc and event sub-process elements", () => {
			// sub_comp is reported: bpmnlint looks for its association in the process, not in `sub`.
			expect(elements("no-implicit-end")).toEqual([
				"boundary_timer",
				"tx",
				"adhoc",
				"sub_dead",
				"sub_catch",
				"sub_comp",
				"tx_task",
				"evt_task",
			])
		})

		it("no-implicit-start: exempts start, boundary, link catch, compensation and ad-hoc and event sub-process elements", () => {
			expect(elements("no-implicit-start")).toEqual([
				"task_r1",
				"task_r2",
				"tx",
				"adhoc",
				"sub_orphan",
				"sub_catch",
			])
		})

		it("do not report data objects or data stores", () => {
			const all = [
				"conditional-flows",
				"fake-join",
				"label-required",
				"no-implicit-end",
				"no-implicit-start",
			].flatMap(elements)
			for (const id of ["data_obj", "data_ref", "store_ref"]) expect(all).not.toContain(id)
		})
	})

	const shape = (id: string, x: number, y: number, w: number, h: number, extra = "") =>
		`<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"${extra}><dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" /></bpmndi:BPMNShape>`
	const plane = (shapes: string) =>
		`<bpmndi:BPMNDiagram id="d"><bpmndi:BPMNPlane id="p" bpmnElement="proc">${shapes}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>`

	it("no-overlapping-elements: colliding shapes, boundary events excepted", () => {
		const xml = doc(
			`${LINEAR}<bpmn:boundaryEvent id="b" attachedToRef="a"><bpmn:timerEventDefinition /></bpmn:boundaryEvent>
			 <bpmn:subProcess id="sub"><bpmn:task id="inner" /></bpmn:subProcess>`,
			"",
			plane(
				shape("start", 0, 0, 36, 36) +
					shape("a", 20, 20, 100, 80) +
					shape("b", 60, 80, 36, 36) +
					shape("end", 400, 0, 36, 36) +
					shape("sub", 600, 0, 300, 200, ' isExpanded="true"') +
					shape("inner", 850, 150, 100, 80),
			),
		)
		expect(ids(withRule(xml, "no-overlapping-elements"))).toEqual([
			"pattern/overlapping-elements@start",
			"pattern/overlapping-elements@a",
			"pattern/overlapping-elements@inner",
		])
	})

	it("standard-size: bpmn-js default sizes, overridable per type", () => {
		const xml = doc(
			LINEAR,
			"",
			plane(
				shape("start", 0, 0, 36, 36) + shape("a", 100, 0, 120, 80) + shape("end", 300, 0, 40, 40),
			),
		)
		expect(ids(withRule(xml, "standard-size"))).toEqual([
			"pattern/non-standard-size@a",
			"pattern/non-standard-size@end",
		])
		expect(
			ids(withRule(xml, "standard-size", { "bpmn:Task": { width: 120, height: 80 } })),
		).toEqual(["pattern/non-standard-size@end"])
	})
})
