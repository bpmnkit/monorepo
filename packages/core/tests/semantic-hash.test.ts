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
		// The MIWG reference models, added 2026-09-24.
		"miwg-A.1.0.bpmn": "7bc850291c0de2be333df1c998390fd9775cbb0c87d81745c6e14b4055602e43",
		"miwg-A.2.0.bpmn": "c3cacd6461a92ec4fe3bd02f97bb1857ebecf05cb9cba56e2d61c62a32b17c5f",
		"miwg-A.2.1.bpmn": "8e05fa1392431e07edbfaf3a46868701e6657952583d4d5a66d93e223cdfa683",
		"miwg-A.3.0.bpmn": "bab63b30cddf2b073ad9e0dc094bda4cdb2b6b18cf0588dd630dac1fffcddb04",
		"miwg-A.4.0.bpmn": "c5f724742ac91350293cdb7355ff8c4bbc6e170917a2f341470ec8460b1c9ae5",
		"miwg-A.4.1.bpmn": "6ca0f0d8c13b3836d7d577718aed27e9742e2733eb3b833fe3cd57c35656c314",
		"miwg-B.1.0.bpmn": "b378b34cb33e2a68e3a625c18a6a549cfdd89196e7236d7b485bcf93abd58744",
		"miwg-B.2.0.bpmn": "c1418a51710aaf02f083ed4ead30070d77a096df33969cfcc57ddb1496e41c2c",
		"miwg-C.1.0.bpmn": "a52f7f51a9e3893f8435e540142bf4a3b7a48ba4e6c568cc66f7cfc900e240e8",
		"miwg-C.1.1.bpmn": "467e93ab9d4d82139e6dbb10b3721cd159d11980164e18cb091efb4580a05172",
		"miwg-C.10.0.bpmn": "5d2a74fdff19365fab27d9b7bc77353a4e97e186c47dfb2be8bfb63076cef6b8",
		"miwg-C.2.0.bpmn": "da6a098a2735faa49afa1f6a853ae322fc519c2017a4365d63ae304e1ad0716e",
		"miwg-C.3.0.bpmn": "f25abd3f86de7dbe52da6987a824403e2ac50fdc20adb1a21cbc9bf1753659af",
		"miwg-C.4.0.bpmn": "3496338d073c9b418c230272f6b333dc37b603443ecef2463eba8561723fdae2",
		"miwg-C.5.0.bpmn": "b7f1b6638ba56a0821d1230e5f2f5f995f589358851e0a94dd029198c003550f",
		"miwg-C.6.0.bpmn": "48db82c84648615e9b23061829c6ecb4bb5c9c17dd8ac3d1704f319b72dfa192",
		"miwg-C.7.0.bpmn": "2cfe7a07d6b4582e02cdb61c3fa22159cfdd736282b20afac7dade0c234538e1",
		"miwg-C.8.0.bpmn": "a48670976df5eb29344b305249b3615a55c7d02643e97480c0ad0ec8fcbb1ff5",
		"miwg-C.8.1.bpmn": "61c4c6f4ae291db36832fa5144457889c51a8f61ff350dd95851a46156b43856",
		"miwg-C.9.0.bpmn": "56a06e19b6e06095ca7e91368a02d1ef657f94184fb3df85a78dd7e88f9709c2",
		"miwg-C.9.1.bpmn": "ab5ccf901fbadf9c35c39be95460c81875663e338e08b35ebfc023c81e2731e2",
		"miwg-C.9.2.bpmn": "dc4f04f6ebe339bc4994e33120a025e8978a314a5371b13a323c0364f330c535",
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
