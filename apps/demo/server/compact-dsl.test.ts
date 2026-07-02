import { describe, expect, it } from "vitest"
import { parseCompactDsl } from "./compact-dsl.js"

describe("parseCompactDsl", () => {
	it("parses a process header with a quoted name", () => {
		const dsl = `process Proc "My Process"
start s "Start"
`
		const result = parseCompactDsl(dsl)
		expect(result.processes).toHaveLength(1)
		expect(result.processes[0].id).toBe("Proc")
		expect(result.processes[0].name).toBe("My Process")
	})

	it("parses a start event with a quoted name", () => {
		const dsl = `process P
start s "Begin"
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].elements).toEqual([{ id: "s", type: "startEvent", name: "Begin" }])
	})

	it("parses a start event with no name", () => {
		const dsl = `process P
start s
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].elements).toEqual([{ id: "s", type: "startEvent" }])
	})

	it("parses a service task with job type and task headers", () => {
		const dsl = `process P
service t "Fetch" job=io.camunda:http-json:1 h.resultVariable=res h.resultExpression="=res.body"
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].elements[0]).toEqual({
			id: "t",
			type: "serviceTask",
			name: "Fetch",
			jobType: "io.camunda:http-json:1",
			taskHeaders: { resultVariable: "res", resultExpression: "=res.body" },
		})
	})

	it("parses a flow with a quoted name and condition containing an escaped quote", () => {
		const dsl = `process P
a -> b "low-risk" if="=tier = \\"low\\""
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].flows[0]).toMatchObject({
			from: "a",
			to: "b",
			name: "low-risk",
			condition: '=tier = "low"',
		})
	})

	it("parses a flow with no name or condition", () => {
		const dsl = `process P
a -> b
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].flows[0]).toMatchObject({ from: "a", to: "b" })
		expect(result.processes[0].flows[0].name).toBeUndefined()
		expect(result.processes[0].flows[0].condition).toBeUndefined()
	})

	it("parses a boundary event with at=, event=, and noninterrupt", () => {
		const dsl = `process P
boundary b "Timeout" at=task1 event=timer noninterrupt
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].elements[0]).toEqual({
			id: "b",
			type: "boundaryEvent",
			name: "Timeout",
			attachedTo: "task1",
			eventType: "timer",
			interrupting: false,
		})
	})

	it("parses nested elements and flows inside a subProcess, resuming root elements after", () => {
		const dsl = `process P
sub outer "Outer"
  start is "Inner Start"
  end ie "Inner End"
  is -> ie
end e
`
		const result = parseCompactDsl(dsl)
		const outer = result.processes[0].elements.find((el) => el.id === "outer")
		expect(outer?.children?.elements).toHaveLength(2)
		expect(outer?.children?.flows).toHaveLength(1)
		expect(outer?.children?.flows[0]).toMatchObject({ from: "is", to: "ie" })
		expect(result.processes[0].elements.some((el) => el.id === "e")).toBe(true)
		expect(result.processes[0].elements).toHaveLength(2)
	})

	it("assigns each flow a unique id even though the DSL never specifies one", () => {
		const dsl = `process P
a -> b
b -> c
`
		const result = parseCompactDsl(dsl)
		const ids = result.processes[0].flows.map((f) => f.id)
		expect(new Set(ids).size).toBe(2)
	})

	it("throws with a line number on an unknown tag", () => {
		const dsl = `process P
foo x "Bad"
`
		expect(() => parseCompactDsl(dsl)).toThrow(/line 2/)
	})

	it("throws when indentation is not a multiple of 2 spaces", () => {
		const dsl = `process P
 start s
`
		expect(() => parseCompactDsl(dsl)).toThrow(/indentation/)
	})

	it("throws when no process line is present", () => {
		const dsl = `start s "Begin"
`
		expect(() => parseCompactDsl(dsl)).toThrow(/process/)
	})
})
