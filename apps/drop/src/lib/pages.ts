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

// Square, flat, one accent — the favicon is an image asset, so it carries the
// literal value of --bpmnkit-ds-accent rather than a var() reference.
const FAVICON = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#a8503a"/><path d="M9 16h14M16 9v14" stroke="#fff" stroke-width="3"/></svg>`,
)}`

// Inline stroke icon (currentColor), 24×24 viewBox. Monochrome by construction —
// the system ships no color emoji.
const svg = (body: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${body}</svg>`
const ICON = {
	upload: svg(`<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v3h16v-3"/>`),
}

/* The two families the design system allows. Both are OFL 1.1 and are copied
   into public/drop/fonts/ at build time (see scripts/build-client.mjs). */
const FONT_CSS = `
@font-face{font-family:"Space Grotesk";font-style:normal;font-weight:300 700;font-display:swap;src:url("/drop/fonts/space-grotesk-latin-var.woff2") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"Space Grotesk";font-style:normal;font-weight:300 700;font-display:swap;src:url("/drop/fonts/space-grotesk-latin-ext-var.woff2") format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"Space Mono";font-style:normal;font-weight:400;font-display:swap;src:url("/drop/fonts/space-mono-latin-400.woff2") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"Space Mono";font-style:normal;font-weight:700;font-display:swap;src:url("/drop/fonts/space-mono-latin-700.woff2") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
`

/* Drop's chrome. Flat, square, hairline-ruled: no border-radius, no box-shadow,
   no gradient anywhere below. Every colour is a --bpmnkit-ds-* token — the token
   block is inlined above this sheet by shell(), so no hex is repeated here.
   Reading text uses --ink-3 rather than the --ink-4 the spec names for it:
   --ink-4 is 2.88:1 on --bg, under the brief's own 4.5:1 floor. --ink-4 stays
   on true metadata — versions, uppercase labels, placeholders. */
const PAGE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
	background:var(--bpmnkit-ds-bg);color:var(--bpmnkit-ds-ink);
	font-family:var(--bpmnkit-ds-font-sans);font-size:var(--bpmnkit-ds-t-body);line-height:1.6;
	-webkit-font-smoothing:antialiased;
}
a{color:var(--bpmnkit-ds-accent);text-decoration:none}
a:hover{color:var(--bpmnkit-ds-ink)}
:focus-visible{outline:2px solid var(--bpmnkit-ds-accent);outline-offset:2px}
h1,h2,h3{margin:0;font-weight:700;letter-spacing:-.025em}
p{margin:0}
.mono{font-family:var(--bpmnkit-ds-font-mono)}
.hidden{display:none}

/* ── Page frame ─────────────────────────────────────────────────────────── */
.page{max-width:var(--bpmnkit-ds-page-max);margin:0 auto;padding:0 var(--bpmnkit-ds-page-gutter)}
.wrap{max-width:820px;margin:0 auto;padding:var(--bpmnkit-ds-sp-7) var(--bpmnkit-ds-page-gutter)}
.section{border-bottom:1px solid var(--bpmnkit-ds-line)}
.section-inner{max-width:var(--bpmnkit-ds-page-max);margin:0 auto;padding:56px var(--bpmnkit-ds-page-gutter) 64px}
.section-head{display:flex;align-items:baseline;gap:16px;margin-bottom:28px}
.section-num{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-eyebrow);letter-spacing:.12em;color:var(--bpmnkit-ds-accent);flex:none}
.section-h2{font-size:var(--bpmnkit-ds-t-h2);line-height:1.15}
.section-lead{font-size:var(--bpmnkit-ds-t-body-sm);line-height:1.55;color:var(--bpmnkit-ds-ink-2);max-width:60ch}
/* Lead paragraphs indent to the section title, clearing the mono number. */
.section-indent{padding-left:calc(2ch + 16px)}
.eyebrow{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-eyebrow);letter-spacing:.14em;text-transform:uppercase;color:var(--bpmnkit-ds-accent)}

/* ── Nav ────────────────────────────────────────────────────────────────── */
.nav{position:sticky;top:0;z-index:40;height:56px;background:var(--bpmnkit-ds-bg);border-bottom:1px solid var(--bpmnkit-ds-line)}
.nav-inner{display:flex;align-items:center;gap:12px;height:56px;max-width:var(--bpmnkit-ds-page-max);margin:0 auto;padding:0 var(--bpmnkit-ds-page-gutter)}
.nav-mark{font-size:17px;font-weight:700;letter-spacing:-.02em;color:var(--bpmnkit-ds-ink)}
.nav-mark:hover{color:var(--bpmnkit-ds-ink)}
.nav-mark b{font-weight:700;color:var(--bpmnkit-ds-accent)}
.nav-version{font-family:var(--bpmnkit-ds-font-mono);font-size:11px;color:var(--bpmnkit-ds-ink-4)}
.nav-spacer{flex:1}
.nav-tagline{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);letter-spacing:.08em;text-transform:uppercase;color:var(--bpmnkit-ds-ink-3)}

/* ── Buttons ────────────────────────────────────────────────────────────── */
.btn-primary{display:inline-flex;align-items:center;gap:8px;background:var(--bpmnkit-ds-accent);color:var(--bpmnkit-ds-surface);font-size:15px;font-weight:700;padding:13px 20px;border:none;cursor:pointer;font-family:inherit}
.btn-primary:hover{background:var(--bpmnkit-ds-accent-hover);color:var(--bpmnkit-ds-surface)}
.btn-ghost{display:inline-flex;align-items:center;gap:6px;font-family:var(--bpmnkit-ds-font-mono);font-size:12px;padding:6px 12px;border:1px solid var(--bpmnkit-ds-line-strong);background:transparent;color:var(--bpmnkit-ds-ink);cursor:pointer}
.btn-ghost:hover{background:var(--bpmnkit-ds-ink);color:var(--bpmnkit-ds-bg)}
.btn-link{display:inline-block;color:var(--bpmnkit-ds-ink);border-bottom:1px solid var(--bpmnkit-ds-line);padding-bottom:3px;font-size:var(--bpmnkit-ds-t-body-sm)}
.btn-link:hover{color:var(--bpmnkit-ds-accent);border-bottom-color:var(--bpmnkit-ds-accent)}

