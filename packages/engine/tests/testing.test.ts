import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import "../src/testing/vitest.js"
import {
	bpmnMatchers,
	createProcessTest,
	formatCoverage,
	mapConnectorResponse,
} from "../src/testing/index.js"
import type { BpmnMatcherContext, ProcessTest, RunSnapshot } from "../src/testing/index.js"
import { scheduleTimer } from "../src/timers.js"

const FIXTURE = new URL("./fixtures/testing.bpmn", import.meta.url)
const XML = readFileSync(FIXTURE, "utf8")

let t: ProcessTest

beforeEach(async () => {
	t = await createProcessTest({ bpmn: XML, startTime: "2026-06-01T00:00:00Z" })
})

afterEach(() => t.dispose())

describe("createProcessTest — loading", () => {
	it("reads a model from a file URL and from a path", async () => {
		const fromUrl = await createProcessTest({ bpmn: FIXTURE })
		const fromPath = await createProcessTest({ bpmn: FIXTURE.pathname })
		fromUrl.mockJob("payment", { result: { paid: false } })
		const run = await fromUrl.start("order-process")
		expect(run).toHaveCompleted()
		await expect(fromPath.start("timer-process")).resolves.toBeDefined()
		fromPath.dispose()
		fromUrl.dispose()
	})

	it("explains an unreadable path", async () => {
		await expect(createProcessTest({ bpmn: "./does-not-exist.bpmn" })).rejects.toThrow(
			/could not read BPMN from \.\/does-not-exist\.bpmn/,
		)
	})

	it("rejects an unknown process id, listing the deployed ones", async () => {
		await expect(t.start("nope")).rejects.toThrow(/"nope" is not deployed.*order-process/)
	})

	it("rejects an invalid startTime", async () => {
		await expect(createProcessTest({ bpmn: XML, startTime: "yesterday" })).rejects.toThrow(
			/invalid startTime/,
		)
	})
})

describe("job mocks", () => {
	it("completes mocked jobs with fixed variables and follows the gateway", async () => {
		t.mockJob("payment", { result: { paid: true } })
		t.mockJob("ship", { result: { shipped: true } })
		const run = await t.start("order-process", { amount: 10 })

		expect(run).toHaveCompleted()
		expect(run).toHavePassed(["payment", "ship", "end_ok"])
		expect(run).toHavePassedInOrder(["start", "payment", "paid_gw", "ship", "end_ok"])
		expect(run).toHaveNotPassed(["end_cancel"])
		expect(run).toHaveVariables({ amount: 10, paid: true, shipped: true })
		expect(run).toHaveVariables({ amount: expect.any(Number) })
	})

	it("gives a handler the job's element, variables and headers, and records each call", async () => {
		const payment = t.mockJob("payment", (job) => ({
			paid: (job.variables.amount as number) < 100,
		}))
		t.mockJob("ship", { result: {} })

		const cheap = await t.start("order-process", { amount: 10 })
		const dear = await t.start("order-process", { amount: 500 })

		expect(cheap).toHavePassed(["ship"])
		expect(dear).toHavePassed(["end_cancel"])
		expect(payment.calls).toHaveLength(2)
		expect(payment.calls[0]).toMatchObject({
			type: "payment",
			elementId: "payment",
			processId: "order-process",
			variables: { amount: 10 },
			headers: { provider: "stripe" },
		})
	})

	it("fails the instance when a mock fails, throws, or throws a BPMN error", async () => {
		t.mockJob("payment", { fail: "card declined" })
		expect(await t.start("order-process")).toHaveFailed("card declined")

		t.mockJob("payment", () => {
			throw new Error("gateway timeout")
		})
		expect(await t.start("order-process")).toHaveFailed(/gateway timeout/)

		t.mockJob("payment", { throwError: { code: "INSUFFICIENT_FUNDS" } })
		const run = await t.start("order-process")
		expect(run).not.toHaveCompleted()
		expect(run).toHaveNotPassed(["payment"])
	})

	it("mocks an async handler", async () => {
		t.mockJob("payment", async () => {
			await Promise.resolve()
			return { paid: false }
		})
		expect(await t.start("order-process")).toHavePassed(["end_cancel"])
	})

	it("restore() leaves later jobs waiting for a manual completion", async () => {
		const mock = t.mockJob("payment", { result: { paid: false } })
		mock.restore()
		const run = await t.start("order-process")
		expect(run).toBeWaitingAt("payment")
		expect(run.jobs.map((j) => j.type)).toEqual(["payment"])
	})
})

