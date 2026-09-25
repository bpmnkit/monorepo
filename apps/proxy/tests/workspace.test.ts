import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs"
import type http from "node:http"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createProxyServer } from "../src/index.js"
import { handleElementTemplates } from "../src/routes/element-templates.js"
import { WorkspaceRoots, unsafeRootReason } from "../src/workspace.js"
import { close, listening, send } from "./helpers/http.js"

let base: string
let project: string
let outside: string
let configured: string

beforeAll(() => {
	base = realpathSync(mkdtempSync(join(tmpdir(), "proxy-ws-")))
	project = join(base, "project")
	outside = join(base, "outside")
	configured = join(base, ".hidden-but-configured")
	for (const d of [project, outside, configured, join(base, ".secret")]) {
		mkdirSync(d, { recursive: true })
	}
	writeFileSync(join(project, "order.bpmn"), "<order/>")
	writeFileSync(join(project, "notes.txt"), "not a model")
	writeFileSync(join(outside, "secret.bpmn"), "<secret/>")
	writeFileSync(join(configured, "c.bpmn"), "<c/>")
	// A link inside the project that leads out of it, and one that dangles out of it.
	symlinkSync(outside, join(project, "escape"))
	symlinkSync(join(outside, "created-by-write.bpmn"), join(project, "dangling.bpmn"))
})

afterAll(() => {
	rmSync(base, { recursive: true, force: true })
})

describe("unsafeRootReason", () => {
	it("refuses the filesystem root, home, its ancestors and hidden folders", () => {
		expect(unsafeRootReason("/")).toMatch(/filesystem root/)
		expect(unsafeRootReason(realpathSync(homedir()))).toMatch(/home/)
		expect(unsafeRootReason(dirname(realpathSync(homedir())))).not.toBeNull()
		expect(unsafeRootReason(join(base, ".secret"))).toMatch(/hidden/)
		expect(unsafeRootReason(project)).toBeNull()
	})
})

describe("WorkspaceRoots", () => {
	it("resolves only model files inside an opened root", () => {
		const ws = new WorkspaceRoots()
		expect(ws.resolve(join(project, "order.bpmn"), "model").ok).toBe(false) // nothing opened yet
		expect(ws.open(project).ok).toBe(true)
		expect(ws.resolve(join(project, "order.bpmn"), "model")).toMatchObject({ ok: true })
		expect(ws.resolve(join(project, "new", "fresh.dmn"), "model").ok).toBe(true)
		expect(ws.resolve(join(project, "notes.txt"), "model")).toMatchObject({
			ok: false,
			status: 403,
		})
		expect(ws.resolve(join(outside, "secret.bpmn"), "model")).toMatchObject({
			ok: false,
			status: 403,
		})
	})

	it("refuses '..', relative paths and symlinks that leave the root", () => {
		const ws = new WorkspaceRoots()
		ws.open(project)
		expect(ws.resolve(`${project}/../outside/secret.bpmn`, "model")).toMatchObject({
			ok: false,
			status: 400,
		})
		expect(ws.resolve("order.bpmn", "model")).toMatchObject({ ok: false, status: 400 })
		expect(ws.resolve(join(project, "escape", "secret.bpmn"), "model")).toMatchObject({
			ok: false,
			status: 403,
		})
		expect(ws.resolve(join(project, "escape", "new.bpmn"), "model").ok).toBe(false)
		expect(ws.resolve(join(project, "dangling.bpmn"), "model").ok).toBe(false)
	})

	it("trusts configured roots, hidden or not, and folders inside them", () => {
		const ws = new WorkspaceRoots([configured])
		expect(ws.resolve(join(configured, "c.bpmn"), "model").ok).toBe(true)
		expect(ws.open(configured).ok).toBe(true)
		expect(new WorkspaceRoots().open(configured)).toMatchObject({ ok: false, status: 403 })
	})
})