/* ── Hero ───────────────────────────────────────────────────────────────── */
.hero{border-bottom:1px solid var(--bpmnkit-ds-line)}
.hero-grid{display:grid;grid-template-columns:1fr 1fr;max-width:var(--bpmnkit-ds-page-max);margin:0 auto}
.hero-left{padding:64px var(--bpmnkit-ds-sp-6) 64px var(--bpmnkit-ds-page-gutter)}
.hero-right{padding:64px var(--bpmnkit-ds-page-gutter) 64px var(--bpmnkit-ds-sp-6);border-left:1px solid var(--bpmnkit-ds-line);min-width:0}
.hero h1{font-size:var(--bpmnkit-ds-t-display);line-height:.98;letter-spacing:-.035em;margin:18px 0 20px}
.hero h1 .dim{color:var(--bpmnkit-ds-ink-3)}
.hero-lead{font-size:var(--bpmnkit-ds-t-lead);line-height:1.5;color:var(--bpmnkit-ds-ink-2);max-width:460px}
.chips{display:flex;gap:8px;margin:26px 0}
.chip{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);letter-spacing:.08em;padding:5px 11px;border:1px solid var(--bpmnkit-ds-line);color:var(--bpmnkit-ds-ink-3)}
.hero-ctas{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.checklist{list-style:none;margin:34px 0 0;padding:20px 0 0;border-top:1px solid var(--bpmnkit-ds-line);display:flex;flex-direction:column;gap:8px}
.checklist li{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);letter-spacing:.04em;color:var(--bpmnkit-ds-ink-3)}
.checklist li::before{content:"+ ";color:var(--bpmnkit-ds-accent)}
.panel-cap{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;text-transform:uppercase;color:var(--bpmnkit-ds-ink-4);margin-bottom:10px}

/* ── Dropzone ───────────────────────────────────────────────────────────── */
.dropzone{border:1px dashed var(--bpmnkit-ds-accent);background:var(--bpmnkit-ds-surface);padding:44px 24px;text-align:center;cursor:pointer}
.dropzone:hover,.dropzone.drag{background:var(--bpmnkit-ds-bg)}
.dz-icon{width:38px;height:38px;margin:0 auto 16px;border:1px solid var(--bpmnkit-ds-line);display:flex;align-items:center;justify-content:center;color:var(--bpmnkit-ds-accent)}
.dz-icon svg{width:18px;height:18px}
.dropzone h2{font-size:19px;line-height:1.3;margin-bottom:8px}
.dz-sub{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);letter-spacing:.04em;color:var(--bpmnkit-ds-ink-3)}
.dz-sub u{text-decoration:none;border-bottom:1px solid var(--bpmnkit-ds-accent);color:var(--bpmnkit-ds-accent)}
.legal{font-family:var(--bpmnkit-ds-font-mono);font-size:11px;line-height:1.6;color:var(--bpmnkit-ds-ink-3);margin-top:14px}
.errors{margin-top:14px;font-size:var(--bpmnkit-ds-t-body-sm);color:var(--bpmnkit-ds-accent)}
.errors ul{margin:6px 0 0;padding-left:18px}

/* Page-wide drag target */
.drop-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:var(--bpmnkit-ds-bg)}
.drop-overlay[hidden]{display:none}
.drop-overlay-card{display:flex;flex-direction:column;align-items:center;gap:14px;padding:44px 64px;border:1px dashed var(--bpmnkit-ds-accent);background:var(--bpmnkit-ds-surface);color:var(--bpmnkit-ds-accent);font-size:19px;font-weight:700}
.drop-overlay-card svg{width:32px;height:32px}

/* ── Preview / result panels ────────────────────────────────────────────── */
.panel{border:1px solid var(--bpmnkit-ds-line);background:var(--bpmnkit-ds-surface);margin-top:26px}
.panel-bar{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--bpmnkit-ds-line);font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);color:var(--bpmnkit-ds-ink-3);overflow:hidden}
.panel-bar .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hero-canvas{height:300px;background:var(--bpmnkit-ds-canvas);position:relative;overflow:hidden}
.hero-canvas-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);color:var(--bpmnkit-ds-ink-3)}
@media (prefers-reduced-motion:no-preference){
	.hero-canvas.animate svg{animation:heroFade .6s ease both}
	.hero-canvas.animate .bpmnkit-edge-path{stroke-dasharray:520;stroke-dashoffset:520;animation:heroDraw 1s ease .25s forwards}
	@keyframes heroFade{from{opacity:0}to{opacity:1}}
	@keyframes heroDraw{to{stroke-dashoffset:0}}
}
.result .link-row{display:flex;border-bottom:1px solid var(--bpmnkit-ds-line)}
.result input{flex:1;min-width:0;font-family:var(--bpmnkit-ds-font-mono);font-size:12.5px;padding:9px 11px;border:none;background:transparent;color:var(--bpmnkit-ds-ink)}
.result .link-row .btn-ghost{border:none;border-left:1px solid var(--bpmnkit-ds-line)}
.result iframe{display:block;width:100%;height:300px;border:none;background:var(--bpmnkit-ds-canvas)}

/* ── Card / column grids ────────────────────────────────────────────────── */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0}
.grid--boxed{border:1px solid var(--bpmnkit-ds-line);background:var(--bpmnkit-ds-surface)}
.grid--rule{border-top:1px solid var(--bpmnkit-ds-line)}
.cell{padding:24px;border-right:1px solid var(--bpmnkit-ds-line-soft)}
.cell:last-child{border-right:none}
.cell h3{font-size:17px;margin-bottom:8px}
.cell p{font-size:var(--bpmnkit-ds-t-body-sm);line-height:1.55;color:var(--bpmnkit-ds-ink-2)}
.cell-num{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;color:var(--bpmnkit-ds-accent);display:block;margin-bottom:12px}
.stat-n{display:block;font-size:var(--bpmnkit-ds-t-h2);font-weight:700;letter-spacing:-.025em;font-variant-numeric:tabular-nums}
.stat-l{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;text-transform:uppercase;color:var(--bpmnkit-ds-ink-4)}
.stats[hidden]{display:none}

