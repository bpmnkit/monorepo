/**
 * The "Share as a drop" dialog — a one-shot modal that posts the open diagram via
 * `share-drop.ts` and hands back the link.
 */
import { injectChromeStyles, injectStyle } from "@bpmnkit/editor"
import { dropFileName, shareToDrop } from "./share-drop.js"

const STYLE_ID = "bpmnkit-share-drop-styles"

/** Where the dialog reads the diagram from when the user confirms. */
export interface ShareTarget {
	/** The BPMN XML to share, or null when there is nothing open. */
	getXml(): string | null
	/** The open file's name, or null for an unsaved diagram. */
	getFileName(): string | null
	/** Called once the diagram has a URL — the caller's cue that it is no longer unsaved. */
	onShared?(): void
}

// Flat, square and hairline-ruled, on the `--bpmnkit-chrome-*` tokens the editor
// already injects — so the dialog follows the canvas through light, dark and neon
// without restating a palette.
const SHARE_DROP_CSS = `
/* A modal <dialog> centres itself with \`margin: auto\`, which a host page's
   \`* { margin: 0 }\` reset silently removes — as the editor page's does. */
.sd-dialog {
  margin: auto;
  border: 1px solid var(--bpmnkit-chrome-line, #d8dbe0);
  border-radius: 0;
  padding: 0;
  width: min(440px, calc(100vw - 32px));
  background: var(--bpmnkit-chrome-ground, #ffffff);
  color: var(--bpmnkit-chrome-ink, #14161a);
  font-family: var(--bpmnkit-chrome-font, system-ui, -apple-system, sans-serif);
  font-size: 13px;
  line-height: 1.55;
}
.sd-dialog::backdrop { background: var(--bpmnkit-chrome-scrim, rgba(20, 22, 26, 0.62)); }
.sd-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line, #d8dbe0);
}
.sd-title { font-size: 14px; font-weight: 600; margin: 0; }
.sd-eyebrow {
  font-family: var(--bpmnkit-chrome-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 10px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4, #8b929c);
}
.sd-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.sd-lead { margin: 0; color: var(--bpmnkit-chrome-ink-2, #4b5158); }
.sd-file {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--bpmnkit-chrome-line-soft, #e4e6ea);
  background: var(--bpmnkit-chrome-ground-2, #f4f5f7);
  font-family: var(--bpmnkit-chrome-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.sd-file-label {
  font-size: 10px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4, #8b929c);
  flex: none;
}
.sd-legal { margin: 0; font-size: 11.5px; color: var(--bpmnkit-chrome-ink-4, #8b929c); }
.sd-legal a { color: var(--bpmnkit-chrome-accent, #a8503a); }
.sd-msg {
  margin: 0;
  padding: 9px 12px;
  border: 1px solid var(--bpmnkit-chrome-line, #d8dbe0);
  border-left: 2px solid var(--bpmnkit-chrome-accent, #a8503a);
  background: var(--bpmnkit-chrome-accent-subtle, rgba(168, 80, 58, 0.1));
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.sd-link-row { display: flex; gap: 8px; }
/* An explicit \`display\` outranks the UA's \`[hidden] { display: none }\`, so the
   rows and buttons this dialog toggles have to opt back in. */
.sd-link-row[hidden], .sd-btn[hidden] { display: none; }
.sd-link {
  flex: 1 1 auto;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--bpmnkit-chrome-line, #d8dbe0);
  border-radius: 0;
  background: var(--bpmnkit-chrome-ground-2, #f4f5f7);
  color: var(--bpmnkit-chrome-ink, #14161a);
  font-family: var(--bpmnkit-chrome-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 12px;
}
.sd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--bpmnkit-chrome-line, #d8dbe0);
}
.sd-btn {
  padding: 7px 14px;
  border: 1px solid var(--bpmnkit-chrome-line, #d8dbe0);
  border-radius: 0;
  background: var(--bpmnkit-chrome-ground, #ffffff);
  color: var(--bpmnkit-chrome-ink, #14161a);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.sd-btn:hover:not(:disabled) { background: var(--bpmnkit-chrome-hover, #f4f5f7); }
.sd-btn:disabled { opacity: 0.55; cursor: default; }
.sd-btn:focus-visible {
  outline: 2px solid var(--bpmnkit-chrome-accent, #a8503a);
  outline-offset: 1px;
}
.sd-btn-primary {
  background: var(--bpmnkit-chrome-accent, #a8503a);
  border-color: var(--bpmnkit-chrome-accent, #a8503a);
  color: var(--bpmnkit-chrome-accent-fg, #ffffff);
}
.sd-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
`

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag)
	if (className) node.className = className
	// textContent throughout: a process name is user content, not markup.
	if (text !== undefined) node.textContent = text
	return node
}

