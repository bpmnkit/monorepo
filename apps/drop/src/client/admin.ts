import { injectUiStyles } from "@bpmnkit/ui"

injectUiStyles()

interface Report {
	id: number
	drop_id: string
	reason: string
	details: string | null
	created_at: number
	drop_exists: number
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const msg = $("msg")
const reportsBox = $("reports")

const token = () => $<HTMLInputElement>("token").value.trim()

async function api(path: string, init: RequestInit = {}): Promise<Response> {
	return fetch(`/drop/api/admin${path}`, {
		...init,
		headers: { Authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
	})
}

function esc(s: string): string {
	const d = document.createElement("div")
	d.textContent = s
	return d.innerHTML
}

function say(text: string): void {
	msg.textContent = text
}

async function loadReports(): Promise<void> {
	say("Loading…")
	const res = await api("/reports?status=open")
	if (!res.ok) {
		say(res.status === 401 ? "Invalid token." : `Error ${res.status}`)
		return
	}
	const { reports } = (await res.json()) as { reports: Report[] }
	say(`${reports.length} open report(s).`)
	if (reports.length === 0) {
		reportsBox.innerHTML = ""
		return
	}
	reportsBox.innerHTML = `<table class="admin-table"><thead><tr><th>Drop</th><th>Reason</th><th>Details</th><th>Actions</th></tr></thead><tbody>${reports
		.map(
			(r) => `<tr>
<td><a href="/drop/${esc(r.drop_id)}" target="_blank">${esc(r.drop_id)}</a>${r.drop_exists ? "" : " (deleted)"}</td>
<td>${esc(r.reason)}</td>
<td>${esc(r.details ?? "")}</td>
<td>
<button class="btn" data-act="del" data-id="${esc(r.drop_id)}">Delete</button>
<button class="btn" data-act="ban" data-id="${esc(r.drop_id)}">Delete+ban</button>
<button class="btn" data-act="dismiss" data-report="${r.id}">Dismiss</button>
</td></tr>`,
		)
		.join("")}</tbody></table>`
}

async function deleteDrop(shareId: string, ban: boolean): Promise<void> {
	if (!confirm(`${ban ? "Delete and ban" : "Delete"} drop ${shareId}?`)) return
	const res = await api(`/drops/${shareId}${ban ? "?ban=1" : ""}`, { method: "DELETE" })
	say(
		res.ok ? `Deleted ${shareId}${ban ? " and banned its content." : "."}` : `Error ${res.status}`,
	)
	if (res.ok) void loadReports()
}

async function dismiss(reportId: string): Promise<void> {
	const res = await api(`/reports/${reportId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ status: "dismissed" }),
	})
	say(res.ok ? "Dismissed." : `Error ${res.status}`)
	if (res.ok) void loadReports()
}

$("loadBtn").addEventListener("click", () => void loadReports())
$("delBtn").addEventListener("click", () => {
	const id = $<HTMLInputElement>("manualId").value.trim()
	if (id) void deleteDrop(id, false)
})
$("banBtn").addEventListener("click", () => {
	const id = $<HTMLInputElement>("manualId").value.trim()
	if (id) void deleteDrop(id, true)
})
reportsBox.addEventListener("click", (e) => {
	const btn = (e.target as HTMLElement).closest("button")
	if (!btn) return
	const act = btn.dataset.act
	if (act === "del") void deleteDrop(btn.dataset.id as string, false)
	else if (act === "ban") void deleteDrop(btn.dataset.id as string, true)
	else if (act === "dismiss") void dismiss(btn.dataset.report as string)
})
