import { UI_TOKENS_CSS } from "@bpmnkit/ui"
import type { ReportReason } from "../shared/constants.js"
import {
	ACCEPTED_EXTENSIONS,
	MAX_FILES_PER_DROP,
	MAX_FILE_BYTES,
	REPORT_REASONS,
} from "../shared/constants.js"
import type { DropRow, FileInfo } from "./db.js"
import { escapeHtml, jsonForScript } from "./http.js"

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1a56db"/><path d="M9 16h14M16 9v14" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
)}`

const PAGE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
	background:var(--bpmnkit-bg,#f4f4f8);color:var(--bpmnkit-fg,#1a1a2e);
	font-family:var(--bpmnkit-font,system-ui,sans-serif);line-height:1.55;
	-webkit-font-smoothing:antialiased;
}
a{color:var(--bpmnkit-accent,#1a56db);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:960px;margin:0 auto;padding:24px 20px}
.topbar{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--bpmnkit-border,#d0d0e8);background:var(--bpmnkit-surface,#fff)}
.topbar .brand{font-weight:700;letter-spacing:-.01em}
.topbar .brand span{color:var(--bpmnkit-accent,#1a56db)}
.topbar .spacer{flex:1}
.topbar .muted{color:var(--bpmnkit-fg-muted,#6666a0);font-size:14px}
h1{font-size:28px;line-height:1.2;margin:0 0 8px}
.lead{color:var(--bpmnkit-fg-muted,#6666a0);margin:0 0 24px}
.card{background:var(--bpmnkit-surface,#fff);border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:14px;padding:20px}
.dropzone{
	border:2px dashed var(--bpmnkit-border,#d0d0e8);border-radius:16px;background:var(--bpmnkit-surface,#fff);
	padding:52px 24px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;
}
.dropzone.drag{border-color:var(--bpmnkit-accent,#1a56db);background:var(--bpmnkit-accent-subtle,rgba(26,86,219,.12))}
.dropzone h2{margin:0 0 6px;font-size:20px}
.dropzone p{margin:0;color:var(--bpmnkit-fg-muted,#6666a0);font-size:14px}
.btn{
	display:inline-flex;align-items:center;gap:6px;border:1px solid var(--bpmnkit-border,#d0d0e8);
	background:var(--bpmnkit-surface-2,#eeeef8);color:var(--bpmnkit-fg,#1a1a2e);
	border-radius:9px;padding:8px 14px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;
}
.btn:hover{text-decoration:none;border-color:var(--bpmnkit-accent,#1a56db)}
.btn.primary{background:var(--bpmnkit-accent,#1a56db);color:#fff;border-color:transparent}
.notice{font-size:13px;color:var(--bpmnkit-fg-muted,#6666a0);margin-top:14px}
.badge{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--bpmnkit-accent-subtle,rgba(26,86,219,.12));color:var(--bpmnkit-accent,#1a56db);text-transform:uppercase;letter-spacing:.03em}
.errors{margin-top:16px;color:var(--bpmnkit-danger,#dc2626);font-size:14px}
.errors ul{margin:6px 0 0;padding-left:18px}
.hidden{display:none}
.result .link-row{display:flex;gap:8px;align-items:center;margin:12px 0}
.result input{flex:1;font-family:var(--bpmnkit-font-mono,monospace);font-size:14px;padding:8px 10px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:9px;background:var(--bpmnkit-bg,#f4f4f8);color:var(--bpmnkit-fg,#1a1a2e)}
.result iframe{width:100%;height:440px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:12px;margin-top:12px;background:var(--bpmnkit-surface,#fff)}
/* share */
.share-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.share-head h1{font-size:22px;margin:0}
.meta{color:var(--bpmnkit-fg-muted,#6666a0);font-size:13px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.dot{opacity:.5}
#presence{color:var(--bpmnkit-teal,#0d9488);font-weight:600}
.tabs{display:flex;gap:4px;flex-wrap:wrap;margin:16px 0 0;border-bottom:1px solid var(--bpmnkit-border,#d0d0e8)}
.tab{padding:8px 14px;border:1px solid transparent;border-bottom:none;border-radius:9px 9px 0 0;cursor:pointer;font-size:14px;color:var(--bpmnkit-fg-muted,#6666a0);background:none}
.tab.active{background:var(--bpmnkit-surface,#fff);border-color:var(--bpmnkit-border,#d0d0e8);color:var(--bpmnkit-fg,#1a1a2e);font-weight:600}
.tab .k{font-size:10px;opacity:.7;margin-left:6px;text-transform:uppercase}
.viewer{height:70vh;min-height:420px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-top:none;border-radius:0 0 12px 12px;background:var(--bpmnkit-surface,#fff);overflow:auto;position:relative}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.viewer-msg{padding:24px;color:var(--bpmnkit-fg-muted,#6666a0);font-family:var(--bpmnkit-font-mono,monospace);font-size:13px;white-space:pre-wrap;word-break:break-word}
footer{margin-top:32px;padding-top:16px;border-top:1px solid var(--bpmnkit-border,#d0d0e8);color:var(--bpmnkit-fg-muted,#6666a0);font-size:13px;display:flex;gap:14px;flex-wrap:wrap}
.prose p{margin:0 0 14px}
.prose h2{font-size:18px;margin:24px 0 8px}
dialog{border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:14px;padding:20px;max-width:420px;width:92%;background:var(--bpmnkit-surface,#fff);color:var(--bpmnkit-fg,#1a1a2e)}
dialog::backdrop{background:rgba(0,0,0,.4)}
dialog label{display:block;font-size:14px;font-weight:600;margin:12px 0 4px}
dialog select,dialog textarea,dialog input{width:100%;padding:8px 10px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:9px;background:var(--bpmnkit-bg,#f4f4f8);color:var(--bpmnkit-fg,#1a1a2e);font:inherit}
.admin-table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
.admin-table th,.admin-table td{text-align:left;padding:8px;border-bottom:1px solid var(--bpmnkit-border,#d0d0e8);vertical-align:top}
`