/**
 * Opens the share dialog. Builds a fresh `<dialog>` each time and removes it on
 * close, so repeated shares cannot stack stale nodes in the document.
 */
export function openShareDropDialog(target: ShareTarget): void {
	injectChromeStyles()
	injectStyle(STYLE_ID, SHARE_DROP_CSS)

	const xml = target.getXml()
	const filename = dropFileName(target.getFileName())

	const dialog = el("dialog", "sd-dialog")
	dialog.setAttribute("aria-labelledby", "sd-title")

	const head = el("div", "sd-head")
	const title = el("h2", "sd-title", "Share as a drop")
	title.id = "sd-title"
	head.append(title, el("span", "sd-eyebrow", "bpmnkit.com/drop"))

	const body = el("div", "sd-body")
	const lead = el(
		"p",
		"sd-lead",
		"Uploads this diagram to BPMN Kit Drop and gives you a link that renders it in the browser. No account needed.",
	)
	const file = el("div", "sd-file")
	file.append(el("span", "sd-file-label", "File"), el("span", "sd-file-name", filename))

	const legal = el("p", "sd-legal")
	legal.append(document.createTextNode("By sharing you agree to the "))
	const terms = el("a", undefined, "Terms of Use")
	terms.href = "/drop/terms"
	terms.target = "_blank"
	terms.rel = "noopener"
	const privacy = el("a", undefined, "Privacy Policy")
	privacy.href = "/drop/privacy"
	privacy.target = "_blank"
	privacy.rel = "noopener"
	legal.append(
		terms,
		document.createTextNode(" and acknowledge the "),
		privacy,
		document.createTextNode(". Shared links are public to anyone who has them."),
	)

	const message = el("p", "sd-msg")
	message.hidden = true

	const linkRow = el("div", "sd-link-row")
	linkRow.hidden = true
	const link = el("input", "sd-link")
	link.readOnly = true
	link.setAttribute("aria-label", "Share link")
	const copy = el("button", "sd-btn", "Copy")
	copy.type = "button"
	const open = el("a", "sd-btn", "Open")
	open.target = "_blank"
	open.rel = "noopener"
	linkRow.append(link, copy, open)

	body.append(lead, file, legal, message, linkRow)

	const actions = el("div", "sd-actions")
	const cancel = el("button", "sd-btn", "Cancel")
	cancel.type = "button"
	const share = el("button", "sd-btn sd-btn-primary", "Share")
	share.type = "button"
	actions.append(cancel, share)

	dialog.append(head, body, actions)
	document.body.append(dialog)
	dialog.addEventListener("close", () => dialog.remove())

	function showMessage(text: string): void {
		message.textContent = text
		message.hidden = false
	}

	function fail(text: string): void {
		showMessage(text)
		share.disabled = false
		share.textContent = "Try again"
	}

	function succeed(path: string): void {
		target.onShared?.()
		const href = new URL(path, location.href).href
		link.value = href
		open.href = href
		linkRow.hidden = false
		message.hidden = true
		share.hidden = true
		cancel.textContent = "Done"
		link.focus()
		link.select()
	}

	if (xml === null) {
		showMessage("There is no BPMN diagram open to share.")
		share.disabled = true
	}

	share.addEventListener("click", () => {
		if (xml === null) return
		message.hidden = true
		share.disabled = true
		share.textContent = "Sharing…"
		void shareToDrop(xml, filename).then((outcome) => {
			if (outcome.ok) succeed(outcome.path)
			else fail(outcome.message)
		})
	})

	copy.addEventListener("click", () => {
		// The clipboard API is absent outside a secure context and can reject when
		// the user declines. Either way the link is on screen, so fall back to
		// selecting it rather than leaving the click doing nothing.
		const selectInstead = (): void => {
			link.focus()
			link.select()
		}
		if (!navigator.clipboard) return selectInstead()
		void navigator.clipboard.writeText(link.value).then(() => {
			copy.textContent = "Copied"
			setTimeout(() => {
				copy.textContent = "Copy"
			}, 1500)
		}, selectInstead)
	})

	cancel.addEventListener("click", () => dialog.close())
	dialog.showModal()
}
