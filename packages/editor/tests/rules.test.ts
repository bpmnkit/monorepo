import { describe, expect, it } from "vitest"
import { canAttach, canConnect, canContain, canMorph, canResize } from "../src/rules.js"

describe("canConnect", () => {
	it("allows a normal task → task flow", () => {
		expect(canConnect("task", "userTask")).toBe(true)
	})

	it("forbids outgoing from an end event and incoming to a start event", () => {
		expect(canConnect("endEvent", "task")).toBe(false)
		expect(canConnect("messageEndEvent", "task")).toBe(false)
		expect(canConnect("task", "startEvent")).toBe(false)
		expect(canConnect("task", "messageStartEvent")).toBe(false)
	})

	it("forbids a sequence flow into a boundary event", () => {
		expect(canConnect("task", "boundaryEvent")).toBe(false)
	})

	it("forbids data elements and annotations as sequence-flow endpoints", () => {
		expect(canConnect("task", "dataObjectReference")).toBe(false)
		expect(canConnect("dataStoreReference", "task")).toBe(false)
		expect(canConnect("task", "textAnnotation")).toBe(false)
	})

	it("restricts event-based gateway targets to catch events / receive tasks", () => {
		expect(canConnect("eventBasedGateway", "intermediateCatchEvent")).toBe(true)
		expect(canConnect("eventBasedGateway", "receiveTask")).toBe(true)
		expect(canConnect("eventBasedGateway", "task")).toBe(false)
		expect(canConnect("eventBasedGateway", "userTask")).toBe(false)
	})
})

describe("canAttach", () => {
	it("attaches a boundary event to an activity", () => {
		expect(canAttach("subProcess")).toBe(true)
		expect(canAttach("serviceTask")).toBe(true)
	})

	it("refuses to attach to a non-activity", () => {
		expect(canAttach("exclusiveGateway")).toBe(false)
		expect(canAttach("startEvent")).toBe(false)
	})
})

describe("canContain", () => {
	it("lets a container hold a flow node", () => {
		expect(canContain("subProcess", "task")).toBe(true)
		expect(canContain("lane", "userTask")).toBe(true)
		expect(canContain("participant", "startEvent")).toBe(true)
	})

	it("refuses non-containers and nested pools", () => {
		expect(canContain("task", "userTask")).toBe(false)
		expect(canContain("participant", "participant")).toBe(false)
	})
})

describe("canResize", () => {
	it("resizes activities and annotations but not events/gateways", () => {
		expect(canResize("subProcess")).toBe(true)
		expect(canResize("textAnnotation")).toBe(true)
		expect(canResize("startEvent")).toBe(false)
		expect(canResize("exclusiveGateway")).toBe(false)
	})
})

describe("canMorph", () => {
	it("morphs within the same category", () => {
		expect(canMorph("exclusiveGateway", "parallelGateway")).toBe(true)
		expect(canMorph("startEvent", "messageStartEvent")).toBe(true)
		expect(canMorph("task", "userTask")).toBe(true)
		expect(canMorph("intermediateCatchEvent", "messageCatchEvent")).toBe(true)
	})

	it("refuses cross-category morphs and no-op morphs", () => {
		expect(canMorph("task", "exclusiveGateway")).toBe(false)
		expect(canMorph("startEvent", "endEvent")).toBe(false)
		expect(canMorph("task", "task")).toBe(false)
	})
})
