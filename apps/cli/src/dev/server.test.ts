import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { request } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { orderTests, orderXml } from "./fixtures.test-helpers.js"
import { etagOf } from "./project.js"
import type { CheckResult, DevEvent, FileResponse, FilesResponse } from "./protocol.js"
import { TOKEN_HEADER } from "./protocol.js"
import { type DevServer, startDevServer } from "./server.js"

let root: string
let server: DevServer
let checked: CheckResult[]
let externals: string[]

async function start(): Promise<void> {
	checked = []
	externals = []
	server = await startDevServer({
		root,
		port: 0,
		engine: "ts",
		uiScript: join(root, "..", "no-such-bundle.js"),
		onCheck: (result) => checked.push(result),
		onExternalChange: (path) => externals.push(path),
		debounceMs: 20,
	})
	await server.initialChecks
}

beforeEach(async () => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "casen-dev-server-")))
	mkdirSync(join(root, "orders"))
	writeFileSync(join(root, "orders", "order.bpmn"), orderXml())
	writeFileSync(join(root, "orders", "order.bpmn.tests.json"), orderTests(true))
	writeFileSync(join(root, "secret.txt"), "top secret")
	await start()
})

afterEach(async () => {
	await server.close()
	rmSync(root, { recursive: true, force: true })
})

function api(path: string, init: RequestInit = {}): Promise<Response> {
	return fetch(new URL(path, server.url), {
		...init,
		headers: { [TOKEN_HEADER]: server.token, ...init.headers },
	})
}

function put(path: string, text: string, baseEtag: string | null): Promise<Response> {
	return api(`/api/file?path=${encodeURIComponent(path)}`, {
		method: "PUT",
		body: JSON.stringify({ text, baseEtag }),
	})
}

/** A raw request, for the one thing `fetch` will not do: send a foreign Host header. */
function withHost(host: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const req = request(
			{ host: "127.0.0.1", port: server.port, path: "/", headers: { host } },
			(res) => {
				res.resume()
				resolve(res.statusCode ?? 0)
			},
		)
		req.on("error", reject)
		req.end()
	})
}

/** Subscribes to `/api/events` and resolves with the first frame `match` accepts. */
async function events(): Promise<{
	next(match: (event: DevEvent) => boolean): Promise<DevEvent>
	close(): void
}> {
	const controller = new AbortController()
	const res = await fetch(new URL(`/api/events?token=${server.token}`, server.url), {
		signal: controller.signal,
	})
	if (res.body === null) throw new Error("no event stream")
	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	const seen: DevEvent[] = []
	let buffer = ""
	return {
		async next(match) {
			for (;;) {
				const index = seen.findIndex(match)
				if (index !== -1) return seen.splice(0, index + 1)[index] as DevEvent
				const { done, value } = await reader.read()
				if (done) throw new Error("event stream ended")
				buffer += decoder.decode(value, { stream: true })
				const frames = buffer.split("\n\n")
				buffer = frames.pop() ?? ""
				for (const frame of frames) {
					if (frame.startsWith("data: ")) seen.push(JSON.parse(frame.slice(6)) as DevEvent)
				}
			}
		},
		close: () => controller.abort(),
	}
}

describe("casen dev server — security", () => {
	it("serves the page to a loopback host, with the session token in it", async () => {
		const res = await fetch(server.url)
		expect(res.status).toBe(200)
		expect(res.headers.get("content-security-policy")).toContain("default-src 'self'")
		expect(await res.text()).toContain(`content="${server.token}"`)
	})

	it("refuses a request addressed to any other host (DNS rebinding)", async () => {
		expect(await withHost("evil.example:80")).toBe(403)
		expect(await withHost(`attacker.test:${server.port}`)).toBe(403)
		expect(await withHost(`localhost:${server.port}`)).toBe(200)
	})

	it("refuses API calls without the session token", async () => {
		const res = await fetch(new URL("/api/files", server.url))
		expect(res.status).toBe(403)
		const events = await fetch(new URL("/api/events?token=wrong", server.url))
		expect(events.status).toBe(403)
	})

	it.each([
		"../outside.bpmn",
		"/etc/passwd",
		"secret.txt",
		".git/HEAD.bpmn",
		"orders/../../x.bpmn",
	])("refuses to read or write %j", async (path) => {
		const read = await api(`/api/file?path=${encodeURIComponent(path)}`)
		expect(read.status).toBe(400)
		const write = await put(path, orderXml(), null)
		expect(write.status).toBe(400)
	})

	it("says plainly when the UI bundle is missing", async () => {
		const res = await fetch(new URL("/app.js", server.url))
		expect(res.status).toBe(500)
		expect(await res.text()).toMatch(/UI bundle is missing/)
	})
})

