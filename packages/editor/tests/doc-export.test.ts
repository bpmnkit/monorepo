// @vitest-environment happy-dom
import { Dmn } from "@bpmnkit/core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BpmnEditor } from "../src/editor.js"
import { initEditorHud } from "../src/hud.js"
import { createTranslationRecorder } from "../src/i18n.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="d" targetNamespace="x">
  <bpmn:process id="proc" name="Claim handling" isExecutable="true">
    <bpmn:startEvent id="start" name="Claim in"/>
    <bpmn:businessRuleTask id="score" name="Score &lt;claim&gt;">
      <bpmn:extensionElements><zeebe:calledDecision decisionId="risk" resultVariable="r"/></bpmn:extensionElements>
    </bpmn:businessRuleTask>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="score"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="80" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="score"><dc:Bounds x="200" y="60" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

const RISK = Dmn.createDecisionTable("risk")
	.name("Risk")
	.input({ label: "Amount", expression: "amount" })
	.output({ label: "Level", name: "level" })
	.rule({ inputs: ["> 10"], outputs: ['"high"'] })
	.build()

/** Captures what the export hands to the browser instead of downloading it. */
function captureDownloads(): Array<{ name: string; blob: Blob }> {
	const saved: Array<{ name: string; blob: Blob }> = []
	const blobs = new Map<string, Blob>()
	let n = 0
	vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
		const url = `blob:test/${n++}`
		blobs.set(url, blob as Blob)
		return url
	})
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
		this: HTMLAnchorElement,
	) {
		const blob = blobs.get(this.href)
		if (blob) saved.push({ name: this.download, blob })
	})
	return saved
}

function mount(translate?: (s: string) => string) {
	const container = document.createElement("div")
	document.body.appendChild(container)
	const editor = new BpmnEditor({ container, xml: XML, grid: false, fit: "none", translate })
	initEditorHud(editor, { getDocumentationContext: () => ({ decisions: [RISK] }) })
	return { container, editor }
}

function openExport(container: HTMLElement): HTMLElement {
	container.querySelector<HTMLButtonElement>("#btn-top-more")?.click()
	const item = [...container.querySelectorAll<HTMLButtonElement>(".drop-item")].find((el) =>
		el.textContent?.includes("Export documentation"),
	)
	if (!item) throw new Error("no Export documentation item in the More menu")
	item.click()
	const modal = document.querySelector<HTMLElement>(".bpmnkit-hud-modal")
	if (!modal) throw new Error("the export modal did not open")
	return modal
}

function choose(modal: HTMLElement, label: string): void {
	const btn = [...modal.querySelectorAll<HTMLButtonElement>(".bpmnkit-hud-modal-choice")].find(
		(b) => b.textContent?.startsWith(label),
	)
	if (!btn) throw new Error(`no choice "${label}"`)
	btn.click()
}

afterEach(() => {
	vi.restoreAllMocks()
	document.body.innerHTML = ""
})

describe("Export documentation", () => {
	it("offers print view, HTML, Markdown and Word from the More menu", () => {
		const { container, editor } = mount()
		const modal = openExport(container)
		const labels = [...modal.querySelectorAll(".bpmnkit-hud-modal-choice > span:first-child")].map(
			(s) => s.textContent,
		)
		expect(labels).toEqual([
			"Open print view",
			"Download HTML",
			"Download Markdown",
			"Download Word",
		])
		editor.destroy()
	})

	it("downloads Markdown with the linked decision and closes the modal", async () => {
		const saved = captureDownloads()
		const { container, editor } = mount()
		choose(openExport(container), "Download Markdown")
		expect(document.querySelector(".bpmnkit-hud-modal")).toBeNull()
		expect(saved.map((s) => s.name)).toEqual(["claim-handling-documentation.md"])
		const md = await saved[0]?.blob.text()
		expect(md).toContain("# Claim handling")
		expect(md).toContain("Score &lt;claim&gt;")
		expect(md).toContain("## Decisions")
		editor.destroy()
	})

	it("opens the print view in a new tab, and downloads it when pop-ups are blocked", async () => {
		const saved = captureDownloads()
		const open = vi.spyOn(window, "open").mockReturnValue({} as Window)
		const { container, editor } = mount()
		choose(openExport(container), "Open print view")
		expect(open).toHaveBeenCalledWith("blob:test/0", "_blank")
		expect(saved).toEqual([])

		open.mockReturnValue(null)
		choose(openExport(container), "Open print view")
		expect(saved.map((s) => s.name)).toEqual(["claim-handling-documentation.html"])
		const html = await saved[0]?.blob.text()
		expect(html).toContain("@media print")
		expect(html).toContain('id="decision-risk"')
		editor.destroy()
	})

	it("downloads a Word file", async () => {
		const saved = captureDownloads()
		const { container, editor } = mount()
		choose(openExport(container), "Download Word")
		expect(saved[0]?.name).toBe("claim-handling-documentation.docx")
		const bytes = new Uint8Array(await (saved[0]?.blob as Blob).arrayBuffer())
		expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
		editor.destroy()
	})

	it("asks the editor's translator for every string it shows", () => {
		const recorder = createTranslationRecorder()
		const { container, editor } = mount(recorder.translate)
		openExport(container)
		for (const key of [
			"Export documentation…",
			"Export documentation",
			"Open print view",
			"Download Markdown",
			"Cancel",
		]) {
			expect(recorder.keys()).toContain(key)
		}
		editor.destroy()
	})
})
