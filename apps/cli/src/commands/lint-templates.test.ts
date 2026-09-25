import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { checkFile } from "../dev/checks.js"
import { lintBpmn } from "./lint.js"

/**
 * `casen lint` checks a connector's required inputs against the templates the
 * diagram's own folder sees — `.camunda/element-templates/` from its folder up
 * to the project root — not against the bundled catalogue alone, and not
 * against a sibling folder's templates.
 */

const TEMPLATE_ID = "acme.Notify.v1"

function notifyTemplate(): unknown {
	return {
		$schema: "https://unpkg.com/@camunda/zeebe-element-templates-json-schema/resources/schema.json",
		id: TEMPLATE_ID,
		name: "Notify",
		appliesTo: ["bpmn:ServiceTask"],
		properties: [
			{
				type: "Hidden",
				value: "acme:notify:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				label: "Channel",
				type: "String",
				binding: { type: "zeebe:input", name: "channel" },
				constraints: { notEmpty: true },
			},
		],
	}
}

/** A Camunda 8 diagram whose one task is stamped with the template but binds nothing. */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  xmlns:modeler="http://camunda.org/schema/modeler/1.0" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="notify" name="Notify" zeebe:modelerTemplate="${TEMPLATE_ID}">
      <bpmn:extensionElements><zeebe:taskDefinition type="acme:notify:1" /></bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="End"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="notify" />
    <bpmn:sequenceFlow id="f2" sourceRef="notify" targetRef="end" />
  </bpmn:process>
</bpmn:definitions>`

let root: string

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "casen-lint-templates-"))
	const templates = join(root, "a", ".camunda", "element-templates")
	mkdirSync(templates, { recursive: true })
	writeFileSync(join(templates, "notify.json"), JSON.stringify(notifyTemplate()))
	mkdirSync(join(root, "b"))
	writeFileSync(join(root, "a", "order.bpmn"), XML)
	writeFileSync(join(root, "b", "invoice.bpmn"), XML)
})

afterAll(() => {
	rmSync(root, { recursive: true, force: true })
})

function missingRequired(findings: Array<{ id: string; message: string }>): string[] {
	return findings.filter((f) => f.id === "connector/missing-required").map((f) => f.message)
}

describe("lintBpmn element templates", () => {
	it("checks a diagram against the templates beside it", async () => {
		const { findings } = await lintBpmn(join(root, "a", "order.bpmn"), XML, {
			templateRoot: root,
			bpmnlintrc: false,
		})
		expect(missingRequired(findings)).toEqual([expect.stringContaining('"channel"')])
	})

	it("does not apply a sibling folder's templates", async () => {
		const { findings } = await lintBpmn(join(root, "b", "invoice.bpmn"), XML, {
			templateRoot: root,
			bpmnlintrc: false,
		})
		expect(missingRequired(findings)).toEqual([])
	})
})

describe("casen dev checks", () => {
	it("resolve templates up to the served project's root, not the cwd", async () => {
		const project = mkdtempSync(join(tmpdir(), "casen-dev-templates-"))
		try {
			const templates = join(project, ".camunda", "element-templates")
			mkdirSync(templates, { recursive: true })
			writeFileSync(join(templates, "notify.json"), JSON.stringify(notifyTemplate()))
			mkdirSync(join(project, "sub"))
			writeFileSync(join(project, "sub", "order.bpmn"), XML)

			const result = await checkFile(
				join(project, "sub", "order.bpmn"),
				"sub/order.bpmn",
				"bpmn",
				"ts",
			)
			const connector = (result.lint?.findings ?? []).filter((f) => f.category === "connector")
			expect(connector.map((f) => f.message)).toEqual([expect.stringContaining('"channel"')])
		} finally {
			rmSync(project, { recursive: true, force: true })
		}
	})
})