/* ── Dark band ──────────────────────────────────────────────────────────── */
.section--dark{background:var(--bpmnkit-ds-dark);border-bottom-color:var(--bpmnkit-ds-dark);color:var(--bpmnkit-ds-ink-on-dark-2)}
.section--dark .section-num{color:var(--bpmnkit-ds-accent-on-dark)}
.section--dark .section-h2{color:var(--bpmnkit-ds-ink-on-dark)}
.section--dark .grid--rule{border-top-color:var(--bpmnkit-ds-line-dark)}
.section--dark .cell{border-right-color:var(--bpmnkit-ds-line-dark)}
.section--dark .cell h3{color:var(--bpmnkit-ds-ink-on-dark)}
.section--dark .cell p{color:var(--bpmnkit-ds-ink-on-dark-2)}
.section--dark .cell-num{color:var(--bpmnkit-ds-accent-on-dark)}
.uc-diagram{height:96px;background:var(--bpmnkit-ds-canvas);border:1px solid var(--bpmnkit-ds-line-dark);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:14px}
.uc-diagram svg{width:100%;height:100%;object-fit:contain}

/* ── Code panel ─────────────────────────────────────────────────────────── */
.code{background:var(--bpmnkit-ds-dark-code);color:var(--bpmnkit-ds-code-text);font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-code);line-height:1.85;padding:24px 26px;margin:0;overflow-x:auto}
.code .c-prompt{color:var(--bpmnkit-ds-code-prompt);user-select:none}
.code .c-comment{color:var(--bpmnkit-ds-code-comment)}
.code .c-string{color:var(--bpmnkit-ds-code-string)}

/* ── Accordion ──────────────────────────────────────────────────────────── */
.faq{max-width:820px}
.faq details{border-bottom:1px solid var(--bpmnkit-ds-line)}
.faq summary{display:flex;align-items:baseline;gap:14px;cursor:pointer;list-style:none;font-size:17px;font-weight:500;padding:18px 0}
.faq summary::-webkit-details-marker{display:none}
.faq summary::before{content:"+";font-family:var(--bpmnkit-ds-font-mono);color:var(--bpmnkit-ds-accent);flex:none}
.faq details[open] summary::before{content:"−"}
.faq details p{font-size:var(--bpmnkit-ds-t-body);line-height:1.6;color:var(--bpmnkit-ds-ink-2);max-width:640px;margin:0 0 18px;padding-left:calc(1ch + 14px)}

/* ── Footer ─────────────────────────────────────────────────────────────── */
.foot{border-top:1px solid var(--bpmnkit-ds-line);font-family:var(--bpmnkit-ds-font-mono);font-size:11.5px;color:var(--bpmnkit-ds-ink-3)}
.foot-inner{display:flex;gap:18px;flex-wrap:wrap;align-items:center;max-width:var(--bpmnkit-ds-page-max);margin:0 auto;padding:20px var(--bpmnkit-ds-page-gutter)}
.foot a{color:var(--bpmnkit-ds-ink-3)}
.foot a:hover{color:var(--bpmnkit-ds-accent)}
.foot .spacer{flex:1}

/* ── Prose (terms / privacy / 404) ──────────────────────────────────────── */
.prose h1{font-size:var(--bpmnkit-ds-t-h2);margin-bottom:8px}
.prose h2{font-size:17px;margin:26px 0 8px}
.prose p{margin:0 0 14px;color:var(--bpmnkit-ds-ink-2)}
.lead{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);letter-spacing:.08em;color:var(--bpmnkit-ds-ink-3);margin-bottom:26px}