describe("manual job completion", () => {
	it("waits at unmocked jobs and completes them by element id or job type", async () => {
		const run = await t.start("order-process")
		expect(run).toBeWaitingAt("payment")
		expect(run.jobs).toEqual([expect.objectContaining({ elementId: "payment", type: "payment" })])

		await run.completeJob("payment", { paid: true })
		expect(run).toBeWaitingAt(["ship"])

		await run.completeJob("ship")
		expect(run).toHaveCompleted()
		expect(run.jobs).toEqual([])
		expect(run.enteredElements).toEqual(["start", "payment", "paid_gw", "ship", "end_ok"])
	})

	it("completes a Camunda user task (no job type) by its element id", async () => {
		const run = await t.start("review-process")
		expect(run.jobs[0]?.type).toBe("userTask")
		await run.completeJob("review", { approved: true })
		expect(run).toHavePassed(["r_done"])
		expect(run).toHaveVariables({ approved: true })
	})

	it("fails and throws errors from a waiting job", async () => {
		const failed = await t.start("order-process")
		await failed.failJob("payment", "no funds")
		expect(failed).toHaveFailed("no funds")

		const thrown = await t.start("order-process")
		await thrown.throwError("payment", "DECLINED", "Card declined")
		expect(thrown).not.toHaveCompleted()
	})

	it("explains what is waiting when the job it was asked for is not", async () => {
		const run = await t.start("order-process")
		await expect(run.completeJob("ship")).rejects.toThrow(
			/No job is waiting at "ship".*Waiting jobs: payment \(payment\)/,
		)
		t.mockJob("ship", { result: {} })
		await run.completeJob("payment", { paid: true })
		await expect(run.completeJob("ship")).rejects.toThrow(
			/are mocked, so they complete on their own/,
		)
	})

	it("cancel() terminates the instance", async () => {
		const run = await t.start("order-process")
		await run.cancel()
		expect(run.state).toBe("terminated")
		expect(run.jobs).toEqual([])
	})
})

describe("virtual clock", () => {
	it("fires a duration timer only when time is advanced past it", async () => {
		const run = await t.start("timer-process")
		expect(run).toBeWaitingAt("wait_hour")

		await t.advanceTime("PT59M")
		expect(run).toBeWaitingAt("wait_hour")

		await run.advanceTime(60_000)
		expect(run).toHaveCompleted()
		expect(t.now().toISOString()).toBe("2026-06-01T01:00:00.000Z")
	})

	it("fires an absolute timeDate relative to startTime", async () => {
		const run = await t.start("date-process")
		await t.advanceTime("P200D")
		expect(run).toBeWaitingAt("wait_new_year")
		await t.advanceTime("P14D")
		expect(run).toHaveCompleted()
	})

	it("fires a boundary timer and drops the interrupted task's job", async () => {
		t.mockJob("escalate", { result: { escalated: true } })
		const run = await t.start("review-process")
		await t.advanceTime("P1D")
		expect(run).toHavePassed(["review_timeout", "escalate", "r_escalated"])
		expect(run).toHaveNotPassed(["review"])
		expect(run).toHaveVariables({ escalated: true })
		expect(run.jobs).toEqual([])
	})

	it("cancels a boundary timer when the task completes first", async () => {
		const run = await t.start("review-process")
		await t.advanceTime("PT23H")
		await run.completeJob("review")
		await t.advanceTime("P2D")
		expect(run).toHavePassed(["r_done"])
		expect(run).toHaveNotPassed(["escalate"])
	})

	it("rejects durations it cannot read", async () => {
		await expect(t.advanceTime("1 hour")).rejects.toThrow(/ISO 8601 duration/)
		await expect(t.advanceTime(-5)).rejects.toThrow(/non-negative/)
		await expect(t.advanceTime("PT0S")).resolves.toBeUndefined()
	})

	it("keeps an earlier test's clock installed when a later one is disposed", async () => {
		const other = await createProcessTest({ bpmn: XML })
		other.dispose()
		const run = await t.start("timer-process")
		await t.advanceTime("PT1H")
		expect(run).toHaveCompleted()
	})

	it("hands timers back to the real clock on dispose", () => {
		t.dispose()
		let fired = false
		const cancel = scheduleTimer({ type: "timer", timeDuration: "PT1H" }, () => {
			fired = true
		})
		cancel()
		expect(fired).toBe(false)
		expect(() => t.mockJob("x", { result: {} })).toThrow(/disposed/)
	})
})

describe("messages", () => {
	it("correlates a message by its name", async () => {
		const run = await t.start("message-process")
		expect(run).toBeWaitingAt("await_confirmation")
		await run.publishMessage("payment-confirmed")
		expect(run).toHaveCompleted()
	})

	it("throws when nothing is waiting for the message", async () => {
		const run = await t.start("message-process")
		await expect(run.publishMessage("unknown")).rejects.toThrow(
			/Message "unknown" was not correlated.*await_confirmation/,
		)
	})
})

