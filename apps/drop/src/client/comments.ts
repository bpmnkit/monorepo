/**
 * Review comments on the share page: markers on the canvas, a panel of
 * threads, a composer with @mention completion, and the in-page note that
 * tells you someone mentioned you.
 *
 * The server is the authority on every rule — who may edit what, how much, how
 * often; see `routes/comments.ts`. What this module decides is only how a
 * comment is shown, and that comes down to one question the server cannot
 * answer: is the element it was left on still in the diagram being looked at?
 */
import type { BpmnCanvas } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import {
	AUTHOR_HEADER,
	AUTHOR_STORAGE_KEY,
	type CommentView,
	MAX_COMMENT_CHARS,
	MAX_NAME_CHARS,
	NAME_STORAGE_KEY,
	authorIdFromToken,
	mentions,
	normaliseName,
} from "../shared/comments.js"

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * The ids a comment can be anchored to in a diagram: everything with a shape
 * or an edge on some plane. An element without one cannot carry a marker, and
 * one whose id is not here has been removed.
 */
export function drawnIds(defs: BpmnDefinitions): Set<string> {
	const ids = new Set<string>()
	for (const { plane } of defs.diagrams) {
		for (const s of plane.shapes) ids.add(s.bpmnElement)
		for (const e of plane.edges) ids.add(e.bpmnElement)
	}
	return ids
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * A comment body as nodes, with each confirmed `@mention` in a span of its own.
 * Text only — nothing a commenter typed is ever parsed as markup.
 */
export function renderBody(body: string, names: readonly string[]): DocumentFragment {
	const out = document.createDocumentFragment()
	if (names.length === 0) {
		out.append(body)
		return out
	}
	// Longest first, so "@Anna Lee" is not read as "@Anna" followed by " Lee".
	const alternatives = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp)
	const pattern = new RegExp(`@(?:${alternatives.join("|")})`, "giu")
	let last = 0
	for (const match of body.matchAll(pattern)) {
		const at = match.index ?? 0
		if (at > last) out.append(body.slice(last, at))
		const span = document.createElement("span")
		span.className = "cm-mention"
		span.textContent = match[0]
		out.append(span)
		last = at + match[0].length
	}
	if (last < body.length) out.append(body.slice(last))
	return out
}

/** What may follow an `@` while a name is still being typed. */
const PARTIAL_NAME = new RegExp(`^[\\p{L}\\p{N} ._'-]{0,${MAX_NAME_CHARS}}$`, "u")

/**
 * The mention being typed at the caret, if any: where its `@` is and what has
 * been typed after it. An `@` straight after a letter or digit is an address,
 * not a mention.
 */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
	const start = text.lastIndexOf("@", caret - 1)
	if (start < 0) return null
	const before = start > 0 ? text.charAt(start - 1) : ""
	if (before && /[\p{L}\p{N}]/u.test(before)) return null
	const query = text.slice(start + 1, caret)
	return PARTIAL_NAME.test(query) ? { start, query } : null
}

/** Names that complete `query`, own name excluded, at most six. */
export function suggestNames(
	names: Iterable<string>,
	query: string,
	own: string | null = null,
): string[] {
	const q = query.toLowerCase()
	const self = own?.toLowerCase()
	const seen = new Set<string>()
	const out: string[] = []
	for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
		const key = name.toLowerCase()
		if (key === self || seen.has(key) || !key.startsWith(q)) continue
		seen.add(key)
		out.push(name)
	}
	return out.slice(0, 6)
}

/** The names from `candidates` that `body` mentions — what the composer tells the server. */
export function mentionsIn(body: string, candidates: Iterable<string>): string[] {
	const lower = body.toLowerCase()
	return [...new Set(candidates)].filter((n) => lower.includes(`@${n.toLowerCase()}`))
}

export interface Thread {
	root: CommentView
	replies: CommentView[]
}

/**
 * A file's threads: open ones first, then resolved, each oldest first. A
 * deleted thread with nothing left under it is gone; one with live replies
 * stays, so the replies still read as answers to something.
 */
