import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import { Bpmn } from "../src/bpmn/index.js"
import { diffSemantics, projectSemantics, semanticHash } from "../src/bpmn/semantic-hash.js"

const fixtureDirectory = join(import.meta.dirname, "fixtures", "roundtrip")

function fixtures(): string[] {
	return readdirSync(fixtureDirectory)
		.filter((name) => name.endsWith(".bpmn"))
		.sort()
}

function parseFixture(name: string) {
	return Bpmn.parse(readFileSync(join(fixtureDirectory, name), "utf-8"))
}

const MINIMAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:outgoing>F</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F" sourceRef="S" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`

describe("semanticHash", () => {
	it("is a sha-256 hex digest", () => {
		expect(semanticHash(Bpmn.parse(MINIMAL))).toMatch(/^[0-9a-f]{64}$/)
	})

	it("is unchanged by auto-layout", () => {
		// The assertion the module exists for: a layout pass moves the picture and
		// must not be able to touch the model.
		for (const name of fixtures()) {
			const definitions = parseFixture(name)
			const before = semanticHash(definitions)
			expect(semanticHash(applyAutoLayout(definitions)), name).toBe(before)
		}
	})

	it("is unchanged by a serialise/parse round trip", () => {
		for (const name of fixtures()) {
			const definitions = parseFixture(name)
			const reparsed = Bpmn.parse(Bpmn.export(definitions))
			expect(semanticHash(reparsed), name).toBe(semanticHash(definitions))
		}
	})

	it("ignores the exporter that wrote the file", () => {
		const definitions = Bpmn.parse(MINIMAL)
		const branded = Bpmn.parse(MINIMAL)
		branded.exporter = "Some Modeler"
		branded.exporterVersion = "9.9.9"
		expect(semanticHash(branded)).toBe(semanticHash(definitions))
	})

	it("ignores a modeler template icon", () => {
		const withIcon = Bpmn.parse(MINIMAL)
		const task = withIcon.processes[0]?.flowElements[0]
		expect(task).toBeDefined()
		if (task) task.unknownAttributes["zeebe:modelerTemplateIcon"] = "data:image/svg+xml;base64,AAAA"
		expect(semanticHash(withIcon)).toBe(semanticHash(Bpmn.parse(MINIMAL)))
	})

	it("ignores the order elements are declared in", () => {
		const definitions = Bpmn.parse(MINIMAL)
		const shuffled = Bpmn.parse(MINIMAL)
		const process = shuffled.processes[0]
		expect(process).toBeDefined()
		if (process) process.flowElements.reverse()
		expect(semanticHash(shuffled)).toBe(semanticHash(definitions))
	})

	it("changes when a name changes", () => {
		const definitions = Bpmn.parse(MINIMAL)
		const renamed = Bpmn.parse(MINIMAL)
		const task = renamed.processes[0]?.flowElements[0]
		if (task) task.name = "Renamed"
		expect(semanticHash(renamed)).not.toBe(semanticHash(definitions))
	})

	it("changes when a Zeebe extension changes", () => {
		const changed = Bpmn.parse(MINIMAL)
		const process = changed.processes[0]
		if (process) {
			process.extensionElements.push({
				name: "zeebe:versionTag",
				attributes: { value: "v2" },
				children: [],
			})
		}
		expect(semanticHash(changed)).not.toBe(semanticHash(Bpmn.parse(MINIMAL)))
	})

	it("keeps the execution platform, which names the target engine", () => {
		const retargeted = Bpmn.parse(MINIMAL)
		retargeted.unknownAttributes["modeler:executionPlatformVersion"] = "8.7.0"
		expect(semanticHash(retargeted)).not.toBe(semanticHash(Bpmn.parse(MINIMAL)))
	})

	it("gives every fixture a distinct hash", () => {
		const hashes = fixtures().map((name) => semanticHash(parseFixture(name)))
		expect(new Set(hashes).size).toBe(hashes.length)
	})

	/**
	 * The invariance tests above are relative — they compare two hashes that
	 * would move together if the projection rules changed. These are absolute,
	 * so quietly dropping a field from the projection fails here.
	 *
	 * Regenerating a value is a reviewed change: it means either a fixture or
	 * what counts as semantics has changed, and one of those should be in the
	 * commit message.
	 */
	const GOLDEN: Record<string, string> = {
		"01-root-elements.bpmn": "cb299a10ca6a31810963b5bb48a5ddbf0ebdfdd3ab9e0756d881de3d6e72a097",
		"02-collaboration.bpmn": "031ce680fad40fc8befb3d9ff13ca031c24c97a323173410feeb8ba2c5340e1e",
		"03-data-elements.bpmn": "4f9e9d0fbd41a55fc260641b2f253b1cddfcd59f4c8529e8cc321ca893c78222",
		"04-artifacts.bpmn": "dc1506d309f7ca7f5dcca3f0efb84d3b00f1bfc2064768bcf83b3633701013b3",
		"05-zeebe-extensions.bpmn": "cc7d33a3c0a5dda3cd7e086689f4e1f8e4132855870181ab066a99845e407aa6",
		"06-events-and-containers.bpmn":
			"89c79344d77e365cabe3d0e257ae8074880e3cf292d3a790dc5a0389ab74177f",
		"07-unmodelled-content.bpmn":
			"950b8ea3610bcce9f8d25162eddc0f5ad2648a884d1a28c3cb2d51bf0af2797e",
	}

	it("has a golden hash for every fixture", () => {
		expect(fixtures().filter((name) => GOLDEN[name] === undefined)).toEqual([])
	})

	it("matches the golden hashes", () => {
		for (const name of fixtures()) {
			expect(semanticHash(parseFixture(name)), name).toBe(GOLDEN[name])
		}
	})
})