describe("casen dev server — files", () => {
	it("lists the project's models with their check results", async () => {
		const res = await api("/api/files")
		const body = (await res.json()) as FilesResponse
		expect(body.engine).toBe("ts")
		expect(body.files).toEqual([{ path: "orders/order.bpmn", kind: "bpmn", hasTests: true }])
		expect(body.checks.map((c) => c.path)).toEqual(["orders/order.bpmn"])
	})

	it("reads a file with its etag", async () => {
		const res = await api("/api/file?path=orders/order.bpmn")
		const body = (await res.json()) as FileResponse
		expect(body).toEqual({
			path: "orders/order.bpmn",
			kind: "bpmn",
			text: orderXml(),
			etag: etagOf(orderXml()),
		})
	})

	it("answers 404 for a model that does not exist", async () => {
		const res = await api("/api/file?path=orders/missing.bpmn")
		expect(res.status).toBe(404)
	})

	it("writes a save to disk, verified, and reports the new etag", async () => {
		const res = await put("orders/order.bpmn", orderXml("Reserve stock"), etagOf(orderXml()))
		expect(res.status).toBe(200)
		const body = (await res.json()) as { etag: string }
		const onDisk = readFileSync(join(root, "orders", "order.bpmn"), "utf8")
		expect(onDisk).toContain('name="Reserve stock"')
		expect(body.etag).toBe(etagOf(onDisk))
	})

	it("refuses a save made against a stale copy, and says what is on disk", async () => {
		writeFileSync(join(root, "orders", "order.bpmn"), orderXml("Changed elsewhere"))
		const res = await put("orders/order.bpmn", orderXml("Mine"), etagOf(orderXml()))
		expect(res.status).toBe(409)
		expect(((await res.json()) as { etag: string }).etag).toBe(
			etagOf(orderXml("Changed elsewhere")),
		)
		expect(readFileSync(join(root, "orders", "order.bpmn"), "utf8")).toContain("Changed elsewhere")
	})

	it("refuses a save that does not parse", async () => {
		const res = await put("orders/order.bpmn", "<definitions", etagOf(orderXml()))
		expect(res.status).toBe(400)
	})
})