export function threadsFor(comments: Iterable<CommentView>, filename: string): Thread[] {
	const roots: CommentView[] = []
	const replies = new Map<string, CommentView[]>()
	for (const c of comments) {
		if (c.filename !== filename) continue
		if (c.parentId === null) roots.push(c)
		else if (c.deletedAt === null) {
			const list = replies.get(c.parentId) ?? []
			list.push(c)
			replies.set(c.parentId, list)
		}
	}
	const byTime = (a: CommentView, b: CommentView) => a.createdAt - b.createdAt
	return roots
		.map((root) => ({ root, replies: (replies.get(root.id) ?? []).sort(byTime) }))
		.filter((t) => t.root.deletedAt === null || t.replies.length > 0)
		.sort(
			(a, b) =>
				Number(a.root.resolvedAt !== null) - Number(b.root.resolvedAt !== null) ||
				byTime(a.root, b.root),
		)
}

/**
 * Where a thread sits. `removed` is an element id the shown diagram no longer
 * has; `null` ids mean "not a diagram", where every anchor still stands.
 */
export function anchorState(
	thread: Thread,
	ids: ReadonlySet<string> | null,
): "file" | "element" | "removed" {
	const id = thread.root.elementId
	if (id === null) return "file"
	return ids === null || ids.has(id) ? "element" : "removed"
}

// ── Storage ─────────────────────────────────────────────────────────────────
// Browser storage can be absent or throw (private windows, blocked site data);
// commenting still works for the page's lifetime, it just is not remembered.

function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key)
	} catch {
		return null
	}
}

function writeStored(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key)
		else localStorage.setItem(key, value)
	} catch {
		// not remembered — see above
	}
}

function authorTokens(): Record<string, string> {
	try {
		const parsed = JSON.parse(readStored(AUTHOR_STORAGE_KEY) ?? "{}") as unknown
		return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {}
	} catch {
		return {}
	}
}

function storeAuthorToken(shareId: string, token: string | null): void {
	const all = authorTokens()
	if (token === null) delete all[shareId]
	else all[shareId] = token
	writeStored(AUTHOR_STORAGE_KEY, JSON.stringify(all))
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className = "",
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag)
	if (className) node.className = className
	if (text !== undefined) node.textContent = text
	return node
}

function button(text: string, onClick: () => void, className = "hv-btn"): HTMLButtonElement {
	const b = el("button", className, text)
	b.type = "button"
	b.addEventListener("click", onClick)
	return b
}

function when(ms: number): string {
	return new Date(ms).toISOString().slice(0, 16).replace("T", " ")
}

// ── The panel ───────────────────────────────────────────────────────────────

/** Turnstile, as the page runs it. `token` is null when the deployment does not challenge. */
export type Challenge = (
	title: string,
) => Promise<
	{ ok: true; token: string | null } | { ok: false; reason: "cancelled" | "unavailable" }
>

export interface CommentsOptions {
	shareId: string
	/** Why this drop takes no comments (demo, pinned), or null when it does. */
	readOnly: string | null
	/** The topbar button that opens the panel; its label carries the open-thread count. */
	toggle: HTMLButtonElement
	panel: HTMLElement
	/** Where threads are listed. */
	list: HTMLElement
	/** Where the composer goes. */
	compose: HTMLElement
	/** The in-page mention notice: a box, its text, and its open button. */
	notice: { box: HTMLElement; text: HTMLElement; open: HTMLButtonElement }
	challenge: Challenge
	/** Tells the room this viewer's name, so others can mention it. */
	announceName(name: string): void
	/** Opening the panel closes whichever other side panel is open. */
	onOpen?(): void
}

interface FileRef {
	filename: string
	kind: string
}

export class CommentsPanel {
	private readonly comments = new Map<string, CommentView>()
	private readonly presentNames = new Set<string>()
	private file: FileRef | null = null
	private canvas: BpmnCanvas | null = null
	/** The shown diagram's ids, or null when the file is not a diagram. */
	private ids: Set<string> | null = null
	/** True while an older version is on the canvas: "removed" then means "not in it". */
	private preview = false
	private anchor: { id: string; label: string } | null = null
	private name: string | null = normaliseName(readStored(NAME_STORAGE_KEY))
	private token: string | null
	private authorId: string | null = null
	/** The thread a marker was clicked for, pulled into view on the next render. */
	private focus: string | null = null
	private replyTo: string | null = null
	private editing: string | null = null
	private pendingMention: string | null = null
	private status: HTMLElement | null = null