interface ShellOptions {
	title: string
	description: string
	main: string
	bootstrap?: { id: string; data: unknown }
	scriptSrc?: string
	noindex?: boolean
}

function shell(opts: ShellOptions): string {
	const boot = opts.bootstrap
		? `<script type="application/json" id="${opts.bootstrap.id}">${jsonForScript(opts.bootstrap.data)}</script>`
		: ""
	const script = opts.scriptSrc ? `<script type="module" src="${opts.scriptSrc}"></script>` : ""
	const robots = opts.noindex ? `<meta name="robots" content="noindex">` : ""
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.description)}">
${robots}
<link rel="icon" href="${FAVICON}">
<style>${UI_TOKENS_CSS}</style>
<style>${PAGE_CSS}</style>
</head>
<body>
<header class="topbar"><a class="brand" href="/drop">BPMN Kit <span>Drop</span></a><div class="spacer"></div><span class="muted">Share BPMN, DMN &amp; Forms</span></header>
${opts.main}
${boot}
${script}
</body>
</html>`
}

/** The upload landing page. */
export function dropPage(tosVersion: string): string {
	const accept = ACCEPTED_EXTENSIONS.join(",")
	const kb = Math.round(MAX_FILE_BYTES / 1000)
	const main = `<main class="wrap">
<h1>Drop a diagram, get a link.</h1>
<p class="lead">Drop your BPMN, DMN, or Camunda Form files below. We render them in the browser and give you a short link to share — no account needed.</p>
<div class="card">
	<div id="dropzone" class="dropzone" role="button" tabindex="0" aria-label="Choose or drop files">
		<h2>Drop files here</h2>
		<p>or click to choose · up to ${MAX_FILES_PER_DROP} files · ${kb} KB each</p>
	</div>
	<input id="fileInput" type="file" class="hidden" multiple accept="${accept}">
	<div id="errors" class="errors hidden"></div>
	<p class="notice">By uploading you agree to the <a href="/drop/terms">Terms of Use</a> and acknowledge the <a href="/drop/privacy">Privacy Policy</a>. Shared links are public to anyone who has them.</p>