/**
 * A hash is only useful if it separates models that differ and joins models that
 * do not. These are the pairs a careless projection gets wrong: sorting arrays
 * without keeping each entry's own content distinct collides the first three,
 * and comparing raw serialised text splits the last three.
 */
describe("semanticHash discrimination", () => {
	const wrap = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="D" targetNamespace="x">
<bpmn:process id="P" isExecutable="true">${body}</bpmn:process></bpmn:definitions>`
	const hash = (body: string) => semanticHash(Bpmn.parse(wrap(body)))

	const differs: Array<[string, string, string]> = [
		[
			"two tasks swapping names",
			'<bpmn:task id="A" name="one"/><bpmn:task id="B" name="two"/>',
			'<bpmn:task id="A" name="two"/><bpmn:task id="B" name="one"/>',
		],
		[
			"a sequence flow rewired",
			'<bpmn:task id="A"/><bpmn:task id="B"/><bpmn:sequenceFlow id="F" sourceRef="A" targetRef="B"/>',
			'<bpmn:task id="A"/><bpmn:task id="B"/><bpmn:sequenceFlow id="F" sourceRef="B" targetRef="A"/>',
		],
		["an element type", '<bpmn:task id="A"/>', '<bpmn:userTask id="A"/>'],
		[
			"a nested ioMapping source",
			'<bpmn:serviceTask id="T"><bpmn:extensionElements><zeebe:ioMapping><zeebe:input source="=a" target="x"/></zeebe:ioMapping></bpmn:extensionElements></bpmn:serviceTask>',
			'<bpmn:serviceTask id="T"><bpmn:extensionElements><zeebe:ioMapping><zeebe:input source="=b" target="x"/></zeebe:ioMapping></bpmn:extensionElements></bpmn:serviceTask>',
		],
		[
			"a gateway default flow",
			'<bpmn:exclusiveGateway id="G" default="F1"/>',
			'<bpmn:exclusiveGateway id="G" default="F2"/>',
		],
		[
			"a condition expression",
			'<bpmn:sequenceFlow id="F" sourceRef="A" targetRef="B"><bpmn:conditionExpression>=x</bpmn:conditionExpression></bpmn:sequenceFlow>',
			'<bpmn:sequenceFlow id="F" sourceRef="A" targetRef="B"><bpmn:conditionExpression>=y</bpmn:conditionExpression></bpmn:sequenceFlow>',
		],
	]

	for (const [label, left, right] of differs) {
		it(`separates models differing by ${label}`, () => {
			expect(hash(left)).not.toBe(hash(right))
		})
	}

	const matches: Array<[string, string, string]> = [
		[
			"declaration order",
			'<bpmn:task id="A" name="one"/><bpmn:task id="B" name="two"/>',
			'<bpmn:task id="B" name="two"/><bpmn:task id="A" name="one"/>',
		],
		[
			"attribute order",
			'<bpmn:task id="A" name="one" isForCompensation="true"/>',
			'<bpmn:task id="A" isForCompensation="true" name="one"/>',
		],
		[
			"task header order",
			'<bpmn:serviceTask id="T"><bpmn:extensionElements><zeebe:taskHeaders><zeebe:header key="a" value="1"/><zeebe:header key="b" value="2"/></zeebe:taskHeaders></bpmn:extensionElements></bpmn:serviceTask>',
			'<bpmn:serviceTask id="T"><bpmn:extensionElements><zeebe:taskHeaders><zeebe:header key="b" value="2"/><zeebe:header key="a" value="1"/></zeebe:taskHeaders></bpmn:extensionElements></bpmn:serviceTask>',
		],
	]

	for (const [label, left, right] of matches) {
		it(`joins models differing only by ${label}`, () => {
			expect(hash(left)).toBe(hash(right))
		})
	}
})

describe("projectSemantics", () => {
	it("drops diagram interchange from the projection", () => {
		const projected = JSON.stringify(
			projectSemantics(parseFixture("06-events-and-containers.bpmn")),
		)
		expect(projected).not.toContain("BPMNShape")
		expect(projected).not.toContain("waypoint")
		expect(projected).toContain("Sub_work")
	})

	it("indexes every element that carries an id", () => {
		const { elements } = projectSemantics(Bpmn.parse(MINIMAL))
		expect([...elements.keys()].sort()).toEqual(["D", "E", "F", "P", "S"])
	})

	it("projects an element without inlining its id-bearing children", () => {
		const { elements } = projectSemantics(Bpmn.parse(MINIMAL))
		const process = JSON.stringify(elements.get("P"))
		// The process names its children rather than embedding them, so a change
		// inside a task is not reported as a change to the process too.
		expect(process).toContain('"S"')
		expect(process).not.toContain("sourceRef")
	})
})

describe("diffSemantics", () => {
	it("reports nothing for an unchanged model", () => {
		expect(diffSemantics(Bpmn.parse(MINIMAL), Bpmn.parse(MINIMAL))).toEqual({
			added: [],
			removed: [],
			changed: [],
		})
	})

	it("attributes a change to the element that changed, not its ancestors", () => {
		const after = Bpmn.parse(MINIMAL)
		const event = after.processes[0]?.flowElements[0]
		if (event) event.name = "Kicked off"

		const diff = diffSemantics(Bpmn.parse(MINIMAL), after)
		expect(diff.added).toEqual([])
		expect(diff.removed).toEqual([])
		expect(diff.changed.map((entry) => entry.id)).toEqual(["S"])
	})

	it("reports an added and a removed element", () => {
		const after = Bpmn.parse(MINIMAL)
		const process = after.processes[0]
		if (process) {
			process.flowElements = process.flowElements.filter((element) => element.id !== "E")
			process.flowElements.push({
				type: "endEvent",
				id: "E2",
				incoming: [],
				outgoing: [],
				extensionElements: [],
				unknownAttributes: {},
				eventDefinitions: [],
			})
		}

		const diff = diffSemantics(Bpmn.parse(MINIMAL), after)
		expect(diff.added).toEqual(["E2"])
		expect(diff.removed).toEqual(["E"])
	})

	it("reports nothing after auto-layout", () => {
		const definitions = parseFixture("06-events-and-containers.bpmn")
		const laidOut = applyAutoLayout(parseFixture("06-events-and-containers.bpmn"))
		expect(diffSemantics(definitions, laidOut)).toEqual({ added: [], removed: [], changed: [] })
	})
})