describe("connector mocks", () => {
	const response = { status: 200, body: { main: { temp: 21.5 } } }

	it("maps a mocked response through resultVariable and resultExpression", async () => {
		const http = t.mockConnector("io.camunda:http-json:1", { response })
		const run = await t.start("connector-process")
		expect(run).toHaveCompleted()
		expect(run).toHaveVariables({ weatherResponse: response, temperature: 21.5, ok: true })
		expect(http.calls[0]?.elementId).toBe("fetch_weather")
	})

	it("computes the response in a handler", async () => {
		t.mockConnector("io.camunda:http-json:1", async () => ({ status: 500, body: { main: {} } }))
		const run = await t.start("connector-process")
		expect(run).toHaveVariables({ ok: false, temperature: null })
	})

	it("fails the job like any other mock", async () => {
		t.mockConnector("io.camunda:http-json:1", { fail: "503 Service Unavailable" })
		expect(await t.start("connector-process")).toHaveFailed("503")
	})

	it("mapConnectorResponse rejects expressions that do not produce a context", () => {
		expect(() => mapConnectorResponse({}, { resultExpression: "=1 + 1" })).toThrow(
			/must produce a context/,
		)
		expect(() => mapConnectorResponse({}, { resultExpression: "={a: " })).toThrow(/does not parse/)
		expect(mapConnectorResponse("x", { resultExpression: "={r: response}" })).toEqual({ r: "x" })
		expect(mapConnectorResponse("x", {})).toEqual({})
		expect(
			mapConnectorResponse({}, { resultVariable: "r", resultExpression: "=body.missing" }),
		).toEqual({ r: {} })
	})
})

describe("coverage", () => {
	it("counts elements entered and flows taken across runs", async () => {
		t.mockJob("ship", { result: {} })
		t.mockJob("payment", (job) => ({ paid: job.variables.amount === 1 }))

		await t.start("order-process", { amount: 1 })
		let order = t.coverage().processes.find((p) => p.processId === "order-process")
		expect(order?.elements.uncovered).toEqual(["end_cancel"])
		expect(order?.flows.uncovered).toEqual(["f_unpaid"])
		expect(order?.flows.percent).toBe(80)

		await t.start("order-process", { amount: 2 })
		order = t.coverage().processes.find((p) => p.processId === "order-process")
		expect(order?.elements).toMatchObject({ total: 6, covered: 6, percent: 100, uncovered: [] })
		expect(order?.flows).toMatchObject({ total: 5, covered: 5, uncovered: [] })
	})

	it("marks every incoming flow of a parallel join", async () => {
		await t.start("parallel-process")
		const parallel = t.coverage().processes.find((p) => p.processId === "parallel-process")
		expect(parallel?.flows.uncovered).toEqual([])
		expect(parallel?.elements.uncovered).toEqual([])
	})

	it("reports totals and a readable summary", async () => {
		await t.start("parallel-process")
		const report = t.coverage()
		expect(report.processes.map((p) => p.processId)).toContain("timer-process")
		expect(report.elements.covered).toBe(6)
		const text = formatCoverage(report)
		expect(text).toContain("parallel-process  elements 6/6 (100.0%)  flows 6/6 (100.0%)")
		expect(text).toContain("elements not reached: t_start, wait_hour, t_end")
		expect(text).toMatch(/total {2}elements 6\/\d+/)
	})
})

describe("bpmnMatchers — messages and Jest-style use", () => {
	const ctx = (isNot = false): BpmnMatcherContext => ({
		isNot,
		equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
	})
	const run: RunSnapshot = {
		processId: "p",
		state: "failed",
		error: "boom",
		variables: { a: 1 },
		completedElements: ["s", "x"],
		activeElements: ["y"],
	}

	it("explains a failed expectation with the run's state", () => {
		const result = bpmnMatchers.toHaveCompleted.call(ctx(), run)
		expect(result.pass).toBe(false)
		expect(result.message()).toBe(
			'expected process "p" to have completed — process "p" is failed: boom; waiting at [y]; completed [s, x]',
		)
	})

	it("reports order and variable mismatches", () => {
		const order = bpmnMatchers.toHavePassedInOrder.call(ctx(), run, ["x", "s"])
		expect(order.pass).toBe(false)
		expect(order.message()).toContain('"s" did not complete after the ones before it')

		const vars = bpmnMatchers.toHaveVariables.call(ctx(), run, { a: 2, b: 3 })
		expect(vars.pass).toBe(false)
		expect(vars.message()).toContain("variables a=2, b=3, got a=1, b=<unset>")
	})

	it("works under .not", () => {
		expect(run).not.toHaveCompleted()
		expect(run).not.toHaveFailed("other")
		expect(run).not.toBeWaitingAt("s")
		expect(run).not.toHavePassed(["y"])
		expect(run).not.toHaveVariables({ a: 2 })
	})

	it("rejects something that is not a run", () => {
		expect(() => bpmnMatchers.toHaveCompleted.call(ctx(), { state: "x" })).toThrow(TypeError)
		expect(() => expect(null).toHaveCompleted()).toThrow(/expect a run returned by/)
	})
})