</div>
<div id="result" class="card result hidden" style="margin-top:16px">
	<strong>Your drop is ready</strong>
	<div class="link-row"><input id="shareUrl" readonly><button id="copyBtn" class="btn">Copy</button><a id="openBtn" class="btn primary" href="#">Open</a></div>
	<iframe id="preview" title="Preview"></iframe>
</div>
<footer><a href="/drop/terms">Terms</a><a href="/drop/privacy">Privacy</a><a href="https://github.com/bpmnkit/monorepo">GitHub</a></footer>
</main>`
	return shell({
		title: "BPMN Kit Drop — share BPMN, DMN & Form files",
		description:
			"Drop a BPMN, DMN, or Camunda Form file and get a short shareable link that renders it in the browser.",
		main,
		bootstrap: { id: "drop-config", data: { tosVersion } },
		scriptSrc: "/drop/assets/drop.js",
	})
}

function primaryIndex(files: FileInfo[]): number {
	const order = ["bpmn", "dmn", "form"] as const
	for (const kind of order) {
		const i = files.findIndex((f) => f.kind === kind)
		if (i >= 0) return i
	}
	return 0
}

/** The read-only share/viewer page for a stored drop. */
export function sharePage(shareId: string, drop: DropRow, files: FileInfo[]): string {
	const primary = primaryIndex(files)
	const title = files[primary]?.name || files[primary]?.filename || "Shared diagram"
	const created = new Date(drop.created_at).toISOString().slice(0, 10)
	const badges = [...new Set(files.map((f) => f.kind))]
		.map((k) => `<span class="badge">${k}</span>`)
		.join(" ")
	const tabs =
		files.length > 1
			? `<div class="tabs" role="tablist">${files
					.map(
						(f, i) =>
							`<button class="tab${i === primary ? " active" : ""}" role="tab" data-index="${i}">${escapeHtml(f.name || f.filename)}<span class="k">${f.kind}</span></button>`,
					)
					.join("")}</div>`
			: ""

	const main = `<main class="wrap">
<div class="share-head"><h1>${escapeHtml(title)}</h1>${badges}</div>
<div class="meta">
	<span>Created ${created}</span><span class="dot">·</span>
	<span><span id="viewCount">${drop.view_count}</span> views</span><span class="dot">·</span>
	<span id="presence" hidden>0 viewing</span>
</div>
${tabs}
<div id="viewer" class="viewer"><div class="viewer-msg">Loading…</div></div>
<div class="actions">
	<a id="dlOriginal" class="btn" href="#" download>Download original</a>
	<a id="dlJson" class="btn" href="#" download>Download JSON</a>
	<button id="copyLink" class="btn">Copy link</button>
</div>
<footer><button id="reportBtn" class="btn" style="padding:4px 10px">Report abuse</button><a href="/drop/terms">Terms</a><a href="/drop/privacy">Privacy</a><a href="/drop">New drop</a></footer>
${reportDialog()}
</main>`

	return shell({
		title: `${title} — BPMN Kit Drop`,
		description: `A shared ${files[primary]?.kind ?? "BPMN"} diagram on BPMN Kit Drop.`,
		main,
		noindex: true,
		bootstrap: {
			id: "drop-data",
			data: {
				shareId,
				files: files.map((f) => ({
					filename: f.filename,
					kind: f.kind,
					name: f.name,
					decisionIds: f.meta.decisionIds ?? [],
				})),
				primaryIndex: primary,
			},
		},
		scriptSrc: "/drop/assets/viewer.js",
	})
}

function reportDialog(): string {
	const options = REPORT_REASONS.map(
		(r: ReportReason) => `<option value="${r}">${r.replace("-", " ")}</option>`,
	).join("")
	return `<dialog id="reportDialog">
<form method="dialog">
	<strong>Report this drop</strong>
	<label for="reportReason">Reason</label>
	<select id="reportReason">${options}</select>
	<label for="reportDetails">Details (optional)</label>
	<textarea id="reportDetails" rows="3"></textarea>
	<div class="actions" style="margin-top:16px">
		<button value="cancel" class="btn">Cancel</button>
		<button id="reportSubmit" value="submit" class="btn primary">Submit report</button>
	</div>