	constructor(private readonly opts: CommentsOptions) {
		const stored = authorTokens()[opts.shareId]
		this.token = typeof stored === "string" ? stored : null
		void this.refreshAuthorId()
		opts.toggle.addEventListener("click", () => (this.isOpen() ? this.close() : this.open()))
		opts.notice.open.addEventListener("click", () => {
			opts.notice.box.hidden = true
			const id = this.pendingMention
			const target = id ? this.comments.get(id) : undefined
			if (target) this.focus = target.parentId ?? target.id
			this.open()
		})
		this.renderCompose()
		this.updateToggle()
	}

	/** The name to announce to the room once the socket is open. */
	get displayName(): string | null {
		return this.name
	}

	isOpen(): boolean {
		return !this.opts.panel.hidden
	}

	open(): void {
		this.opts.onOpen?.()
		this.opts.panel.hidden = false
		this.render()
	}

	close(): void {
		this.opts.panel.hidden = true
		this.anchor = null
		this.canvas?.clearHighlights()
		this.renderCompose()
	}

	/** Loads what the drop already has. No notices: these were not said to you just now. */
	async load(): Promise<void> {
		try {
			const res = await fetch(`/drop/api/comments/${this.opts.shareId}`)
			if (!res.ok) return
			const { comments } = (await res.json()) as { comments: CommentView[] }
			for (const c of comments) this.comments.set(c.id, c)
			this.render()
		} catch {
			// Comments are an addition to the page; the diagram stands without them.
		}
	}

	/** A comment from the room — someone else's, or this tab's own echo. */
	receive(comment: CommentView): void {
		const isNew = !this.comments.has(comment.id)
		this.comments.set(comment.id, comment)
		if (isNew && comment.authorId !== this.authorId && mentions(comment, this.name)) {
			this.pendingMention = comment.id
			this.opts.notice.text.textContent = `${comment.authorName} mentioned you in a comment`
			this.opts.notice.box.hidden = false
		}
		this.render()
	}

	/** Who is here, by name, from the room's presence. */
	setPresentNames(names: readonly string[]): void {
		this.presentNames.clear()
		for (const n of names) this.presentNames.add(n)
	}

	/** The tab changed. */
	setFile(file: FileRef): void {
		this.file = file
		this.anchor = null
		this.focus = null
		this.replyTo = null
		this.editing = null
		this.canvas = null
		this.ids = null
		this.render()
		this.renderCompose()
	}

	/**
	 * A diagram was drawn, or redrawn — a new tab, a live edit, a version preview.
	 * Every redraw clears the canvas's overlays, which is why markers are placed
	 * here rather than once.
	 */
	showOn(canvas: BpmnCanvas | null, defs: BpmnDefinitions | null, preview = false): void {
		this.canvas = canvas
		this.ids = defs ? drawnIds(defs) : null
		this.preview = preview
		if (this.anchor && this.ids && !this.ids.has(this.anchor.id)) this.anchor = null
		this.render()
	}

	/** An element was clicked while the panel was open: that is what the next comment is on. */
	pick(id: string, label: string): void {
		if (this.opts.readOnly || this.file?.kind !== "bpmn") return
		this.anchor = { id, label }
		this.canvas?.clearHighlights()
		this.canvas?.highlight([id], "changed")
		this.renderCompose()
		this.opts.compose.querySelector("textarea")?.focus()
	}

	// ── Rendering ──────────────────────────────────────────────────────────────

	private render(): void {
		this.renderMarkers()
		this.updateToggle()
		if (!this.isOpen()) return
		const list = this.opts.list
		// A live update redraws the list; a half-written reply must survive it.
		const draftBox = list.querySelector<HTMLTextAreaElement>(".cm-text")
		const draft = draftBox
			? { text: draftBox.value, focused: draftBox === document.activeElement }
			: null
		list.replaceChildren()
		const threads = this.file ? threadsFor(this.comments.values(), this.file.filename) : []
		if (threads.length === 0) {
			list.append(
				el(
					"div",
					"ai-msg",
					this.file?.kind === "bpmn"
						? "No comments yet. Click an element to comment on it, or write one for the whole file."
						: "No comments on this file yet.",
				),
			)
			return
		}
		let focused: HTMLElement | null = null
		for (const thread of threads) {
			const node = this.threadNode(thread)
			const focus = this.focus
			if (focus !== null && (thread.root.id === focus || thread.root.elementId === focus)) {
				node.classList.add("focus")
				focused ??= node
			}
			list.append(node)
		}
		const box = list.querySelector<HTMLTextAreaElement>(".cm-text")
		if (box && draft) {
			box.value = draft.text
			if (draft.focused) box.focus()
		}
		focused?.scrollIntoView({ block: "nearest" })
		this.focus = null
	}

