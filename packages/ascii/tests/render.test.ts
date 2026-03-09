import { Bpmn, SAMPLE_BPMN_XML } from "@bpmn-sdk/core"
import { describe, expect, it } from "vitest"
import { renderBpmnAscii } from "../src/index.js"

// ── Helpers ─────────────────────────────────────────────────────────────────

function xml(builder: ReturnType<typeof Bpmn.createProcess>): string {
	return Bpmn.export(builder.withAutoLayout().build())
}

// ── Grid ────────────────────────────────────────────────────────────────────

import { AsciiGrid } from "../src/grid.js"
import { truncate } from "../src/util.js"

describe("AsciiGrid", () => {
	it("merges box-drawing characters at junctions", () => {
		const g = new AsciiGrid(5, 3)
		g.setLine(2, 1, "─")
		g.setLine(2, 1, "│")
		expect(g.get(2, 1)).toBe("┼")
	})

	it("strips trailing spaces from rows", () => {
		const g = new AsciiGrid(10, 1)
		g.write(0, 0, "hi")
		expect(g.toString()).toBe("hi")
	})
})

// ── Rendering: structure ────────────────────────────────────────────────────

describe("renderBpmnAscii — structure", () => {
	it("returns (empty) for a BPMN with no processes", () => {
		// Minimal BPMN with no process elements
		const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
</bpmn:definitions>`
		expect(renderBpmnAscii(emptyXml)).toBe("(empty)")
	})

	it("returns a non-empty string for a minimal process", () => {
		const out = renderBpmnAscii(xml(Bpmn.createProcess("p").startEvent("s").endEvent("e")))
		expect(out.length).toBeGreaterThan(0)
		expect(out).not.toBe("(empty)")
	})

	it("contains task label text", () => {
		const out = renderBpmnAscii(
			xml(
				Bpmn.createProcess("p")
					.startEvent("s")
					.serviceTask("t", { name: "My Task", taskType: "t" })
					.endEvent("e"),
			),
		)
		expect(out).toContain("My Task")
	})

	it("shows a process name header by default", () => {
		const out = renderBpmnAscii(
			xml(Bpmn.createProcess("p").name("My Process").startEvent("s").endEvent("e")),
		)
		expect(out.startsWith("My Process\n")).toBe(true)
	})

	it("suppresses header when title: false", () => {
		const out = renderBpmnAscii(
			xml(Bpmn.createProcess("p").name("My Process").startEvent("s").endEvent("e")),
			{ title: false },
		)
		expect(out).not.toContain("My Process")
	})

	it("uses a custom title when provided", () => {
		const out = renderBpmnAscii(xml(Bpmn.createProcess("p").startEvent("s").endEvent("e")), {
			title: "Custom Title",
		})
		expect(out.startsWith("Custom Title\n")).toBe(true)
	})
})

// ── Rendering: element types ────────────────────────────────────────────────

describe("renderBpmnAscii — element markers", () => {
	it("includes ○ for start event", () => {
		const out = renderBpmnAscii(
			xml(Bpmn.createProcess("p").startEvent("s", { name: "Start" }).endEvent("e")),
			{ title: false },
		)
		expect(out).toContain("○")
	})

	it("includes ● for end event", () => {
		const out = renderBpmnAscii(
			xml(Bpmn.createProcess("p").startEvent("s").endEvent("e", { name: "End" })),
			{ title: false },
		)
		expect(out).toContain("●")
	})

	it("includes × for exclusive gateway", () => {
		const out = renderBpmnAscii(
			xml(
				Bpmn.createProcess("p")
					.startEvent("s")
					.exclusiveGateway("gw")
					.branch("yes", (b) => b.endEvent("e1"))
					.branch("no", (b) => b.endEvent("e2")),
			),
			{ title: false },
		)
		expect(out).toContain("×")
	})

	it("includes + for parallel gateway", () => {
		const out = renderBpmnAscii(
			xml(
				Bpmn.createProcess("p")
					.startEvent("s")
					.parallelGateway("fork")
					.branch("a", (b) => b.serviceTask("t1", { taskType: "a" }))
					.branch("b", (b) => b.serviceTask("t2", { taskType: "b" }))
					.parallelGateway("join")
					.endEvent("e"),
			),
			{ title: false },
		)
		expect(out).toContain("+")
	})

	it("includes [svc] for service tasks", () => {
		const out = renderBpmnAscii(
			xml(
				Bpmn.createProcess("p")
					.startEvent("s")
					.serviceTask("t", { name: "Call API", taskType: "call" })
					.endEvent("e"),
			),
			{ title: false },
		)
		expect(out).toContain("[svc]")
	})

	it("includes [usr] for user tasks", () => {
		const out = renderBpmnAscii(
			xml(Bpmn.createProcess("p").startEvent("s").userTask("t", { name: "Review" }).endEvent("e")),
			{ title: false },
		)
		expect(out).toContain("[usr]")
	})
})

// ── Rendering: edge routing ─────────────────────────────────────────────────

describe("renderBpmnAscii — edges", () => {
	it("draws horizontal arrows (►) between elements", () => {
		const out = renderBpmnAscii(
			xml(
				Bpmn.createProcess("p").startEvent("s").serviceTask("t", { taskType: "x" }).endEvent("e"),
			),
			{ title: false },
		)
		expect(out).toContain("►")
	})

	it("draws vertical lines (│) for branching flows", () => {
		const out = renderBpmnAscii(
			xml(
				Bpmn.createProcess("p")
					.startEvent("s")
					.parallelGateway("fork")
					.branch("a", (b) => b.serviceTask("t1", { taskType: "a" }))
					.branch("b", (b) => b.serviceTask("t2", { taskType: "b" }))
					.parallelGateway("join")
					.endEvent("e"),
			),
			{ title: false },
		)
		expect(out).toContain("│")
	})
})

// ── Rendering: complex diagrams ─────────────────────────────────────────────

describe("renderBpmnAscii — complex diagrams", () => {
	it("renders the built-in SAMPLE_BPMN_XML without throwing", () => {
		const out = renderBpmnAscii(SAMPLE_BPMN_XML, { title: false })
		expect(out.length).toBeGreaterThan(10)
	})

	it("renders an approval workflow with gateway branches", () => {
		const out = renderBpmnAscii(
			xml(
				Bpmn.createProcess("approval")
					.name("Approval Flow")
					.startEvent("s", { name: "Request" })
					.userTask("review", { name: "Review" })
					.exclusiveGateway("gw", { name: "Approved?" })
					.branch("yes", (b) =>
						b
							.condition("= true")
							.serviceTask("notify", { taskType: "email", name: "Notify" })
							.endEvent("e1"),
					)
					.branch("no", (b) => b.defaultFlow().endEvent("e2", { name: "Rejected" })),
			),
		)
		expect(out).toContain("Approval Flow")
		expect(out).toContain("Review")
		expect(out).toContain("×")
	})

	it("renders a parallel fork/join without throwing", () => {
		const out = renderBpmnAscii(
			xml(
				Bpmn.createProcess("parallel")
					.startEvent("s")
					.parallelGateway("fork")
					.branch("path-a", (b) => b.serviceTask("a", { name: "Task A", taskType: "a" }))
					.branch("path-b", (b) => b.serviceTask("b", { name: "Task B", taskType: "b" }))
					.branch("path-c", (b) => b.serviceTask("c", { name: "Task C", taskType: "c" }))
					.parallelGateway("join")
					.endEvent("e"),
			),
			{ title: false },
		)
		expect(out).toContain("Task A")
		expect(out).toContain("Task B")
		expect(out).toContain("Task C")
		expect(out).toContain("+")
	})
})

// ── Utility functions ────────────────────────────────────────────────────────

describe("truncate", () => {
	it("returns the string unchanged when it fits", () => {
		expect(truncate("hello", 10)).toBe("hello")
	})

	it("appends … when truncated", () => {
		expect(truncate("hello world", 8)).toBe("hello w…")
	})

	it("handles maxLen=1", () => {
		expect(truncate("hi", 1)).toBe("…")
	})

	it("handles maxLen=0", () => {
		expect(truncate("hi", 0)).toBe("")
	})
})
