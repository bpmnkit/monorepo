import { UI_TOKENS_CSS } from "@bpmnkit/ui"
import type { ReportReason } from "../shared/constants.js"
import {
	ACCEPTED_EXTENSIONS,
	DEMO_SHARE_ID,
	MAX_FILES_PER_DROP,
	MAX_FILE_BYTES,
	REPORT_REASONS,
} from "../shared/constants.js"
import type { DropRow, FileInfo } from "./db.js"
import { escapeHtml, jsonForScript } from "./http.js"

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1a56db"/><path d="M9 16h14M16 9v14" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
)}`

// Inline stroke icons (currentColor), 24×24 viewBox.
const svg = (body: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
const ICON = {
	spark: svg(`<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>`),
	upload: svg(
		`<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>`,
	),
	browser: svg(
		`<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>`,
	),
	bolt: svg(`<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>`),
	eye: svg(
		`<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/>`,
	),
	clock: svg(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`),
}

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
/* drop landing — hero */
.hero{position:relative;overflow:hidden;min-height:calc(100vh - 51px)}
.hero-bg{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(55% 45% at 12% -5%,var(--bpmnkit-accent-subtle,rgba(26,86,219,.14)),transparent 70%),radial-gradient(45% 40% at 92% 5%,rgba(13,148,136,.13),transparent 70%),radial-gradient(50% 45% at 78% 100%,rgba(139,92,246,.12),transparent 70%)}
.hero-bg::after{content:"";position:absolute;inset:0;background-image:radial-gradient(currentColor 1px,transparent 1px);background-size:26px 26px;color:var(--bpmnkit-border,#d0d0e8);opacity:.4;-webkit-mask-image:radial-gradient(75% 55% at 50% 25%,#000,transparent 78%);mask-image:radial-gradient(75% 55% at 50% 25%,#000,transparent 78%)}
.hero-inner{position:relative;z-index:1;max-width:840px;margin:0 auto;padding:52px 20px 56px;text-align:center}
.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;white-space:nowrap;color:var(--bpmnkit-accent,#1a56db);background:var(--bpmnkit-accent-subtle,rgba(26,86,219,.12));padding:5px 13px;border-radius:999px;margin-bottom:22px}
.eyebrow svg{width:15px;height:15px;flex:none}
.hero h1{font-size:clamp(32px,5.2vw,54px);line-height:1.04;letter-spacing:-.025em;margin:0 0 16px;font-weight:800}
.hero .grad{background:linear-gradient(100deg,var(--bpmnkit-accent,#1a56db),var(--bpmnkit-teal,#0d9488) 55%,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero .sub{font-size:clamp(16px,2vw,19px);color:var(--bpmnkit-fg-muted,#6666a0);max-width:600px;margin:0 auto 22px}
.chips{display:flex;gap:8px;justify-content:center;margin-bottom:30px;flex-wrap:wrap}
.chip{font-size:12px;font-weight:700;letter-spacing:.05em;padding:4px 13px;border-radius:999px;border:1px solid var(--bpmnkit-border,#d0d0e8);background:var(--bpmnkit-surface,#fff)}
.chip-bpmn{color:#3b82f6}
.chip-dmn{color:#8b5cf6}
.chip-form{color:#16a34a}
.dropzone{position:relative;border:2px dashed var(--bpmnkit-border,#d0d0e8);border-radius:22px;background:var(--bpmnkit-panel-bg,rgba(255,255,255,.72));backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:44px 24px;text-align:center;cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s,background .18s;box-shadow:0 12px 42px -22px rgba(26,86,219,.4)}
.dropzone:hover{border-color:var(--bpmnkit-accent,#1a56db);transform:translateY(-2px);box-shadow:0 22px 54px -26px rgba(26,86,219,.55)}
.dropzone:focus-visible{outline:none;border-color:var(--bpmnkit-accent,#1a56db);box-shadow:0 0 0 4px var(--bpmnkit-accent-subtle,rgba(26,86,219,.2))}
.dropzone.drag{border-color:var(--bpmnkit-accent,#1a56db);border-style:solid;background:var(--bpmnkit-accent-subtle,rgba(26,86,219,.14));transform:scale(1.01)}
.dz-icon{width:58px;height:58px;margin:0 auto 14px;border-radius:17px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,var(--bpmnkit-accent,#1a56db),var(--bpmnkit-teal,#0d9488));box-shadow:0 8px 20px -8px rgba(26,86,219,.6)}
.dz-icon svg{width:28px;height:28px}
.dropzone h2{margin:0 0 6px;font-size:20px}
.dropzone p{margin:0;color:var(--bpmnkit-fg-muted,#6666a0);font-size:14px}
.dz-link{color:var(--bpmnkit-accent,#1a56db);font-weight:600}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:44px 0 4px;text-align:left}
.step{display:flex;gap:12px;align-items:flex-start}
.step .n{flex:none;width:30px;height:30px;border-radius:9px;background:var(--bpmnkit-accent-subtle,rgba(26,86,219,.12));color:var(--bpmnkit-accent,#1a56db);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px}
.step h3{margin:3px 0 2px;font-size:15px}
.step p{margin:0;font-size:13px;color:var(--bpmnkit-fg-muted,#6666a0)}
.features{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:30px;text-align:left}
.feat{background:var(--bpmnkit-surface,#fff);border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:14px;padding:16px}
.feat .fi{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:11px;background:var(--bpmnkit-accent-subtle,rgba(26,86,219,.12));color:var(--bpmnkit-accent,#1a56db)}
.feat .fi svg{width:18px;height:18px}
.feat h3{margin:0 0 4px;font-size:14px}
.feat p{margin:0;font-size:12.5px;color:var(--bpmnkit-fg-muted,#6666a0);line-height:1.5}
.result{background:var(--bpmnkit-surface,#fff);border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:16px;padding:20px;margin-top:22px;text-align:left;box-shadow:0 12px 42px -26px rgba(0,0,0,.3)}
/* full-page drop overlay */
.drop-overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:var(--bpmnkit-accent-subtle,rgba(26,86,219,.12));backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.drop-overlay[hidden]{display:none}
.drop-overlay-card{display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 60px;border:2.5px dashed var(--bpmnkit-accent,#1a56db);border-radius:22px;background:var(--bpmnkit-surface,#fff);color:var(--bpmnkit-accent,#1a56db);font-size:18px;font-weight:700;box-shadow:0 30px 80px -30px rgba(26,86,219,.6)}
.drop-overlay-card svg{width:40px;height:40px}
body.dragging .drop-overlay{animation:overlayIn .12s ease}
@keyframes overlayIn{from{opacity:0}to{opacity:1}}
/* live hero demo */
.hero-demo{margin-top:34px;text-align:left}
.hero-demo-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.hero-demo-cap{font-size:13px;color:var(--bpmnkit-fg-muted,#6666a0)}
.hero-canvas{height:340px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:16px;overflow:hidden;background:var(--bpmnkit-surface,#fff);box-shadow:0 16px 50px -30px rgba(0,0,0,.35);position:relative}
.hero-canvas-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--bpmnkit-fg-muted,#6666a0);font-size:13px;font-family:var(--bpmnkit-font-mono,monospace)}
@media (prefers-reduced-motion:no-preference){
.hero-canvas.animate svg{animation:heroFade .6s ease both}
.hero-canvas.animate .bpmnkit-edge-path{stroke-dasharray:520;stroke-dashoffset:520;animation:heroDraw 1s ease .25s forwards}
@keyframes heroFade{from{opacity:0}to{opacity:1}}
@keyframes heroDraw{to{stroke-dashoffset:0}}
}
/* story sections */
.section-head{margin:52px 0 18px;text-align:center}
.section-head h2{font-size:clamp(22px,3vw,30px);font-weight:800;letter-spacing:-.02em;margin:0}
.section-head p{color:var(--bpmnkit-fg-muted,#6666a0);margin:8px 0 0}
.usecases{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;text-align:left}
.uc{background:var(--bpmnkit-surface,#fff);border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:14px;padding:14px;transition:transform .15s,box-shadow .15s,border-color .15s}
.uc:hover{transform:translateY(-3px);box-shadow:0 16px 40px -24px rgba(0,0,0,.35);border-color:var(--bpmnkit-accent,#1a56db)}
.uc-diagram{height:96px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:10px;background:var(--bpmnkit-bg,#f4f4f8);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:12px}
.uc-diagram svg{width:100%;height:100%;object-fit:contain}
.uc h3{margin:0 0 4px;font-size:15px}
.uc p{margin:0;font-size:12.5px;color:var(--bpmnkit-fg-muted,#6666a0);line-height:1.5}
.stats{display:flex;justify-content:center;gap:56px;margin:48px 0 0;flex-wrap:wrap}
.stats[hidden]{display:none}
.stat{text-align:center}
.stat-n{display:block;font-size:clamp(30px,5vw,44px);font-weight:800;letter-spacing:-.02em;background:linear-gradient(100deg,var(--bpmnkit-accent,#1a56db),var(--bpmnkit-teal,#0d9488));-webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums}
.stat-l{color:var(--bpmnkit-fg-muted,#6666a0);font-size:14px}
.terminal{background:#0d1117;color:#c9d1d9;border-radius:14px;padding:18px 20px;text-align:left;font-family:var(--bpmnkit-font-mono,ui-monospace,monospace);font-size:13px;line-height:1.75;overflow-x:auto;box-shadow:0 16px 50px -30px rgba(0,0,0,.5)}
.terminal .t-p{color:var(--bpmnkit-teal,#2dd4bf);user-select:none}
.terminal .t-c{color:#6e7681}
.faq{max-width:640px;margin:0 auto;text-align:left}
.faq details{border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:12px;background:var(--bpmnkit-surface,#fff);margin-bottom:10px;padding:0 16px}
.faq summary{cursor:pointer;font-weight:600;padding:14px 0;list-style:none;font-size:15px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";float:right;color:var(--bpmnkit-fg-muted,#6666a0);font-weight:700}
.faq details[open] summary::after{content:"−"}
.faq details p{margin:0 0 14px;color:var(--bpmnkit-fg-muted,#6666a0);font-size:14px}
@media (max-width:820px){.usecases{grid-template-columns:repeat(2,1fr)}}
@media (max-width:680px){.steps,.features{grid-template-columns:1fr}.usecases{grid-template-columns:1fr}}
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
/* share — editor-style viewer filling the viewport */
body.share{height:100vh;display:flex;flex-direction:column;overflow:hidden}
.ed-topbar{flex:none;display:flex;align-items:stretch;height:44px;background:var(--bpmnkit-surface-2,#eeeef8);border-bottom:1px solid var(--bpmnkit-border,#d0d0e8)}
.ed-tabs{display:flex;overflow-x:auto;scrollbar-width:none}
.ed-tabs::-webkit-scrollbar{display:none}
.ed-tab{display:flex;align-items:center;gap:8px;padding:0 16px;border:none;border-right:1px solid var(--bpmnkit-border,#d0d0e8);border-bottom:2px solid transparent;background:transparent;cursor:pointer;font-size:13px;color:var(--bpmnkit-fg-muted,#6666a0);white-space:nowrap;max-width:260px}
.ed-tab:hover{background:var(--bpmnkit-surface,#fff)}
.ed-tab.active{background:var(--bpmnkit-surface,#fff);color:var(--bpmnkit-fg,#1a1a2e);border-bottom-color:var(--bpmnkit-accent-bright,#3b82f6)}
.ed-type{font-size:10px;font-weight:700;letter-spacing:.04em}
.ed-type-bpmn{color:#3b82f6}
.ed-type-dmn{color:#8b5cf6}
.ed-type-form{color:#16a34a}
.ed-tab-name{overflow:hidden;text-overflow:ellipsis}
.ed-tools{margin-left:auto;display:flex;align-items:center;gap:6px;padding:0 12px}
.ed-tools .btn{padding:5px 10px;font-size:13px}
.ed-info{font-size:12px;color:var(--bpmnkit-fg-muted,#6666a0);white-space:nowrap;margin-right:2px}
.ed-brand{font-weight:700;color:var(--bpmnkit-accent,#1a56db);margin-left:6px;font-size:14px}
.ed-brand:hover{text-decoration:none}
.dot{opacity:.5}
#presence{color:var(--bpmnkit-teal,#0d9488);font-weight:600}
.stage{flex:1 1 auto;min-height:0;position:relative}
.viewer{position:absolute;inset:0;overflow:auto;background:var(--bpmnkit-surface,#fff)}
.ed-zoom{position:absolute;left:14px;bottom:14px;display:flex;align-items:center;gap:1px;background:var(--bpmnkit-panel-bg,rgba(255,255,255,.94));border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:10px;padding:2px;box-shadow:0 2px 10px rgba(0,0,0,.08);z-index:5}
.ed-zoom button{border:none;background:none;cursor:pointer;color:var(--bpmnkit-fg,#1a1a2e);font-size:16px;line-height:1;min-width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center}
.ed-zoom button:hover{background:var(--bpmnkit-surface-2,#eeeef8)}
#zoomReset{padding:0 10px;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
.ed-github{position:absolute;right:14px;bottom:14px;display:flex;align-items:center;gap:7px;font-size:12px;color:var(--bpmnkit-fg-muted,#6666a0);z-index:5}
.ed-github .logo{width:20px;height:20px;border-radius:5px}
.ai-btn{background:linear-gradient(100deg,var(--bpmnkit-accent,#1a56db),#8b5cf6);color:#fff;border-color:transparent}
.ai-btn[hidden]{display:none}
.ai-panel{position:absolute;top:0;right:0;bottom:0;width:380px;max-width:92vw;background:var(--bpmnkit-surface,#fff);border-left:1px solid var(--bpmnkit-border,#d0d0e8);box-shadow:-16px 0 50px -30px rgba(0,0,0,.4);z-index:8;display:flex;flex-direction:column}
.ai-panel[hidden]{display:none}
.ai-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--bpmnkit-border,#d0d0e8);font-size:15px}
.ai-x{border:none;background:none;font-size:22px;line-height:1;cursor:pointer;color:var(--bpmnkit-fg-muted,#6666a0);padding:0 4px}
.ai-body{flex:1 1 auto;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.ai-foot{padding:10px 16px;border-top:1px solid var(--bpmnkit-border,#d0d0e8);color:var(--bpmnkit-fg-muted,#6666a0);font-size:11px;line-height:1.5}
.ai-foot span{display:block;font-weight:600}
.ai-summary{font-size:13.5px;line-height:1.6;background:var(--bpmnkit-accent-subtle,rgba(26,86,219,.1));border-radius:10px;padding:12px 14px}
.ai-label{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--bpmnkit-fg-muted,#6666a0);margin-top:4px}
.ai-card{border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:10px;padding:10px 12px}
.ai-card.clickable{cursor:pointer}
.ai-card.clickable:hover{border-color:var(--bpmnkit-accent,#1a56db);background:var(--bpmnkit-surface-2,#eeeef8)}
.ai-title{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;font-weight:600}
.ai-dot{flex:none;width:8px;height:8px;border-radius:50%;margin-top:5px}
.ai-dot.error{background:var(--bpmnkit-danger,#dc2626)}
.ai-dot.warning{background:var(--bpmnkit-warn,#d97706)}
.ai-dot.info{background:var(--bpmnkit-accent,#1a56db)}
.ai-why{font-size:12.5px;color:var(--bpmnkit-fg-muted,#6666a0);margin-top:4px;line-height:1.5}
.ai-msg{color:var(--bpmnkit-fg-muted,#6666a0);font-size:13px;padding:8px 0}
.ai-passcode input{width:100%;padding:9px 11px;border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:9px;font:inherit;margin:10px 0}
.ai-passcode.err input{border-color:var(--bpmnkit-danger,#dc2626);animation:shake .3s}
@keyframes shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (max-width:760px){.ed-info{display:none}.ed-tab-name{max-width:120px}}
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
	scriptSrc?: string | string[]
	noindex?: boolean
	bodyClass?: string
	hideTopbar?: boolean
}

function shell(opts: ShellOptions): string {
	const boot = opts.bootstrap
		? `<script type="application/json" id="${opts.bootstrap.id}">${jsonForScript(opts.bootstrap.data)}</script>`
		: ""
	const script = (opts.scriptSrc ? [opts.scriptSrc].flat() : [])
		.map((src) => `<script type="module" src="${src}"></script>`)
		.join("")
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
<body${opts.bodyClass ? ` class="${opts.bodyClass}"` : ""}>
${opts.hideTopbar ? "" : `<header class="topbar"><a class="brand" href="/drop">BPMN Kit <span>Drop</span></a><div class="spacer"></div><span class="muted">Share BPMN, DMN &amp; Forms</span></header>`}
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
	const main = `<div id="dropOverlay" class="drop-overlay" hidden><div class="drop-overlay-card">${ICON.upload}<strong>Release to share your diagram</strong></div></div>
<main class="hero">
<div class="hero-bg"></div>
<div class="hero-inner">
	<span class="eyebrow">${ICON.spark} Free · no account · live in seconds</span>
	<h1>Drop a BPMN file.<br><span class="grad">Get a link that renders.</span></h1>
	<p class="sub">Share living diagrams — not screenshots — with anyone, in seconds. Drop BPMN, DMN, or Camunda Form files and we render them right in the browser. No account.</p>
	<div class="chips"><span class="chip chip-bpmn">BPMN</span><span class="chip chip-dmn">DMN</span><span class="chip chip-form">FORM</span></div>

	<div id="dropzone" class="dropzone" role="button" tabindex="0" aria-label="Choose or drop files">
		<div class="dz-icon">${ICON.upload}</div>
		<h2>Drop files anywhere on this page</h2>
		<p>or <span class="dz-link">click to choose</span> &middot; paste BPMN XML &middot; up to ${MAX_FILES_PER_DROP} files &middot; ${kb} KB each</p>
	</div>
	<input id="fileInput" type="file" class="hidden" multiple accept="${accept}">
	<div id="errors" class="errors hidden"></div>
	<p class="notice">By uploading you agree to the <a href="/drop/terms">Terms of Use</a> and acknowledge the <a href="/drop/privacy">Privacy Policy</a>. Shared links are public to anyone who has them.</p>

	<div id="result" class="result hidden">
		<strong>Your drop is ready</strong>
		<div class="link-row"><input id="shareUrl" readonly><button id="copyBtn" class="btn">Copy</button><a id="openBtn" class="btn primary" href="#">Open</a></div>
		<iframe id="preview" title="Preview"></iframe>
	</div>

	<div class="hero-demo">
		<div class="hero-demo-head">
			<span class="hero-demo-cap">Live preview — this is exactly what people see when they open your link.</span>
			<a class="btn primary" href="/drop/${DEMO_SHARE_ID}">Open the demo drop &rarr;</a>
		</div>
		<div id="heroCanvas" class="hero-canvas"><div class="hero-canvas-msg">Loading preview…</div></div>
	</div>

	<div class="steps">
		<div class="step"><span class="n">1</span><div><h3>Drop your files</h3><p>BPMN, DMN &amp; Camunda Forms — one or many at once.</p></div></div>
		<div class="step"><span class="n">2</span><div><h3>Get a short link</h3><p>Validated, converted, and stored — ready in a second.</p></div></div>
		<div class="step"><span class="n">3</span><div><h3>Share it anywhere</h3><p>Paste it in Slack, a PR, a ticket — it just renders.</p></div></div>
	</div>

	<div class="features">
		<div class="feat"><div class="fi">${ICON.browser}</div><h3>Renders in the browser</h3><p>Real BPMN/DMN/Form viewers — not a screenshot.</p></div>
		<div class="feat"><div class="fi">${ICON.bolt}</div><h3>No account needed</h3><p>No sign-up, no upload dance. Drop &amp; go.</p></div>
		<div class="feat"><div class="fi">${ICON.eye}</div><h3>See who's viewing</h3><p>A live count of everyone looking right now.</p></div>
		<div class="feat"><div class="fi">${ICON.clock}</div><h3>Links that last</h3><p>Kept for 90 days after they're last opened.</p></div>
	</div>

	<div class="section-head"><h2>What people drop</h2></div>
	<div class="usecases">
		<div class="uc"><div class="uc-diagram" data-uc="review"></div><h3>Code review</h3><p>Attach the process next to the PR that implements it.</p></div>
		<div class="uc"><div class="uc-diagram" data-uc="incident"></div><h3>Incident channel</h3><p>Stop describing the flow in Slack. Drop it.</p></div>
		<div class="uc"><div class="uc-diagram" data-uc="docs"></div><h3>Docs &amp; tickets</h3><p>A link that renders beats a stale screenshot.</p></div>
		<div class="uc"><div class="uc-diagram" data-uc="handoff"></div><h3>Client handoff</h3><p>Send a process draft without asking anyone to install a modeler.</p></div>
	</div>

	<div id="stats" class="stats" hidden>
		<div class="stat"><span class="stat-n" id="statDrops">—</span><span class="stat-l">diagrams shared</span></div>
		<div class="stat"><span class="stat-n" id="statViews">—</span><span class="stat-l">views delivered</span></div>
	</div>

	<div class="section-head"><h2>Has an API, too</h2><p>No account, fully scriptable — drop straight from your terminal.</p></div>
	<pre class="terminal"><span class="t-c"># upload — returns a shareId and URL</span>
<span class="t-p">$</span> curl -F files=@order.bpmn https://bpmnkit.com/drop/api/drops
{ "shareId": "aB3xY7kQn2p", "url": "/drop/aB3xY7kQn2p", "files": [ … ] }

<span class="t-c"># then, with the shareId</span>
<span class="t-p">$</span> curl https://bpmnkit.com/drop/aB3xY7kQn2p/manifest.json
<span class="t-p">$</span> curl "https://bpmnkit.com/drop/aB3xY7kQn2p/f/order.bpmn?format=json"</pre>

	<div class="section-head"><h2>Questions</h2></div>
	<div class="faq">
		<details><summary>How long do links last?</summary><p>90 days after a drop is last opened. Every view slides the window forward, so links people actually use stay alive; abandoned ones clean themselves up.</p></details>
		<details><summary>Who can see my diagram?</summary><p>Anyone with the link. Links are unguessable (64 bits of randomness) and never listed anywhere, but they aren't otherwise access-controlled — don't drop confidential material.</p></details>
		<details><summary>What can I drop?</summary><p>BPMN 2.0, DMN, and Camunda Form files — up to ${MAX_FILES_PER_DROP} at once. Only files that parse are stored; this isn't a generic file host.</p></details>
		<details><summary>Is it really free?</summary><p>Yes. No account, no sign-up, no payment. Just drop and share.</p></details>
		<details><summary>Can I delete a drop?</summary><p>Drops expire on their own, and you can <a href="/drop/privacy">report</a> anything that shouldn't be up. Per-uploader deletion is on the roadmap.</p></details>
	</div>

	<footer><a href="/drop/terms">Terms</a><a href="/drop/privacy">Privacy</a><a href="https://github.com/bpmnkit/monorepo">GitHub</a></footer>
</div>
</main>`
	return shell({
		title: "BPMN Kit Drop — share BPMN, DMN & Form files",
		description:
			"Drop a BPMN, DMN, or Camunda Form file and get a short shareable link that renders it in the browser.",
		main,
		bootstrap: { id: "drop-config", data: { tosVersion } },
		scriptSrc: ["/drop/assets/drop.js", "/drop/assets/landing.js"],
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
	const expires = drop.expires_at ? new Date(drop.expires_at).toISOString().slice(0, 10) : "never"

	const tabs = files
		.map(
			(f, i) =>
				`<button class="ed-tab${i === primary ? " active" : ""}" role="tab" data-index="${i}" title="${escapeHtml(f.filename)}"><span class="ed-type ed-type-${f.kind}">${f.kind.toUpperCase()}</span><span class="ed-tab-name">${escapeHtml(f.name || f.filename)}</span></button>`,
		)
		.join("")

	const main = `<div class="ed-topbar">
	<div class="ed-tabs" role="tablist">${tabs}</div>
	<div class="ed-tools">
		<span class="ed-info" title="Created ${created} · expires ${expires}"><span id="viewCount">${drop.view_count}</span> views<span class="dot"> · </span><span id="presence" hidden>0 viewing</span><span class="dot"> · </span>expires ${expires}</span>
		<button id="aiReviewBtn" class="btn ai-btn" hidden>&#10024; AI review</button>
		<a id="dlOriginal" class="btn" href="#" download>Original</a>
		<a id="dlJson" class="btn" href="#" download>JSON</a>
		<button id="copyLink" class="btn">Copy link</button>
		<button id="reportBtn" class="btn">Report</button>
		<a class="ed-brand" href="/drop">BPMN Kit</a>
	</div>
</div>
<div class="stage">
	<div id="viewer" class="viewer"><div class="viewer-msg">Loading…</div></div>
	<div class="ed-zoom" id="zoombar" hidden>
		<button id="zoomOut" type="button" aria-label="Zoom out">&minus;</button>
		<button id="zoomReset" type="button" aria-label="Reset to 100%"><span id="zoomLevel">100%</span></button>
		<button id="zoomIn" type="button" aria-label="Zoom in">+</button>
		<button id="zoomFit" type="button" aria-label="Fit diagram" title="Fit diagram">&#9974;</button>
	</div>
	<a class="ed-github" href="https://github.com/bpmnkit/monorepo" target="_blank" rel="noopener"><img class="logo" src="${FAVICON}" alt="">GitHub</a>
	<aside id="aiPanel" class="ai-panel" hidden>
		<header class="ai-head"><strong>&#10024; AI process review</strong><button id="aiClose" class="ai-x" type="button" aria-label="Close">&times;</button></header>
		<div id="aiBody" class="ai-body"></div>
		<footer class="ai-foot"><span id="aiModel"></span>AI can be wrong — always review before acting.</footer>
	</aside>
</div>
${reportDialog()}`

	return shell({
		title: `${title} — BPMN Kit Drop`,
		description: `A shared ${files[primary]?.kind ?? "BPMN"} diagram on BPMN Kit Drop.`,
		main,
		bodyClass: "share",
		hideTopbar: true,
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