	/** One square badge per element with open threads, counting them. */
	private renderMarkers(): void {
		const canvas = this.canvas
		if (!canvas || !this.ids || !this.file) return
		canvas.overlays.remove({ type: "comment" })
		const counts = new Map<string, number>()
		for (const t of threadsFor(this.comments.values(), this.file.filename)) {
			const id = t.root.elementId
			if (id && t.root.resolvedAt === null && this.ids.has(id)) {
				counts.set(id, (counts.get(id) ?? 0) + 1)
			}
		}
		for (const [id, n] of counts) {
			const badge = button(
				String(n),
				() => {
					this.focus = id
					this.open()
				},
				"cm-marker",
			)
			badge.title = `${n} open comment${n === 1 ? "" : "s"}`
			badge.setAttribute("aria-label", badge.title)
			canvas.overlays.add(id, {
				position: { top: -12, right: -12 },
				html: badge,
				scale: false,
				type: "comment",
			})
		}
	}

	private updateToggle(): void {
		let open = 0
		for (const c of this.comments.values()) {
			if (c.parentId === null && c.deletedAt === null && c.resolvedAt === null) open += 1
		}
		this.opts.toggle.textContent = open > 0 ? `Comments ${open}` : "Comments"
	}

	private anchorLabel(thread: Thread): string {
		const { elementId, elementLabel } = thread.root
		const named = elementLabel ?? elementId ?? ""
		switch (anchorState(thread, this.ids)) {
			case "file":
				return "On the file"
			case "element":
				return `On ${named}`
			case "removed":
				return this.preview ? `Not in this version · ${named}` : `On a removed element · ${named}`
		}
	}

	private threadNode(thread: Thread): HTMLElement {
		const { root } = thread
		const box = el("div", root.resolvedAt === null ? "cm-thread" : "cm-thread resolved")
		const state = anchorState(thread, this.ids)
		const head = el(
			"div",
			`cm-anchor${state === "removed" ? " removed" : ""}`,
			this.anchorLabel(thread),
		)
		box.append(head)
		if (root.resolvedAt !== null) {
			box.append(el("div", "cm-resolved", `Resolved by ${root.resolvedBy ?? "someone"}`))
		}
		const elementId = root.elementId
		if (state === "element" && elementId) {
			box.addEventListener("mouseenter", () => this.canvas?.highlight([elementId], "changed"))
			box.addEventListener("mouseleave", () => this.canvas?.clearHighlights())
		}

		box.append(this.commentNode(root))
		for (const reply of thread.replies) box.append(this.commentNode(reply))

		if (this.opts.readOnly) return box
		const actions = el("div", "hv-actions")
		if (root.deletedAt === null) {
			actions.append(
				button("Reply", () => {
					this.replyTo = this.replyTo === root.id ? null : root.id
					this.render()
				}),
			)
		}
		actions.append(
			button(root.resolvedAt === null ? "Resolve" : "Reopen", () => {
				void this.resolve(root, root.resolvedAt === null)
			}),
		)
		box.append(actions)
		if (this.replyTo === root.id) {
			box.append(
				this.textBox("", "Reply", async (body, mentioned) => {
					const ok = await this.create({ parentId: root.id, body, mentions: mentioned })
					if (ok) this.replyTo = null
					return ok
				}),
			)
		}
		return box
	}

	private commentNode(c: CommentView): HTMLElement {
		const node = el("div", c.parentId === null ? "cm-comment" : "cm-comment reply")
		const meta = el("div", "cm-meta")
		meta.append(el("span", "cm-author", c.authorName), el("span", "cm-when", when(c.createdAt)))
		if (c.editedAt !== null && c.deletedAt === null) meta.append(el("span", "cm-when", "edited"))
		node.append(meta)

		if (c.deletedAt !== null) {
			node.append(el("div", "cm-body deleted", "Comment deleted"))
			return node
		}
		if (this.editing === c.id) {
			node.append(
				this.textBox(c.body, "Save", async (body, mentioned) => {
					const ok = await this.patch(c, { body, mentions: mentioned })
					if (ok) this.editing = null
					return ok
				}),
			)
			return node
		}
		const body = el("div", "cm-body")
		body.append(renderBody(c.body, c.mentions))
		node.append(body)

		if (c.authorId === this.authorId && !this.opts.readOnly) {
			const own = el("div", "cm-own")
			own.append(
				button(
					"Edit",
					() => {
						this.editing = c.id
						this.render()
					},
					"cm-link",
				),
				button("Delete", () => void this.remove(c), "cm-link"),
			)
			node.append(own)
		}
		return node
	}