/* ── App chrome: share viewer, diff, admin ──────────────────────────────── */
body.app{height:100vh;min-height:420px;display:flex;flex-direction:column;overflow:hidden;background:var(--bpmnkit-ds-bg)}
.ed-topbar{flex:none;display:flex;align-items:stretch;height:var(--bpmnkit-ds-topbar-height);border-bottom:1px solid var(--bpmnkit-ds-line)}
.ed-tabs{display:flex;overflow-x:auto;scrollbar-width:none}
.ed-tabs::-webkit-scrollbar{display:none}
.ed-tab{display:flex;align-items:center;gap:9px;padding:0 16px;border:none;border-right:1px solid var(--bpmnkit-ds-line);border-bottom:2px solid transparent;background:transparent;cursor:pointer;font-family:inherit;font-size:var(--bpmnkit-ds-t-ui);font-weight:500;color:var(--bpmnkit-ds-ink-4);white-space:nowrap;max-width:260px}
.ed-tab:hover{color:var(--bpmnkit-ds-ink)}
.ed-tab.active{background:var(--bpmnkit-ds-surface);color:var(--bpmnkit-ds-ink);border-bottom-color:var(--bpmnkit-ds-accent);margin-bottom:-1px}
.ed-type{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;color:var(--bpmnkit-ds-accent)}
.ed-tab-name{overflow:hidden;text-overflow:ellipsis}
.ed-tools{margin-left:auto;display:flex;align-items:center;gap:14px;padding:0 var(--bpmnkit-ds-sp-3);border-left:1px solid var(--bpmnkit-ds-line)}
.ed-info{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.1em;color:var(--bpmnkit-ds-ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ed-group{display:flex;align-items:stretch;border:1px solid var(--bpmnkit-ds-line);background:var(--bpmnkit-ds-surface)}
.ed-group>*{display:flex;align-items:center;justify-content:center;padding:0 11px;height:28px;border:none;border-right:1px solid var(--bpmnkit-ds-line-soft);background:transparent;color:var(--bpmnkit-ds-ink-2);cursor:pointer;font-family:var(--bpmnkit-ds-font-mono);font-size:12px;font-variant-emoji:text;white-space:nowrap}
.ed-group>*:last-child{border-right:none}
.ed-group>*:hover{background:var(--bpmnkit-ds-bg);color:var(--bpmnkit-ds-ink)}
.ed-group>*.active{background:var(--bpmnkit-ds-accent);color:var(--bpmnkit-ds-surface)}
.ed-group>*[hidden]{display:none}
.ed-group>*:disabled{color:var(--bpmnkit-ds-ink-4);cursor:not-allowed;background:transparent}
.ed-group[hidden]{display:none}
.ed-brand{font-size:var(--bpmnkit-ds-t-ui);font-weight:700;letter-spacing:-.02em;color:var(--bpmnkit-ds-ink)}
.ed-brand b{color:var(--bpmnkit-ds-accent)}
.stage{flex:1 1 auto;min-height:0;position:relative}
.viewer{position:absolute;inset:0;overflow:auto;background:var(--bpmnkit-ds-canvas)}
.viewer-msg{padding:24px;font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);color:var(--bpmnkit-ds-ink-3);white-space:pre-wrap;word-break:break-word}
.ed-zoom{position:absolute;left:16px;bottom:16px;z-index:5}
.ed-zoom button{min-width:34px}
#zoomReset{font-variant-numeric:tabular-nums}
.ed-github{position:absolute;right:16px;bottom:16px;display:flex;align-items:center;gap:8px;font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;text-transform:uppercase;color:var(--bpmnkit-ds-ink-4);z-index:5}
.ed-github .logo{width:16px;height:16px}
.diff-stage{display:flex}
.diff-pane{flex:1;min-width:0;position:relative}
.diff-pane+.diff-pane{border-left:1px solid var(--bpmnkit-ds-line)}
select.ed-select{height:28px;border:1px solid var(--bpmnkit-ds-line);background:var(--bpmnkit-ds-surface);color:var(--bpmnkit-ds-ink);font-family:var(--bpmnkit-ds-font-mono);font-size:12px;padding:0 8px}

/* ── AI review panel ────────────────────────────────────────────────────── */
.ai-panel{position:absolute;top:0;right:0;bottom:0;width:var(--bpmnkit-ds-panel-width);max-width:92vw;background:var(--bpmnkit-ds-surface);border-left:1px solid var(--bpmnkit-ds-line);z-index:8;display:flex;flex-direction:column}
.ai-panel[hidden]{display:none}
.ai-head{display:flex;align-items:center;justify-content:space-between;padding:0 var(--bpmnkit-ds-sp-4);height:var(--bpmnkit-ds-topbar-height);border-bottom:1px solid var(--bpmnkit-ds-line);font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;text-transform:uppercase;color:var(--bpmnkit-ds-ink-3)}
.ai-x{border:none;background:none;font-family:var(--bpmnkit-ds-font-mono);font-size:14px;cursor:pointer;color:var(--bpmnkit-ds-ink-4);padding:0 4px;font-variant-emoji:text}
.ai-x:hover{color:var(--bpmnkit-ds-ink)}
.ai-body{flex:1 1 auto;overflow-y:auto;padding:var(--bpmnkit-ds-sp-4)}
.ai-foot{padding:12px var(--bpmnkit-ds-sp-4);border-top:1px solid var(--bpmnkit-ds-line);font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.08em;line-height:1.6;color:var(--bpmnkit-ds-ink-3)}
.ai-summary{font-size:var(--bpmnkit-ds-t-body-sm);line-height:1.6;color:var(--bpmnkit-ds-ink-2);padding-bottom:14px;border-bottom:1px solid var(--bpmnkit-ds-line)}
.ai-label{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;text-transform:uppercase;color:var(--bpmnkit-ds-ink-4);padding:16px 0 8px}
.ai-card{border-bottom:1px solid var(--bpmnkit-ds-line);padding:12px 0}
.ai-card.clickable{cursor:pointer}
.ai-card.clickable:hover{background:var(--bpmnkit-ds-bg)}
.ai-title{display:flex;gap:9px;align-items:baseline;font-size:var(--bpmnkit-ds-t-body-sm);font-weight:500}
/* Severity is semantic state, not brand — it keeps its own scale. */
.ai-dot{flex:none;font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro)}
.ai-dot.error{color:var(--bpmnkit-danger)}
.ai-dot.warning{color:var(--bpmnkit-warn)}
.ai-dot.info{color:var(--bpmnkit-ds-ink-4)}
.ai-why{font-size:var(--bpmnkit-ds-t-body-sm);color:var(--bpmnkit-ds-ink-2);margin-top:5px;line-height:1.55}
.ai-msg{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);color:var(--bpmnkit-ds-ink-3);padding:8px 0}
.hv-row{display:flex;align-items:baseline;gap:10px;border-bottom:1px solid var(--bpmnkit-ds-line);padding:10px 0;font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label)}
.hv-row.current{background:var(--bpmnkit-ds-bg)}
.hv-seq{flex:none;width:2.4em;color:var(--bpmnkit-ds-accent)}
.hv-when{flex:1 1 auto;color:var(--bpmnkit-ds-ink-2)}
.hv-tag{flex:none;letter-spacing:.08em;text-transform:uppercase;font-size:var(--bpmnkit-ds-t-mono-micro);color:var(--bpmnkit-ds-ink-4)}
.hv-tag.model{color:var(--bpmnkit-ds-accent)}
.hv-actions{display:flex;gap:6px;padding-top:6px}
.hv-btn{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--bpmnkit-ds-line);background:var(--bpmnkit-ds-surface);color:var(--bpmnkit-ds-ink-2);padding:4px 8px;cursor:pointer}
.hv-btn:hover{background:var(--bpmnkit-ds-bg);color:var(--bpmnkit-ds-ink)}
.hv-banner{position:absolute;top:var(--bpmnkit-ds-topbar-height);left:0;right:0;z-index:7;display:flex;align-items:center;gap:12px;padding:8px var(--bpmnkit-ds-sp-4);background:var(--bpmnkit-ds-dark);color:var(--bpmnkit-ds-ink-on-dark);font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label)}
.hv-banner[hidden]{display:none}
.ts-dialog{margin:auto;border:1px solid var(--bpmnkit-ds-line);background:var(--bpmnkit-ds-surface);color:var(--bpmnkit-ds-ink);padding:var(--bpmnkit-ds-sp-4);font-family:inherit;min-width:320px}
.ts-dialog::backdrop{background:rgba(0,0,0,.35)}
.ts-title{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-label);text-transform:uppercase;color:var(--bpmnkit-ds-ink-3);margin-bottom:var(--bpmnkit-ds-sp-3)}
.ts-error{margin-top:var(--bpmnkit-ds-sp-3);color:var(--bpmnkit-danger);font-size:var(--bpmnkit-ds-t-ui)}
.ts-error[hidden]{display:none}
.ts-cancel{margin-top:var(--bpmnkit-ds-sp-3);border:1px solid var(--bpmnkit-ds-line);background:transparent;color:var(--bpmnkit-ds-ink-2);cursor:pointer;font-family:var(--bpmnkit-ds-font-mono);font-size:12px;height:28px;padding:0 11px}
.hv-banner .hv-btn{border-color:var(--bpmnkit-ds-line-dark);background:none;color:var(--bpmnkit-ds-ink-on-dark-2)}
.hv-banner .hv-btn:hover{background:rgba(255,255,255,.08);color:var(--bpmnkit-ds-ink-on-dark)}
.ai-passcode input{width:100%;padding:8px 10px;border:1px solid var(--bpmnkit-ds-line);background:var(--bpmnkit-ds-surface);color:var(--bpmnkit-ds-ink);font-family:var(--bpmnkit-ds-font-mono);font-size:12.5px;margin:12px 0}
.ai-passcode.err input{border-color:var(--bpmnkit-danger)}