</form>
</dialog>`
}

/** The token-gated moderation page. */
export function adminPage(): string {
	const main = `<main class="wrap">
<h1>Drop moderation</h1>
<p class="lead">Paste the operator token to review reports and delete drops. The token stays in this tab only.</p>
<div class="card">
	<label for="token" style="font-weight:600;font-size:14px">Admin token</label>
	<div class="link-row"><input id="token" type="password" style="flex:1;padding:8px 10px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:9px"><button id="loadBtn" class="btn primary">Load reports</button></div>
	<div class="link-row"><input id="manualId" placeholder="shareId to delete directly" style="flex:1;padding:8px 10px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:9px"><button id="delBtn" class="btn">Delete</button><button id="banBtn" class="btn">Delete + ban</button></div>
	<div id="msg" class="notice"></div>
	<div id="reports"></div>
</div>
</main>`
	return shell({
		title: "Drop moderation",
		description: "Operator moderation for BPMN Kit Drop.",
		main,
		noindex: true,
		scriptSrc: "/drop/assets/admin.js",
	})
}

/** Terms of Use / Privacy Policy content. */
export function policyPage(kind: "terms" | "privacy", tosVersion: string): string {
	const body = kind === "terms" ? TERMS_HTML : PRIVACY_HTML
	const title = kind === "terms" ? "Terms of Use" : "Privacy Policy"
	const main = `<main class="wrap prose">
<h1>${title}</h1>
<p class="lead">BPMN Kit Drop · version ${escapeHtml(tosVersion)}</p>
${body}
<footer><a href="/drop">Back to Drop</a><a href="/drop/terms">Terms</a><a href="/drop/privacy">Privacy</a></footer>
</main>`
	return shell({ title: `${title} — BPMN Kit Drop`, description: title, main })
}

/** A friendly 404 for unknown or expired share ids. */
export function notFoundPage(): string {
	const main = `<main class="wrap"><h1>Not found</h1><p class="lead">This drop doesn't exist, or it has expired. Drops are kept for 90 days after they were last viewed.</p><a class="btn primary" href="/drop">Create a new drop</a></main>`
	return shell({
		title: "Not found — BPMN Kit Drop",
		description: "Drop not found.",
		main,
		noindex: true,
	})
}

const TERMS_HTML = `<div class="prose">
<p>BPMN Kit Drop is a free tool for sharing BPMN, DMN, and Camunda Form files. By uploading a file you confirm you have the right to share its contents and agree to these terms.</p>
<h2>Acceptable use</h2>
<p>Do not upload content that is unlawful, infringes others' rights, contains malware, or includes sensitive personal data you are not authorized to share. Only BPMN, DMN, and Form files are accepted; other content is rejected on upload.</p>
<h2>Public links</h2>
<p>Every drop is reachable by anyone who has its link. Links are unguessable but are not otherwise access-controlled. Do not upload confidential material.</p>
<h2>Retention</h2>
<p>Drops are stored for 90 days after they were last viewed, then deleted automatically. There are no accounts and no guarantee of availability.</p>
<h2>Moderation</h2>
<p>The operator may remove any drop at their discretion, including in response to an abuse report. Content removed for a policy violation may be blocked from re-upload.</p>
<h2>No warranty</h2>
<p>The service is provided "as is", without warranty of any kind. This document is not legal advice.</p>
</div>`

const PRIVACY_HTML = `<div class="prose">
<p>This policy explains what BPMN Kit Drop stores and why.</p>
<h2>What we store</h2>
<p>For each drop we store the files you upload, a converted JSON representation of each file, and derived metadata (file names, element counts, timestamps, a content hash). Data is stored in Cloudflare D1.</p>
<h2>What we don't store</h2>
<p>There are no accounts, logins, or tracking cookies. We do not store your IP address with your drop. When you submit an abuse report we store a salted, one-way hash of your IP address solely to rate-limit reports and collapse duplicates.</p>
<h2>Retention</h2>
<p>Drops are deleted automatically 90 days after they were last viewed, and immediately if removed by the operator.</p>
<h2>Sharing</h2>
<p>Anyone with a drop's link can view and download its files. We do not sell or share data with third parties.</p>
</div>`