	private renderCompose(): void {
		const root = this.opts.compose
		root.replaceChildren()
		if (this.opts.readOnly) {
			root.append(el("div", "cm-note", `Comments are read-only here: ${this.opts.readOnly}.`))
			return
		}

		const anchorRow = el("div", "cm-target")
		if (this.anchor) {
			anchorRow.append(el("span", "", `On ${this.anchor.label}`))
			anchorRow.append(
				button(
					"×",
					() => {
						this.anchor = null
						this.canvas?.clearHighlights()
						this.renderCompose()
					},
					"ai-x",
				),
			)
		} else {
			anchorRow.textContent =
				this.file?.kind === "bpmn" ? "On the whole file — or click an element" : "On the whole file"
		}

		const nameInput = el("input", "cm-name")
		nameInput.placeholder = "Your name"
		nameInput.maxLength = MAX_NAME_CHARS
		nameInput.value = this.name ?? ""
		nameInput.setAttribute("aria-label", "Your name")
		nameInput.addEventListener("change", () => this.setName(nameInput.value))

		const box = this.textBox("", "Comment", (body, mentioned) =>
			this.create({
				filename: this.file?.filename,
				...(this.anchor ? { elementId: this.anchor.id, elementLabel: this.anchor.label } : {}),
				body,
				mentions: mentioned,
			}),
		)
		this.status = el("div", "cm-status")
		root.append(anchorRow, nameInput, box, this.status)
	}

	/**
	 * A text box that completes `@names`, with one button. `submit` answers
	 * whether it worked; the box is cleared only when it did.
	 */
	private textBox(
		initial: string,
		label: string,
		submit: (body: string, mentioned: string[]) => Promise<boolean>,
	): HTMLElement {
		const wrap = el("div", "cm-box")
		const area = el("textarea", "cm-text")
		area.rows = 3
		area.maxLength = MAX_COMMENT_CHARS
		area.value = initial
		area.placeholder = "Write a comment — @ to mention someone"
		area.setAttribute("aria-label", label === "Comment" ? "New comment" : label)
		const menu = el("div", "cm-suggest")
		menu.hidden = true
		menu.setAttribute("role", "listbox")
		let options: string[] = []
		let active = 0

		const complete = (name: string) => {
			const at = mentionAt(area.value, area.selectionStart)
			if (!at) return
			const end = at.start + 1 + at.query.length
			area.value = `${area.value.slice(0, at.start)}@${name} ${area.value.slice(end)}`
			const caret = at.start + name.length + 2
			area.setSelectionRange(caret, caret)
			menu.hidden = true
			area.focus()
		}
		const refresh = () => {
			const at = mentionAt(area.value, area.selectionStart)
			options = at ? suggestNames(this.knownNames(), at.query, this.name) : []
			active = 0
			menu.replaceChildren(
				...options.map((name, i) => {
					const b = button(`@${name}`, () => complete(name), i === 0 ? "active" : "")
					b.setAttribute("role", "option")
					// Keep the textarea's caret: a mousedown would move focus first.
					b.addEventListener("mousedown", (e) => e.preventDefault())
					return b
				}),
			)
			menu.hidden = options.length === 0
		}
		area.addEventListener("input", refresh)
		area.addEventListener("click", refresh)
		area.addEventListener("keydown", (e) => {
			if (menu.hidden) return
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault()
				active = (active + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length
				menu
					.querySelectorAll("button")
					.forEach((b, i) => b.classList.toggle("active", i === active))
			} else if (e.key === "Enter" || e.key === "Tab") {
				const pick = options[active]
				if (pick) {
					e.preventDefault()
					complete(pick)
				}
			} else if (e.key === "Escape") {
				menu.hidden = true
			}
		})

		const go = button(
			label,
			async () => {
				const body = area.value.trim()
				if (!body) return
				go.disabled = true
				const ok = await submit(body, mentionsIn(body, this.knownNames()))
				go.disabled = false
				if (ok) area.value = ""
			},
			"hv-btn hv-btn--go",
		)
		const row = el("div", "cm-actions")
		row.append(go)
		wrap.append(area, menu, row)
		return wrap
	}