/* ── Form fields, dialog, table ─────────────────────────────────────────── */
.field{padding:14px 0;border-bottom:1px solid var(--bpmnkit-ds-line)}
.field label{display:block;font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;text-transform:uppercase;color:var(--bpmnkit-ds-ink-4);margin-bottom:7px}
.field input,.field select,.field textarea{width:100%;border:1px solid var(--bpmnkit-ds-line);background:var(--bpmnkit-ds-surface);color:var(--bpmnkit-ds-ink);font-family:var(--bpmnkit-ds-font-mono);font-size:12.5px;padding:7px 9px}
.row{display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}
dialog{border:1px solid var(--bpmnkit-ds-line-strong);padding:24px;max-width:420px;width:92%;background:var(--bpmnkit-ds-surface);color:var(--bpmnkit-ds-ink)}
dialog::backdrop{background:var(--bpmnkit-ds-dark);opacity:.5}
dialog strong{display:block;font-size:17px;margin-bottom:6px}
.notice{font-family:var(--bpmnkit-ds-font-mono);font-size:11px;line-height:1.6;color:var(--bpmnkit-ds-ink-3);margin-top:14px}
.admin-table{width:100%;border-collapse:collapse;margin-top:20px;font-size:var(--bpmnkit-ds-t-body-sm)}
.admin-table th,.admin-table td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--bpmnkit-ds-line);vertical-align:top}
.admin-table th{font-family:var(--bpmnkit-ds-font-mono);font-size:var(--bpmnkit-ds-t-mono-micro);letter-spacing:.12em;text-transform:uppercase;color:var(--bpmnkit-ds-ink-4);font-weight:400}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width:900px){
	.hero-grid{grid-template-columns:1fr}
	.hero-left{padding:48px var(--bpmnkit-ds-page-gutter) 40px}
	.hero-right{padding:40px var(--bpmnkit-ds-page-gutter) 48px;border-left:none;border-top:1px solid var(--bpmnkit-ds-line)}
	.hero h1{font-size:44px}
	.cell{border-right:none;border-bottom:1px solid var(--bpmnkit-ds-line-soft)}
	.cell:last-child{border-bottom:none}
	.section--dark .cell{border-bottom-color:var(--bpmnkit-ds-line-dark)}
}
@media (max-width:720px){
	.nav-tagline{display:none}
	.ai-panel{width:100%}
}
`

interface ShellOptions {
	title: string
	description: string
	main: string
	bootstrap?: { id: string; data: unknown }
	scriptSrc?: string | string[]
	noindex?: boolean
	bodyClass?: string
	nav?: boolean
}

function navBar(): string {
	return `<header class="nav"><div class="nav-inner">
<a class="nav-mark" href="/drop">BPMN Kit <b>Drop</b></a>
<span class="nav-version">v1.0</span>
<span class="nav-spacer"></span>
<span class="nav-tagline">Share BPMN, DMN &amp; Forms</span>
<a class="btn-ghost" href="https://bpmnkit.com/editor">Editor &#8599;</a>
</div></header>`
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
<style>${FONT_CSS}</style>
<style>${PAGE_CSS}</style>
</head>
<body${opts.bodyClass ? ` class="${opts.bodyClass}"` : ""}>
${opts.nav ? navBar() : ""}
${opts.main}
${boot}
${script}
</body>
</html>`
}

function pageFooter(): string {
	return `<footer class="foot"><div class="foot-inner">
<a href="/drop/terms">Terms</a><a href="/drop/privacy">Privacy</a><a href="https://github.com/bpmnkit/monorepo">GitHub</a>
<span class="spacer"></span>
<span>MIT-licensed &middot; bpmnkit.com</span>
</div></footer>`
}