describe("/fs routes", () => {
	let server: http.Server
	const studio = { origin: "https://studio.bpmnkit.com" }
	const q = (p: string) => encodeURIComponent(p)

	beforeAll(async () => {
		server = await listening(createProxyServer({ roots: [configured] }))
	})
	afterAll(() => close(server))

	it("refuses to open the home directory or a hidden folder as a root", async () => {
		const home = await send(server, "GET", `/fs/tree?root=${q(homedir())}`, studio)
		expect(home.status).toBe(403)
		expect(JSON.parse(home.body).error).toMatch(/--root/)
		expect((await send(server, "GET", "/fs/list?root=%2F", studio)).status).toBe(403)
		const hidden = await send(server, "GET", `/fs/tree?root=${q(join(base, ".secret"))}`, studio)
		expect(hidden.status).toBe(403)
	})

	it("reads outside every root → 403, even an absolute path to a model file", async () => {
		const r = await send(server, "GET", `/fs/read?path=${q(join(outside, "secret.bpmn"))}`, studio)
		expect(r.status).toBe(403)
		expect(r.body).not.toContain("<secret/>")
		const etc = await send(server, "GET", "/fs/read?path=%2Fetc%2Fpasswd", studio)
		expect(etc.status).toBe(403)
	})

	it("reads, writes, moves and deletes inside the root Studio names", async () => {
		const root = q(project)
		const read = await send(
			server,
			"GET",
			`/fs/read?path=${q(join(project, "order.bpmn"))}&root=${root}`,
			studio,
		)
		expect(read.status).toBe(200)
		expect(JSON.parse(read.body).content).toBe("<order/>")

		const target = join(project, "sub", "new.bpmn")
		const write = await send(
			server,
			"POST",
			"/fs/write",
			{ ...studio, "content-type": "application/json" },
			JSON.stringify({ path: target, content: "<new/>", root: project }),
		)
		expect(write.status).toBe(200)
		expect(readFileSync(target, "utf8")).toBe("<new/>")

		const meta = await send(
			server,
			"POST",
			"/fs/meta",
			studio,
			JSON.stringify({ path: target, meta: { id: "x", createdAt: 1 }, root: project }),
		)
		expect(meta.status).toBe(200)

		const moved = join(project, "moved.bpmn")
		const move = await send(
			server,
			"POST",
			"/fs/move",
			studio,
			JSON.stringify({ from: target, to: moved, root: project }),
		)
		expect(move.status).toBe(200)
		expect(existsSync(moved)).toBe(true)
		expect(existsSync(join(project, ".bpmnkit", "moved.bpmn.meta.json"))).toBe(true)

		const del = await send(server, "DELETE", `/fs/file?path=${q(moved)}&root=${root}`, studio)
		expect(del.status).toBe(200)
		expect(existsSync(moved)).toBe(false)
	})

	it("refuses writes, deletes and moves that leave the root", async () => {
		const escapeWrite = await send(
			server,
			"POST",
			"/fs/write",
			studio,
			JSON.stringify({
				path: join(project, "escape", "planted.bpmn"),
				content: "x",
				root: project,
			}),
		)
		expect(escapeWrite.status).toBe(403)
		expect(existsSync(join(outside, "planted.bpmn"))).toBe(false)

		const dangling = await send(
			server,
			"POST",
			"/fs/write",
			studio,
			JSON.stringify({ path: join(project, "dangling.bpmn"), content: "x", root: project }),
		)
		expect(dangling.status).toBe(403)
		expect(existsSync(join(outside, "created-by-write.bpmn"))).toBe(false)

		const shell = await send(
			server,
			"POST",
			"/fs/write",
			studio,
			JSON.stringify({ path: join(project, ".bashrc"), content: "x", root: project }),
		)
		expect(shell.status).toBe(403)

		const del = await send(
			server,
			"DELETE",
			`/fs/file?path=${q(join(outside, "secret.bpmn"))}&root=${q(project)}`,
			studio,
		)
		expect(del.status).toBe(403)
		expect(existsSync(join(outside, "secret.bpmn"))).toBe(true)

		const move = await send(
			server,
			"POST",
			"/fs/move",
			studio,
			JSON.stringify({
				from: join(outside, "secret.bpmn"),
				to: join(project, "stolen.bpmn"),
				root: project,
			}),
		)
		expect(move.status).toBe(403)

		const traversal = await send(
			server,
			"GET",
			`/fs/read?path=${q(`${project}/../outside/secret.bpmn`)}&root=${q(project)}`,
			studio,
		)
		expect(traversal.status).toBe(400)
	})

	it("serves configured roots without a client opening them", async () => {
		const r = await send(server, "GET", `/fs/read?path=${q(join(configured, "c.bpmn"))}`, studio)
		expect(r.status).toBe(200)
	})

	it("refuses /element-templates for a root the proxy would not open", async () => {
		const r = await send(server, "GET", `/element-templates?root=${q(homedir())}`, studio)
		expect(r.status).toBe(403)
		const ok = await send(server, "GET", `/element-templates?root=${q(project)}`, studio)
		expect(ok.status).toBe(200)
	})
})

describe("handleElementTemplates with workspace roots", () => {
	it("refuses a root outside the rules and a file reached through a symlink", async () => {
		const ws = new WorkspaceRoots()
		const home = await handleElementTemplates(new URLSearchParams({ root: homedir() }), ws)
		expect(home.status).toBe(403)
		const linked = await handleElementTemplates(
			new URLSearchParams({ root: project, file: "escape/secret.bpmn" }),
			ws,
		)
		expect(linked.status).toBe(403)
		const own = await handleElementTemplates(
			new URLSearchParams({ root: project, file: "order.bpmn" }),
			ws,
		)
		expect(own.status).toBe(200)
	})
})