	/** Everyone this drop has seen: who is here now, and who has commented. */
	private knownNames(): Set<string> {
		const names = new Set(this.presentNames)
		for (const c of this.comments.values()) names.add(c.authorName)
		return names
	}

	private setName(raw: string): boolean {
		const name = normaliseName(raw)
		if (!name) {
			this.say("A name is 1–40 letters, digits, spaces or . _ ' -")
			return false
		}
		this.name = name
		writeStored(NAME_STORAGE_KEY, name)
		this.opts.announceName(name)
		this.say("")
		return true
	}

	private say(text: string): void {
		if (this.status) this.status.textContent = text
	}

	private async refreshAuthorId(): Promise<void> {
		this.authorId = this.token ? await authorIdFromToken(this.token) : null
		this.render()
	}

	// ── Writes ─────────────────────────────────────────────────────────────────

	private async create(payload: Record<string, unknown>, retried = false): Promise<boolean> {
		const nameInput = this.opts.compose.querySelector<HTMLInputElement>(".cm-name")
		if (nameInput && nameInput.value !== (this.name ?? "") && !this.setName(nameInput.value)) {
			return false
		}
		if (!this.name) {
			this.say("Add your name first — it is what others see and can @mention.")
			nameInput?.focus()
			return false
		}
		const body: Record<string, unknown> = { ...payload, name: this.name }
		// The first comment from this browser in this drop is the one challenge;
		// the key it earns means the next ones are not asked again.
		if (!this.token) {
			const verified = await this.opts.challenge("One check before you comment")
			if (!verified.ok) {
				if (verified.reason === "unavailable") {
					this.say("Couldn't load the human check. Reload, or allow challenges.cloudflare.com.")
				}
				return false
			}
			if (verified.token) body.token = verified.token
		}
		const res = await this.send("POST", "", body)
		if (res.code === "unknown-author" && !retried) {
			this.forgetToken()
			return this.create(payload, true)
		}
		if (!res.ok) return false
		if (res.authorToken) {
			this.token = res.authorToken
			storeAuthorToken(this.opts.shareId, res.authorToken)
			await this.refreshAuthorId()
		}
		this.anchor = null
		this.canvas?.clearHighlights()
		this.renderCompose()
		return true
	}

	private async patch(c: CommentView, payload: Record<string, unknown>): Promise<boolean> {
		return (await this.send("PATCH", `/${c.id}`, payload)).ok
	}

	private async resolve(root: CommentView, resolved: boolean): Promise<void> {
		if (!this.token) {
			this.say("Leave a comment on this drop first — resolving needs the key it gives you.")
			return
		}
		if (resolved && !this.name) {
			this.say("Add your name first — a resolved thread says who resolved it.")
			return
		}
		await this.patch(root, { resolved, name: this.name })
	}

	private async remove(c: CommentView): Promise<void> {
		if (!confirm("Delete this comment?")) return
		await this.send("DELETE", `/${c.id}`)
	}

	private forgetToken(): void {
		this.token = null
		this.authorId = null
		storeAuthorToken(this.opts.shareId, null)
	}

	/** One request; the comment it answers is applied here, not left for the room's echo. */
	private async send(
		method: "POST" | "PATCH" | "DELETE",
		path: string,
		payload?: Record<string, unknown>,
	): Promise<{ ok: boolean; code?: string; authorToken?: string }> {
		const headers: Record<string, string> = { "Content-Type": "application/json" }
		if (this.token) headers[AUTHOR_HEADER] = this.token
		try {
			const res = await fetch(`/drop/api/comments/${this.opts.shareId}${path}`, {
				method,
				headers,
				...(payload ? { body: JSON.stringify(payload) } : {}),
			})
			const answer = (await res.json().catch(() => null)) as {
				comment?: CommentView
				authorToken?: string
				error?: string
				code?: string
			} | null
			if (!res.ok || !answer?.comment) {
				if (answer?.code === "unknown-author" && method !== "POST") {
					this.forgetToken()
					this.say("This browser no longer holds the key to your comments on this drop.")
				} else if (answer?.code !== "unknown-author") {
					this.say(answer?.error ?? "That did not go through. Please try again.")
				}
				return { ok: false, code: answer?.code }
			}
			this.say("")
			this.comments.set(answer.comment.id, answer.comment)
			this.render()
			return { ok: true, authorToken: answer.authorToken }
		} catch {
			this.say("That did not go through. Check your connection and try again.")
			return { ok: false }
		}
	}
}
