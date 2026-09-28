// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { createRouter } from "../src/router.js"

function setHash(path: string): void {
	window.location.hash = path
	window.dispatchEvent(new HashChangeEvent("hashchange"))
}

describe("createRouter", () => {
	afterEach(() => {
		window.location.hash = ""
	})

	it("dispatches the current hash on start and extracts params", () => {
		window.location.hash = "/instances/2251799813690001"
		const router = createRouter()
		const list = vi.fn()
		const detail = vi.fn()
		router.on("/instances", list)
		router.on("/instances/:key", detail)
		const stop = router.start()
		expect(detail).toHaveBeenCalledWith({ key: "2251799813690001" })
		expect(list).not.toHaveBeenCalled()
		expect(router.currentPath()).toBe("/instances/2251799813690001")
		stop()
	})

	it("treats an empty hash as the root route", () => {
		const router = createRouter()
		const root = vi.fn()
		router.on("/", root)
		const stop = router.start()
		expect(root).toHaveBeenCalledTimes(1)
		stop()
	})

	it("follows hash changes until stopped", () => {
		const router = createRouter()
		const jobs = vi.fn()
		router.on("/jobs", jobs)
		const stop = router.start()
		setHash("/jobs")
		expect(jobs).toHaveBeenCalledTimes(1)
		stop()
		setHash("/")
		setHash("/jobs")
		expect(jobs).toHaveBeenCalledTimes(1)
	})

	it("navigate writes the hash", () => {
		const router = createRouter()
		router.navigate("/tasks/42")
		expect(window.location.hash).toBe("#/tasks/42")
	})

	it("refresh re-runs the handler for the current path", () => {
		window.location.hash = "/definitions/pd-1"
		const router = createRouter()
		const handler = vi.fn()
		router.on("/definitions/:key", handler)
		const stop = router.start()
		router.refresh()
		expect(handler).toHaveBeenCalledTimes(2)
		expect(handler).toHaveBeenLastCalledWith({ key: "pd-1" })
		stop()
	})

	it("ignores paths no route matches", () => {
		window.location.hash = "/nowhere"
		const router = createRouter()
		const root = vi.fn()
		router.on("/", root)
		const stop = router.start()
		expect(root).not.toHaveBeenCalled()
		stop()
	})
})
