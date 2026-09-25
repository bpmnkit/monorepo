import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
	Bpmn,
	CAMUNDA_COMPAT_RULES,
	CAMUNDA_COMPAT_VERSIONS,
	analyzeCamundaCompat,
	lintDiagram,
	normalizeCamundaVersion,
	optimize,
	parseBpmnlintConfig,
	resolveBpmnlintConfig,
	splitCamundaCompatConfig,
} from "../src/index.js"
import type { OptimizationFinding } from "../src/index.js"

const FIXTURES = join(import.meta.dirname, "fixtures", "camunda-compat")
const FIXTURE_FILES = ["events.bpmn", "tasks.bpmn", "contents.bpmn", "agents.bpmn"]

/** `version: null` leaves the platform attributes out. */
function model(body: string, version: string | null = "8.6.0", head = ""): string {
	const platform =
		version === null
			? ""
			: ` modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="${version}"`
	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" id="D" targetNamespace="http://bpmn.io/schema/bpmn"${platform}>
${head}  <bpmn:process id="p" isExecutable="true">
${body}
  </bpmn:process>
</bpmn:definitions>`
}

function compat(xml: string, version?: string): OptimizationFinding[] {
	return analyzeCamundaCompat(Bpmn.parse(xml), version)
}

function rules(findings: readonly OptimizationFinding[]): string[] {
	return findings.map((f) => `${f.id} ${f.elementIds[0]}`)
}

const AD_HOC = `    <bpmn:adHocSubProcess id="tools" name="Tools">
      <bpmn:serviceTask id="tool"><bpmn:extensionElements><zeebe:taskDefinition type="t" /></bpmn:extensionElements></bpmn:serviceTask>
    </bpmn:adHocSubProcess>`

describe("analyzeCamundaCompat — version gating", () => {
	it("rejects an ad-hoc sub-process before 8.7 and accepts it from 8.7", () => {
		const [finding, ...rest] = compat(model(AD_HOC), "8.6")
		expect(rest).toEqual([])
		expect(finding).toMatchObject({
			id: "compat/element-type",
			category: "deploy",
			severity: "error",
			elementIds: ["tools"],
			message:
				'Ad-hoc sub-process "Tools" needs Camunda 8.7 or newer; this model targets Camunda 8.6.',
		})
		expect(compat(model(AD_HOC), "8.7")).toEqual([])
	})

	it("reads the target from modeler:executionPlatformVersion", () => {
		expect(rules(compat(model(AD_HOC, "8.6.3")))).toEqual(["compat/element-type tools"])
		expect(compat(model(AD_HOC, "8.8.0"))).toEqual([])
	})

	it("gates event definitions separately from the event", () => {
		const signalEnd = `    <bpmn:signal id="s" name="go" />\n`
		const body = `    <bpmn:endEvent id="end"><bpmn:signalEventDefinition id="sd" signalRef="s" /></bpmn:endEvent>`
		// bpmn:signal is a root element, so it goes before the process.
		const xml = model(body, "8.2.0", signalEnd)
		expect(compat(xml)[0]?.message).toBe(
			'Signal end event "end" needs Camunda 8.3 or newer; this model targets Camunda 8.2.',
		)
		expect(compat(xml, "8.3")).toEqual([])
	})

	it("reports elements no Camunda 8 version runs", () => {
		const [finding] = compat(model(`    <bpmn:complexGateway id="g" />`), "8.10")
		expect(finding?.message).toBe('Complex gateway "g" is not supported by any Camunda 8 version.')
	})

	it("gates Zeebe extensions and properties by version", () => {
		const body = `    <bpmn:userTask id="u">
      <bpmn:extensionElements>
        <zeebe:userTask />
        <zeebe:formDefinition formId="f" />
        <zeebe:priorityDefinition priority="50" />
      </bpmn:extensionElements>
    </bpmn:userTask>`
		expect(rules(compat(model(body), "8.4"))).toEqual([
			"compat/no-zeebe-user-task u",
			"compat/no-priority-definition u",
		])
		expect(rules(compat(model(body), "8.5"))).toEqual(["compat/no-priority-definition u"])
		expect(compat(model(body), "8.6")).toEqual([])
	})

	it("allows a cron timer cycle from 8.1", () => {
		const body = `    <bpmn:startEvent id="s"><bpmn:timerEventDefinition id="t"><bpmn:timeCycle>0 0 9 * * MON</bpmn:timeCycle></bpmn:timerEventDefinition></bpmn:startEvent>`
		expect(compat(model(body), "8.0")[0]?.message).toContain(
			"cron expression, which needs Camunda 8.1",
		)
		expect(compat(model(body), "8.1")).toEqual([])
	})

	it("skips a non-executable process from 8.2, as Modeler does", () => {
		const xml = model(`    <bpmn:complexGateway id="g" />`).replace(
			'isExecutable="true"',
			'isExecutable="false"',
		)
		expect(compat(xml, "8.1")).toHaveLength(1)
		expect(compat(xml, "8.2")).toEqual([])
	})
})

describe("analyzeCamundaCompat — required properties", () => {
	it("reports a timer with no value, and one that does not parse", () => {
		const body = `    <bpmn:intermediateCatchEvent id="a"><bpmn:timerEventDefinition id="t1" /></bpmn:intermediateCatchEvent>
    <bpmn:intermediateCatchEvent id="b"><bpmn:timerEventDefinition id="t2"><bpmn:timeDuration>5 minutes</bpmn:timeDuration></bpmn:timerEventDefinition></bpmn:intermediateCatchEvent>`
		const [none, bad] = compat(model(body))
		expect(none?.message).toBe(
			'Timer intermediate catch event "a" has no timer value; set one of timeDate, timeDuration.',
		)
		expect(bad?.message).toBe(
			'Timer intermediate catch event "b" has timeDuration "5 minutes", which is not an ISO 8601 duration (PT15M).',
		)
	})

	it("reports missing error codes, message names and signal names", () => {
		const head = `  <bpmn:error id="err" name="Failed" />
  <bpmn:message id="msg" />
  <bpmn:signal id="sig" />
`
		const body = `    <bpmn:endEvent id="fail"><bpmn:errorEventDefinition id="e" errorRef="err" /></bpmn:endEvent>
    <bpmn:receiveTask id="wait" messageRef="msg" />
    <bpmn:intermediateThrowEvent id="shout"><bpmn:signalEventDefinition id="s" signalRef="sig" /></bpmn:intermediateThrowEvent>`
		expect(compat(model(body, "8.6.0", head)).map((f) => f.message)).toEqual([
			'Error end event "fail" references error "Failed", which has no error code.',
			'Receive task "wait" references message "msg", which has no name.',
			'Message "msg" used by Receive task "wait" has no zeebe:subscription.',
			'Signal intermediate throw event "shout" references signal "sig", which has no name.',
		])
	})

	it("requires a script task's implementation, and the properties of the one it has", () => {
		const body = `    <bpmn:scriptTask id="none" />
    <bpmn:scriptTask id="half"><bpmn:extensionElements><zeebe:script expression="=1" /></bpmn:extensionElements></bpmn:scriptTask>`
		expect(compat(model(body)).map((f) => f.message)).toEqual([
			'Script task "none" has no implementation; Camunda needs a zeebe:script or zeebe:taskDefinition.',
			'Script task "half" has a zeebe:script with no resultVariable.',
		])
		// Before 8.2 a script task could only be a job worker.
		expect(compat(model(body), "8.1").map((f) => f.message)).toEqual([
			'Script task "none" has no implementation; Camunda needs a zeebe:taskDefinition.',
			'Script task "half" has a zeebe:script, which needs Camunda 8.2 or newer here; this model targets Camunda 8.1.',
		])
	})

	it("reports nothing on a model that targets no Camunda 8 version", () => {
		expect(compat(model(`    <bpmn:complexGateway id="g" />`, null))).toEqual([])
	})
})

describe("analyzeCamundaCompat — expressions, secrets and links", () => {
	const task = (inputs: string) => `    <bpmn:serviceTask id="svc">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="t" />
        <zeebe:ioMapping>${inputs}</zeebe:ioMapping>
      </bpmn:extensionElements>
    </bpmn:serviceTask>`

	it("reports a FEEL built-in newer than the target, unless a local name shadows it", () => {
		const body = task(`<zeebe:input source="=uuid()" target="id" />`)
		expect(compat(model(body), "8.5").map((f) => [f.id, f.message])).toEqual([
			["compat/feel-compatibility", "FEEL function <uuid> requires Camunda >=8.6"],
		])
		expect(compat(model(body), "8.6")).toEqual([])
		const shadowed = task(`<zeebe:input source="={uuid: function() 1, id: uuid()}" target="id" />`)
		expect(compat(model(shadowed), "8.5")).toEqual([])
	})

	it("accepts {{secrets.X}} until camunda.secrets.X exists, then calls it legacy", () => {
		const body = task(`<zeebe:input source="{{secrets.TOKEN}}" target="token" />`)
		expect(compat(model(body), "8.9")).toEqual([])
		expect(compat(model(body), "8.10").map((f) => [f.id, f.severity, f.message])).toEqual([
			["compat/secrets", "warning", "Property <source> uses legacy secret expression format"],
		])
	})

	it("leaves an unnamed link event to bpmnlint's link-event when that rule runs", () => {
		const xml = model(
			`    <bpmn:intermediateThrowEvent id="go"><bpmn:linkEventDefinition id="l" /></bpmn:intermediateThrowEvent>`,
		)
		const ids = (rc: unknown) =>
			lintDiagram(Bpmn.parse(xml), {
				bpmnlint: resolveBpmnlintConfig(parseBpmnlintConfig(JSON.stringify(rc))),
			})
				.diagnostics.filter((d) => d.elementIds[0] === "go")
				.map((d) => d.id)
		const extend = "plugin:camunda-compat/camunda-cloud-8-6"
		expect(ids({ extends: extend })).toContain("compat/link-event")
		const both = ids({ extends: extend, rules: { "link-event": "error" } })
		expect(both).toContain("flow/link-event-mismatch")
		expect(both).not.toContain("compat/link-event")
	})
})

describe("normalizeCamundaVersion", () => {
	it("reduces a patch version to the table's major.minor", () => {
		expect(normalizeCamundaVersion("8.6.2")).toBe("8.6")
		expect(normalizeCamundaVersion("8.10.0")).toBe("8.10")
		expect(normalizeCamundaVersion("1.3.0")).toBe("1.3")
	})

	it("checks a Camunda 8 version newer than the table as the newest it knows", () => {
		expect(normalizeCamundaVersion("8.12.0")).toBe(CAMUNDA_COMPAT_VERSIONS.at(-1))
	})

	it("rejects anything else", () => {
		expect(normalizeCamundaVersion("7.20.0")).toBeUndefined()
		expect(normalizeCamundaVersion("latest")).toBeUndefined()
		expect(normalizeCamundaVersion(undefined)).toBeUndefined()
	})
})

describe("optimize — compat findings", () => {
	it("runs by default and leaves problems deploy already reports to deploy", () => {
		const body = `    <bpmn:serviceTask id="svc" />
    <bpmn:complexGateway id="g" />`
		const { findings } = optimize(Bpmn.parse(model(body)))
		expect(findings.filter((f) => f.elementIds[0] === "svc").map((f) => f.id)).toContain(
			"deploy/service-task-no-type",
		)
		expect(findings.map((f) => f.id)).not.toContain("compat/implementation")
		expect(findings.map((f) => f.id)).toContain("compat/element-type")
		// With the other categories off, a pinned version runs compat alone, and it
		// reports the missing job type itself.
		const alone = optimize(Bpmn.parse(model(body)), {
			categories: [],
			camundaVersion: "8.8",
		}).findings
		expect(rules(alone)).toEqual(["compat/implementation svc", "compat/element-type g"])
	})

	it("takes the target version from options", () => {
		const alone = optimize(Bpmn.parse(model(AD_HOC, "8.8.0")), {
			categories: [],
			camundaVersion: "8.6",
		})
		expect(rules(alone.findings)).toEqual(["compat/element-type tools"])
	})
})

describe(".bpmnlintrc — plugin:camunda-compat", () => {
	const resolved = (config: unknown) =>
		resolveBpmnlintConfig(parseBpmnlintConfig(JSON.stringify(config)))

	it("maps each camunda-cloud-X-Y config onto the compat check at that version", () => {
		for (const version of CAMUNDA_COMPAT_VERSIONS) {
			const name = `camunda-cloud-${version.replace(".", "-")}`
			for (const plugin of ["camunda-compat", "bpmnlint-plugin-camunda-compat"]) {
				const { compat: split, rest } = splitCamundaCompatConfig(
					resolved({ extends: ["bpmnlint:recommended", `plugin:${plugin}/${name}`] }),
				)
				expect(split?.version).toBe(version)
				expect(rest.unresolvedExtends).toEqual([])
			}
		}
	})

	it("enables the config's rules at the plugin's severities, and start-event-required", () => {
		const { compat: split, rest } = splitCamundaCompatConfig(
			resolved({ extends: "plugin:camunda-compat/camunda-cloud-8-6" }),
		)
		expect(split?.rules["zeebe-user-task"]).toEqual({ severity: "warn" })
		expect(split?.rules["no-version-tag"]).toBeUndefined()
		expect(split?.rules["ad-hoc-sub-process"]).toBeUndefined()
		expect(rest.rules["start-event-required"]).toEqual({ severity: "error" })
	})

	it("leaves configs it cannot stand in for unresolved", () => {
		const { compat: split, rest } = splitCamundaCompatConfig(
			resolved({ extends: ["plugin:camunda-compat/camunda-platform-7-22", "plugin:acme/all"] }),
		)
		expect(split).toBeUndefined()
		expect(rest.unresolvedExtends).toEqual([
			"plugin:camunda-compat/camunda-platform-7-22",
			"plugin:acme/all",
		])
	})

	it("pins the target, re-levels and names findings, and lists what it cannot run", () => {
		const bpmnlint = resolved({
			extends: "plugin:camunda-compat/camunda-cloud-8-6",
			rules: {
				"camunda-compat/element-type": "warn",
				"camunda-compat/user-task-definition": "off",
				"camunda-compat/no-such-rule": "error",
			},
		})
		const xml = model(
			`${AD_HOC}\n    <bpmn:userTask id="u"><bpmn:extensionElements><zeebe:userTask /></bpmn:extensionElements></bpmn:userTask>`,
			"8.8.0",
		)
		const report = lintDiagram(Bpmn.parse(xml), { bpmnlint })
		const found = report.diagnostics.filter((d) => d.id.startsWith("compat/"))
		expect(found.map((d) => [d.id, d.severity, d.bpmnlintRule])).toEqual([
			["compat/element-type", "warning", "camunda-compat/element-type"],
		])
		const unsupported = (report.bpmnlintUnsupported ?? []).map((u) => u.name)
		expect(unsupported).toEqual(["camunda-compat/no-such-rule"])
		expect(unsupported).not.toContain("plugin:camunda-compat/camunda-cloud-8-6")
		expect(unsupported).not.toContain("camunda-compat/element-type")
	})

	it("applies to a model that names no platform", () => {
		const bpmnlint = resolved({ extends: "plugin:camunda-compat/camunda-cloud-8-6" })
		const report = lintDiagram(Bpmn.parse(model(AD_HOC, null)), { bpmnlint })
		// The engine categories stay off on a platform-less model; only the pinned
		// compatibility check runs.
		expect(report.categories).not.toContain("deploy")
		const ids = report.diagnostics.map((d) => d.id)
		expect(ids).toContain("compat/element-type")
		expect(ids.filter((id) => id.startsWith("deploy/"))).toEqual([])
	})

	it("steps aside when the project's bpmnlint ran the plugin itself", () => {
		const bpmnlint = resolved({ extends: "plugin:camunda-compat/camunda-cloud-8-6" })
		const report = lintDiagram(Bpmn.parse(model(AD_HOC)), { bpmnlint, bpmnlintDelegated: true })
		expect(report.diagnostics.filter((d) => d.id.startsWith("compat/"))).toEqual([])
	})
})

// ── Against the real plugin ─────────────────────────────────────────────────

/** Rules `analyzeCamundaCompat` reports itself. */
const IMPLEMENTED = new Set(
	Object.entries(CAMUNDA_COMPAT_RULES)
		.filter(([, rule]) => rule.coverage === "implemented" || rule.coverage === "partial")
		.map(([name]) => name),
)

/** The rules that keep the plugin's messages word for word. */
const NEW_RULES = new Set([
	"agent-fromai-contract",
	"agent-tool-output-key",
	"connector-properties",
	"duplicate-execution-listener-headers",
	"feel-compatibility",
	"link-event",
	"no-loop",
	"secrets",
	"unresolvable-secret-reference",
	"variable-name",
])

/** `rule elementId` → the sorted messages, for the rules in NEW_RULES. */
function messages(findings: readonly OptimizationFinding[]): Record<string, string[]> {
	const byKey: Record<string, string[]> = {}
	for (const f of findings) {
		const rule = f.id.slice("compat/".length)
		if (!NEW_RULES.has(rule)) continue
		const key = `${rule} ${f.elementIds[0]}`
		byKey[key] = [...(byKey[key] ?? []), f.message].sort()
	}
	return Object.fromEntries(
		Object.keys(byKey)
			.sort()
			.map((k) => [k, byKey[k] as string[]]),
	)
}

/** `rule elementId severity`, once each — the plugin can report one element twice under a rule. */
function keyed(findings: readonly OptimizationFinding[]): string[] {
	const keys = findings.map(
		(f) =>
			`${f.id.slice("compat/".length)} ${f.elementIds[0]} ${f.severity === "warning" ? "warn" : f.severity}`,
	)
	return [...new Set(keys)].sort()
}

describe("matches bpmnlint-plugin-camunda-compat on the fixtures", () => {
	// Recorded by running the real plugin outside this repo: in a scratch directory,
	// `npm install bpmnlint@11.14.0 bpmnlint-plugin-camunda-compat@2.61.0 bpmn-moddle
	// zeebe-bpmn-moddle modeler-moddle`, then for each fixture and each
	// camunda-cloud-X-Y config, read the file with BpmnModdle({ zeebe, modeler }) and
	// run `new Linter({ config: { extends: "plugin:camunda-compat/camunda-cloud-X-Y" } })`
	// on it — the same calls as "matches the installed plugin" below. Each report is
	// stored as `rule elementId category`; for the rules whose wording BPMN Kit keeps
	// (NEW_RULES), the messages too. Re-record when the fixtures or the plugin change.
	const expected = JSON.parse(readFileSync(join(FIXTURES, "expected.json"), "utf8")) as {
		reports: Record<string, Record<string, string[]>>
		messages: Record<string, Record<string, Record<string, string[]>>>
	}

	for (const [version, files] of Object.entries(expected.reports)) {
		it(`camunda-cloud-${version}`, () => {
			for (const file of FIXTURE_FILES) {
				const defs = Bpmn.parse(readFileSync(join(FIXTURES, file), "utf8"))
				const want = (files[file] ?? []).filter((k) => IMPLEMENTED.has(k.split(" ")[0] as string))
				const found = analyzeCamundaCompat(defs, version)
				expect({ file, reports: keyed(found) }).toEqual({ file, reports: [...want].sort() })
				expect({ file, messages: messages(found) }).toEqual({
					file,
					messages: expected.messages[version]?.[file] ?? {},
				})
			}
		})
	}
})