describe("casen dev server — live loop", () => {
	it("runs lint and the scenarios for every model at startup", () => {
		const result = checked.find((c) => c.path === "orders/order.bpmn")
		expect(result?.lint).toBeDefined()
		expect(result?.tests).toMatchObject({ engine: "ts", passed: 1, failed: 1 })
		expect(result?.tests?.scenarios[1]?.problems[0]).toMatch(
			/variables.inStock: expected true, got false/,
		)
	})

	it("re-runs the scenarios when the sidecar changes on disk, and streams the result", async () => {
		const stream = await events()
		try {
			writeFileSync(join(root, "orders", "order.bpmn.tests.json"), orderTests(false))
			const change = await stream.next(
				(e) => e.type === "change" && e.path === "orders/order.bpmn.tests.json",
			)
			expect(change).toMatchObject({ etag: etagOf(orderTests(false)) })
			const check = await stream.next((e) => e.type === "check" && e.result.tests?.failed === 0)
			expect(check).toMatchObject({
				result: { path: "orders/order.bpmn", tests: { passed: 2, failed: 0 } },
			})
			expect(externals).toContain("orders/order.bpmn.tests.json")
		} finally {
			stream.close()
		}
	})

	it("streams a new file, its change, and its checks", async () => {
		const stream = await events()
		try {
			writeFileSync(join(root, "refund.bpmn"), orderXml("Refund"))
			await stream.next((e) => e.type === "files" && e.files.some((f) => f.path === "refund.bpmn"))
			await stream.next((e) => e.type === "change" && e.path === "refund.bpmn")
			const check = await stream.next((e) => e.type === "check" && e.result.path === "refund.bpmn")
			expect(check).toMatchObject({ result: { kind: "bpmn", lint: { errors: 0 } } })
		} finally {
			stream.close()
		}
	})

	it("re-runs the scenarios of the processes beside a DMN file when it changes", async () => {
		const dmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="d" name="D" namespace="x">
  <decision id="risk" name="Risk">
    <decisionTable id="t" hitPolicy="FIRST">
      <input id="i"><inputExpression id="ie" typeRef="number"><text>amount</text></inputExpression></input>
      <output id="o" name="risk" typeRef="string" />
      <rule id="r"><inputEntry id="e"><text>-</text></inputEntry><outputEntry id="oe"><text>"low"</text></outputEntry></rule>
    </decisionTable>
  </decision>
</definitions>
`
		const stream = await events()
		try {
			writeFileSync(join(root, "orders", "risk.dmn"), dmn)
			await stream.next((e) => e.type === "check" && e.result.path === "orders/risk.dmn")
			const rerun = await stream.next(
				(e) => e.type === "check" && e.result.path === "orders/order.bpmn",
			)
			expect(rerun).toMatchObject({ result: { tests: { passed: 1, failed: 1 } } })
		} finally {
			stream.close()
		}
	})

	it("keeps seeing a file that editors replace by rename, and one this server saved", async () => {
		// Regression: Node's recursive fs.watch on Linux watches each file's inode
		// and goes quiet for good once the file is swapped out by a rename.
		const file = join(root, "orders", "order.bpmn")
		const atomicWrite = (text: string) => {
			writeFileSync(join(root, "orders", ".order.bpmn.swp"), text)
			renameSync(join(root, "orders", ".order.bpmn.swp"), file)
		}
		const stream = await events()
		try {
			atomicWrite(orderXml("First"))
			await stream.next((e) => e.type === "change" && e.etag === etagOf(orderXml("First")))
			atomicWrite(orderXml("Second"))
			await stream.next((e) => e.type === "change" && e.etag === etagOf(orderXml("Second")))

			const res = await put("orders/order.bpmn", orderXml("Saved"), etagOf(orderXml("Second")))
			expect(res.status).toBe(200)
			writeFileSync(file, orderXml("After save"))
			await stream.next((e) => e.type === "change" && e.etag === etagOf(orderXml("After save")))
		} finally {
			stream.close()
		}
	})

	it("watches a directory created after startup", async () => {
		const stream = await events()
		try {
			mkdirSync(join(root, "later"))
			writeFileSync(join(root, "later", "new.bpmn"), orderXml())
			await stream.next((e) => e.type === "check" && e.result.path === "later/new.bpmn")
		} finally {
			stream.close()
		}
	})

	it("reports a model that stops parsing", async () => {
		const stream = await events()
		try {
			writeFileSync(join(root, "orders", "order.bpmn"), "<broken")
			const check = await stream.next(
				(e) => e.type === "check" && e.result.parseError !== undefined,
			)
			expect(check).toMatchObject({ result: { path: "orders/order.bpmn" } })
		} finally {
			stream.close()
		}
	})

	it("broadcasts a save once, and does not report its own write as an external change", async () => {
		const stream = await events()
		try {
			const res = await put("orders/order.bpmn", orderXml("Reserve stock"), etagOf(orderXml()))
			const { etag } = (await res.json()) as { etag: string }
			await stream.next((e) => e.type === "change" && e.etag === etag)
			// Frames arrive in order, so the first check after the change is the re-run.
			await stream.next((e) => e.type === "check" && e.result.path === "orders/order.bpmn")
			// A later, unrelated change is the next thing the watcher reports — the
			// echo of the save never is.
			writeFileSync(join(root, "orders", "order.bpmn.tests.json"), orderTests(false))
			await stream.next((e) => e.type === "change" && e.path.endsWith(".tests.json"))
			expect(externals).toEqual(["orders/order.bpmn.tests.json"])
		} finally {
			stream.close()
		}
	})
})