/** The upload landing page. */
export function dropPage(tosVersion: string): string {
	const accept = ACCEPTED_EXTENSIONS.join(",")
	const kb = Math.round(MAX_FILE_BYTES / 1000)
	const main = `<div id="dropOverlay" class="drop-overlay" hidden><div class="drop-overlay-card">${ICON.upload}<span>Release to share your diagram</span></div></div>
<main>

<section class="hero"><div class="hero-grid">
	<div class="hero-left">
		<span class="eyebrow">Free &middot; no account &middot; live in seconds</span>
		<h1><span class="dim">Drop a BPMN file.</span><br>Get a link that renders.</h1>
		<p class="hero-lead">Share living diagrams — not screenshots — with anyone, in seconds. Drop BPMN, DMN, or Camunda Form files and we render them right in the browser. No account.</p>
		<div class="chips"><span class="chip">BPMN</span><span class="chip">DMN</span><span class="chip">FORM</span></div>
		<div class="hero-ctas">
			<a class="btn-primary" href="/drop/${DEMO_SHARE_ID}">Open the demo drop</a>
			<a class="btn-link" href="#drop-zone">Drop a file instead</a>
		</div>
		<ul class="checklist">
			<li>Renders in the browser — not a screenshot</li>
			<li>No account, no sign-up, no payment</li>
			<li>Links kept 90 days after they are last opened</li>
		</ul>
	</div>

	<div class="hero-right">
		<p class="panel-cap" id="drop-zone">drop-zone</p>
		<div id="dropzone" class="dropzone" role="button" tabindex="0" aria-label="Choose or drop files">
			<div class="dz-icon">${ICON.upload}</div>
			<h2>Drop files anywhere on this page</h2>
			<p class="dz-sub">or <u>click to choose</u> &middot; paste BPMN XML &middot; up to ${MAX_FILES_PER_DROP} files &middot; ${kb} KB each</p>
		</div>
		<input id="fileInput" type="file" class="hidden" multiple accept="${accept}">
		<div id="errors" class="errors hidden"></div>
		<p class="legal">By uploading you agree to the <a href="/drop/terms">Terms of Use</a> and acknowledge the <a href="/drop/privacy">Privacy Policy</a>. Shared links are public to anyone who has them.</p>

		<div id="result" class="panel result hidden">
			<div class="link-row"><input id="shareUrl" readonly aria-label="Share link"><button id="copyBtn" class="btn-ghost" type="button">Copy</button><a id="openBtn" class="btn-ghost" href="#">Open &#8599;</a></div>
			<iframe id="preview" title="Preview"></iframe>
		</div>

		<div id="previewPanel" class="panel">
			<div class="panel-bar"><span>loan-approval.bpmn</span><span class="grow"></span><span>live preview</span></div>
			<div id="heroCanvas" class="hero-canvas"><div class="hero-canvas-msg">Loading preview…</div></div>
		</div>
	</div>
</div></section>

<section class="section"><div class="section-inner">
	<div class="section-head"><span class="section-num">01</span><h2 class="section-h2">Three steps to a shared link</h2></div>
	<div class="grid grid--rule">
		<div class="cell"><span class="cell-num">01</span><h3>Drop your files</h3><p>BPMN, DMN &amp; Camunda Forms — one or many at once.</p></div>
		<div class="cell"><span class="cell-num">02</span><h3>Get a short link</h3><p>Validated, converted, and stored — ready in a second.</p></div>
		<div class="cell"><span class="cell-num">03</span><h3>Share it anywhere</h3><p>Paste it in Slack, a PR, a ticket — it just renders.</p></div>
	</div>
	<div id="stats" class="grid grid--rule stats" hidden>
		<div class="cell"><span class="stat-n" id="statDrops">—</span><span class="stat-l">diagrams shared</span></div>
		<div class="cell"><span class="stat-n" id="statViews">—</span><span class="stat-l">views delivered</span></div>
	</div>

	<div class="grid grid--boxed" style="margin-top:34px">
		<div class="cell"><h3>Renders in the browser</h3><p>Real BPMN/DMN/Form viewers — not a screenshot.</p></div>
		<div class="cell"><h3>No account needed</h3><p>No sign-up, no upload dance. Drop &amp; go.</p></div>
		<div class="cell"><h3>See who's viewing</h3><p>A live count of everyone looking right now.</p></div>
		<div class="cell"><h3>Links that last</h3><p>Kept for 90 days after they're last opened.</p></div>
	</div>
</div></section>

<section class="section section--dark"><div class="section-inner">
	<div class="section-head"><span class="section-num">02</span><h2 class="section-h2">What people drop</h2></div>
	<div class="grid grid--rule">
		<div class="cell"><div class="uc-diagram" data-uc="review"></div><span class="cell-num">Code review</span><h3>Next to the PR</h3><p>Attach the process next to the PR that implements it.</p></div>
		<div class="cell"><div class="uc-diagram" data-uc="incident"></div><span class="cell-num">Incident channel</span><h3>Stop describing it</h3><p>Stop describing the flow in Slack. Drop it.</p></div>
		<div class="cell"><div class="uc-diagram" data-uc="docs"></div><span class="cell-num">Docs &amp; tickets</span><h3>Never stale</h3><p>A link that renders beats a stale screenshot.</p></div>
		<div class="cell"><div class="uc-diagram" data-uc="handoff"></div><span class="cell-num">Client handoff</span><h3>No modeler needed</h3><p>Send a process draft without asking anyone to install a modeler.</p></div>
	</div>
</div></section>

<section class="section"><div class="section-inner">
	<div class="section-head"><span class="section-num">03</span><h2 class="section-h2">Has an API, too</h2></div>
	<p class="section-lead section-indent" style="margin-bottom:26px">No account, fully scriptable — drop straight from your terminal.</p>
	<pre class="code"><span class="c-comment"># upload — returns a shareId and URL</span>
<span class="c-prompt">$</span> curl -F files=@order.bpmn https://bpmnkit.com/drop/api/drops
{ <span class="c-string">"shareId"</span>: <span class="c-string">"aB3xY7kQn2p"</span>, <span class="c-string">"url"</span>: <span class="c-string">"/drop/aB3xY7kQn2p"</span>, <span class="c-string">"files"</span>: [ … ] }

<span class="c-comment"># then, with the shareId</span>
<span class="c-prompt">$</span> curl https://bpmnkit.com/drop/aB3xY7kQn2p/manifest.json
<span class="c-prompt">$</span> curl <span class="c-string">"https://bpmnkit.com/drop/aB3xY7kQn2p/f/order.bpmn?format=json"</span></pre>
</div></section>

<section class="section"><div class="section-inner">
	<div class="section-head"><span class="section-num">04</span><h2 class="section-h2">Questions</h2></div>
	<div class="faq">
		<details name="faq" open><summary>How long do links last?</summary><p>90 days after a drop is last opened. Every view slides the window forward, so links people actually use stay alive; abandoned ones clean themselves up.</p></details>
		<details name="faq"><summary>Who can see my diagram?</summary><p>Anyone with the link. Links are unguessable (64 bits of randomness) and never listed anywhere, but they aren't otherwise access-controlled — don't drop confidential material.</p></details>
		<details name="faq"><summary>What can I drop?</summary><p>BPMN 2.0, DMN, and Camunda Form files — up to ${MAX_FILES_PER_DROP} at once. Only files that parse are stored; this isn't a generic file host.</p></details>
		<details name="faq"><summary>Is it really free?</summary><p>Yes. No account, no sign-up, no payment. Just drop and share.</p></details>
		<details name="faq"><summary>Can I delete a drop?</summary><p>Drops expire on their own, and you can <a href="/drop/privacy">report</a> anything that shouldn't be up. Per-uploader deletion is on the roadmap.</p></details>
	</div>
</div></section>

</main>
${pageFooter()}`
	return shell({
		title: "BPMN Kit Drop — share BPMN, DMN & Form files",
		description:
			"Drop a BPMN, DMN, or Camunda Form file and get a short shareable link that renders it in the browser.",
		main,
		nav: true,
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

/** The read-only share/viewer page for a stored drop. `aiEnabled` reflects whether AI_PASSCODE is set. */
export function sharePage(
	shareId: string,
	drop: DropRow,
	files: FileInfo[],
	aiEnabled = false,
	turnstileKey?: string,
): string {
	const primary = primaryIndex(files)
	const title = files[primary]?.name || files[primary]?.filename || "Shared diagram"
	const created = new Date(drop.created_at).toISOString().slice(0, 10)
	const expires = drop.expires_at ? new Date(drop.expires_at).toISOString().slice(0, 10) : "never"

	const tabs = files
		.map(
			(f, i) =>
				`<button class="ed-tab${i === primary ? " active" : ""}" role="tab" data-index="${i}" title="${escapeHtml(f.filename)}"><span class="ed-type">${f.kind.toUpperCase()}</span><span class="ed-tab-name">${escapeHtml(f.name || f.filename)}</span></button>`,
		)
		.join("")

	const main = `<div class="ed-topbar">
	<div class="ed-tabs" role="tablist">${tabs}</div>
	<div class="ed-tools">
		<span class="ed-info" title="Created ${created} · expires ${expires}"><span id="viewCount">${drop.view_count}</span> VIEWS · <span id="presence" hidden>0 VIEWING</span> · EXPIRES ${expires}</span>
		<div class="ed-group">
			${aiEnabled ? `<button id="aiReviewBtn" type="button" hidden>AI review</button>` : ""}
			<button id="editBtn" type="button" hidden>Edit</button>
			<button id="doneBtn" type="button" hidden>Done</button>
			<button id="localHistoryBtn" type="button" hidden>On this device</button>
			<button id="historyBtn" type="button" hidden>History</button>
			<a id="dlOriginal" href="#" download>Original</a>
			<a id="dlJson" href="#" download>JSON</a>
			<button id="copyLink" type="button">Copy link</button>
			<button id="reportBtn" type="button">Report</button>
		</div>
		<a class="ed-brand" href="/drop">bpmn<b>kit</b></a>
	</div>
</div>
<div class="stage">
	<div id="viewer" class="viewer"><div class="viewer-msg">Loading…</div></div>
	<div class="ed-zoom ed-group" id="zoombar" hidden>
		<button id="zoomOut" type="button" aria-label="Zoom out">&minus;</button>
		<button id="zoomReset" type="button" aria-label="Reset to 100%"><span id="zoomLevel">100%</span></button>
		<button id="zoomIn" type="button" aria-label="Zoom in">+</button>
		<button id="zoomFit" type="button" aria-label="Fit diagram" title="Fit diagram">FIT</button>
	</div>
	<div id="historyBanner" class="hv-banner" hidden><span id="historyBannerText"></span><button id="historyExit" class="hv-btn" type="button">Back to current</button></div>
	<div id="editNotice" class="hv-banner" hidden><span id="editNoticeText"></span></div>
	<dialog id="turnstileDialog" class="ts-dialog">
		<div class="ts-title">One check before you edit</div>
		<div id="turnstileWidget"></div>
		<div id="turnstileError" class="ts-error" hidden>That did not go through — close this and try again.</div>
		<button id="turnstileCancel" class="ts-cancel" type="button">Cancel</button>
	</dialog>
	<aside id="localHistoryPanel" class="ai-panel" hidden>
		<header class="ai-head"><span>On this device</span><button id="localHistoryClose" class="ai-x" type="button" aria-label="Close">&times;</button></header>
		<div id="localHistoryBody" class="ai-body"></div>
		<footer class="ai-foot">Checkpoints in this browser only — nobody else can see them, and clearing site data removes them.</footer>
	</aside>
	<aside id="historyPanel" class="ai-panel" hidden>
		<header class="ai-head"><span>Saved milestones</span><button id="historyClose" class="ai-x" type="button" aria-label="Close">&times;</button></header>
		<div id="historyBody" class="ai-body"></div>
		<footer class="ai-foot"><span id="historyBound"></span></footer>
	</aside>
	<a class="ed-github" href="https://github.com/bpmnkit/monorepo" target="_blank" rel="noopener"><img class="logo" src="${FAVICON}" alt="">GitHub</a>
	${
		aiEnabled
			? `<aside id="aiPanel" class="ai-panel" hidden>
		<header class="ai-head"><span>AI process review</span><button id="aiClose" class="ai-x" type="button" aria-label="Close">&times;</button></header>
		<div id="aiBody" class="ai-body"></div>
		<footer class="ai-foot"><span id="aiModel"></span>AI can be wrong — always review before acting.</footer>
	</aside>`
			: ""
	}
</div>
${reportDialog()}
${
	// Loaded on the share page only, and only when a key is configured — which is
	// also the only page whose content policy has been widened to allow it.
	turnstileKey
		? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>`
		: ""
}`

	return shell({
		title: `${title} — BPMN Kit Drop`,
		description: `A shared ${files[primary]?.kind ?? "BPMN"} diagram on BPMN Kit Drop.`,
		main,
		bodyClass: "app",
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
					// The editor addresses one process; the page says so up front
					// rather than offering Edit and having the room turn it down.
					processes: f.meta.processes ?? 1,
				})),
				primaryIndex: primary,
				// An operator marked this drop as never expiring, which also makes it
				// read-only — anyone-with-the-link editing is wrong for a fixture.
				pinned: drop.expires_at === null,
				turnstileKey,
			},
		},
		scriptSrc: "/drop/assets/viewer.js",
	})
}

/**
 * Two drops compared side by side. Both file lists are BPMN-only — the caller
 * filters — and each side gets a picker so a multi-file drop can be aimed.
 */
export function diffPage(aId: string, bId: string, aFiles: FileInfo[], bFiles: FileInfo[]): string {
	const options = (files: FileInfo[]): string =>
		files
			.map((f, i) => `<option value="${i}">${escapeHtml(f.name || f.filename)}</option>`)
			.join("")

	const main = `<div class="ed-topbar">
	<div class="ed-tools" style="margin-left:0;margin-right:auto;border-left:none;border-right:1px solid var(--bpmnkit-ds-line)">
		<select id="leftPick" class="ed-select" aria-label="Earlier diagram">${options(aFiles)}</select>
		<span class="ed-info">&rarr;</span>
		<select id="rightPick" class="ed-select" aria-label="Later diagram">${options(bFiles)}</select>
	</div>
	<div class="ed-tools">
		<span class="ed-info" id="diffSummary">Comparing&hellip;</span>
		<div class="ed-group">
			<a href="/drop/${escapeHtml(aId)}">Open left</a>
			<a href="/drop/${escapeHtml(bId)}">Open right</a>
		</div>
		<a class="ed-brand" href="/drop">bpmn<b>kit</b></a>
	</div>
</div>
<div class="stage diff-stage">
	<div id="leftPane" class="viewer diff-pane"><div class="viewer-msg">Loading&hellip;</div></div>
	<div id="rightPane" class="viewer diff-pane"><div class="viewer-msg">Loading&hellip;</div></div>
</div>`

	return shell({
		title: "Compare diagrams — BPMN Kit Drop",
		description: "Two shared BPMN diagrams compared side by side on BPMN Kit Drop.",
		main,
		bodyClass: "app",
		noindex: true,
		bootstrap: {
			id: "diff-data",
			data: {
				left: { shareId: aId, files: aFiles.map((f) => f.filename) },
				right: { shareId: bId, files: bFiles.map((f) => f.filename) },
			},
		},
		scriptSrc: "/drop/assets/diff.js",
	})
}

function reportDialog(): string {
	const options = REPORT_REASONS.map(
		(r: ReportReason) => `<option value="${r}">${r.replace("-", " ")}</option>`,
	).join("")
	return `<dialog id="reportDialog">
<form method="dialog">
	<strong>Report this drop</strong>
	<div class="field"><label for="reportReason">Reason</label><select id="reportReason">${options}</select></div>
	<div class="field"><label for="reportDetails">Details (optional)</label><textarea id="reportDetails" rows="3"></textarea></div>
	<div class="row">
		<button value="cancel" class="btn-ghost" type="submit">Cancel</button>
		<button id="reportSubmit" value="submit" class="btn-primary" type="submit">Submit report</button>
	</div>
</form>
</dialog>`
}

/** The token-gated moderation page. */
export function adminPage(): string {
	const main = `<main class="wrap">
<h1 class="section-h2">Drop moderation</h1>
<p class="lead">Paste the operator token to review reports and delete drops. The token stays in this tab only.</p>
<div class="field"><label for="token">Admin token</label><input id="token" type="password"></div>
<div class="row"><button id="loadBtn" class="btn-primary" type="button">Load reports</button></div>
<div class="field" style="margin-top:20px"><label for="manualId">Share id to delete directly</label><input id="manualId"></div>
<div class="row"><button id="delBtn" class="btn-ghost" type="button">Delete</button><button id="banBtn" class="btn-ghost" type="button">Delete + ban</button></div>
<div id="msg" class="notice"></div>
<div id="reports"></div>
</main>`
	return shell({
		title: "Drop moderation",
		description: "Operator moderation for BPMN Kit Drop.",
		main,
		nav: true,
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
<p class="lead">BPMN Kit Drop &middot; version ${escapeHtml(tosVersion)}</p>
${body}
</main>
${pageFooter()}`
	return shell({ title: `${title} — BPMN Kit Drop`, description: title, main, nav: true })
}

/** A friendly 404 for unknown or expired share ids. */
export function notFoundPage(): string {
	const main = `<main class="wrap prose">
<h1>Not found</h1>
<p class="lead">Nothing here</p>
<p>This drop doesn't exist, or it has expired. Drops are kept for 90 days after they were last viewed.</p>
<p><a class="btn-primary" href="/drop">Create a new drop</a></p>
</main>`
	return shell({
		title: "Not found — BPMN Kit Drop",
		description: "Drop not found.",
		main,
		nav: true,
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