/**
 * Side by side with the plugin itself, when a directory holding
 * `bpmnlint-plugin-camunda-compat`, `bpmnlint`, `bpmn-moddle`,
 * `zeebe-bpmn-moddle` and `modeler-moddle` in its `node_modules` is named by
 * `BPMNKIT_CAMUNDA_COMPAT_MODULES`. They are not dependencies of this repo.
 */
const MODULES = process.env.BPMNKIT_CAMUNDA_COMPAT_MODULES
describe.skipIf(MODULES === undefined)("matches the installed plugin", () => {
	it("enables the same rules, at the same severities, in every config", () => {
		const require = createRequire(join(MODULES as string, "package.json"))
		const plugin = require("bpmnlint-plugin-camunda-compat") as {
			rules: Record<string, string>
			configs: Record<string, { rules: Record<string, [string, unknown]> }>
		}
		const names = Object.keys(plugin.rules).filter(
			(n) => n !== "history-time-to-live" && !n.startsWith("bpmnlint/"),
		)
		expect(Object.keys(CAMUNDA_COMPAT_RULES).sort()).toEqual(names.sort())
		for (const version of CAMUNDA_COMPAT_VERSIONS) {
			const config = plugin.configs[`camunda-cloud-${version.replace(".", "-")}`]?.rules ?? {}
			const theirs = Object.fromEntries(
				Object.entries(config)
					.filter(([n]) => !n.startsWith("bpmnlint/"))
					.map(([n, [severity]]) => [n, severity]),
			)
			const bpmnlint = resolveBpmnlintConfig({
				extends: `plugin:camunda-compat/camunda-cloud-${version.replace(".", "-")}`,
			})
			const ours = Object.fromEntries(
				Object.entries(splitCamundaCompatConfig(bpmnlint).compat?.rules ?? {}).map(([n, s]) => [
					n,
					s.severity,
				]),
			)
			expect({ version, rules: ours }).toEqual({ version, rules: theirs })
		}
	})

	it("on every fixture and version", async () => {
		const require = createRequire(join(MODULES as string, "package.json"))
		const { BpmnModdle } = require("bpmn-moddle")
		const { Linter } = require("bpmnlint")
		const NodeResolver = require("bpmnlint/lib/resolver/node-resolver")
		const zeebe = require("zeebe-bpmn-moddle/resources/zeebe.json")
		const modeler = require("modeler-moddle/resources/modeler.json")

		for (const file of FIXTURE_FILES) {
			const xml = readFileSync(join(FIXTURES, file), "utf8")
			for (const version of CAMUNDA_COMPAT_VERSIONS) {
				const { rootElement } = await new BpmnModdle({ zeebe, modeler }).fromXML(xml)
				const linter = new Linter({
					config: { extends: `plugin:camunda-compat/camunda-cloud-${version.replace(".", "-")}` },
					resolver: new NodeResolver({ require }),
				})
				const reports = (await linter.lint(rootElement)) as Record<
					string,
					{ id: string; category: string }[]
				>
				const want = Object.entries(reports)
					.map(([rule, list]) => [rule.replace("camunda-compat/", ""), list] as const)
					.filter(([rule]) => IMPLEMENTED.has(rule))
					.flatMap(([rule, list]) => list.map((r) => `${rule} ${r.id} ${r.category}`))
				const unique = [...new Set(want)].sort()
				expect({
					file,
					version,
					reports: keyed(analyzeCamundaCompat(Bpmn.parse(xml), version)),
				}).toEqual({
					file,
					version,
					reports: unique,
				})
			}
		}
	})
})
