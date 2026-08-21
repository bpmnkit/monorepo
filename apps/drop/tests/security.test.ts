import { describe, expect, it } from "vitest"
import type { DropRow, FileInfo } from "../src/lib/db.js"
import { escapeHtml, jsonForScript } from "../src/lib/http.js"
import { sharePage } from "../src/lib/pages.js"
import { validateFile } from "../src/lib/validate.js"

describe("escapeHtml", () => {
	it("neutralizes HTML metacharacters", () => {
		expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
			"&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
		)
	})
})

describe("jsonForScript", () => {
	it("prevents breaking out of a <script> tag", () => {
		const out = jsonForScript({ x: "</script><img src=x onerror=alert(1)>" })
		expect(out).not.toContain("</script>")
		expect(out).not.toContain("<img")
		// still valid JSON once the unicode escapes are parsed
		expect(JSON.parse(out).x).toBe("</script><img src=x onerror=alert(1)>")
	})
})

describe("share page rendering", () => {
	const drop: DropRow = {
		id: "share1",
		file_count: 1,
		size_total: 10,
		tos_version: "v",
		created_at: 0,
		last_viewed_at: 0,
		view_count: 0,
		expires_at: null,
	}
	const files: FileInfo[] = [
		{
			id: "f1",
			position: 0,
			kind: "bpmn",
			filename: `a"><img src=x onerror=alert(1)>.bpmn`,
			name: "<script>alert(1)</script>",
			sizeOriginal: 10,
			sizeJson: 10,
			meta: {},
		},
	]

	it("escapes attacker-controlled file names and titles", () => {
		const out = sharePage("share1", drop, files)
		expect(out).not.toContain("<img src=x onerror")
		expect(out).not.toContain("<script>alert(1)</script>")
		expect(out).toContain("&lt;script&gt;")
	})
})

describe("XML parsing safety", () => {
	it("does not expand custom entities (XXE / billion-laughs)", () => {
		const payload = `<?xml version="1.0"?>
<!DOCTYPE definitions [ <!ENTITY lol "LOLSECRET"> ]>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="t">
  <bpmn:process id="p" name="&lol;"><bpmn:startEvent id="s"/></bpmn:process>
</bpmn:definitions>`
		let json = ""
		try {
			json = validateFile("x.bpmn", payload).json
		} catch {
			json = ""
		}
		expect(json).not.toContain("LOLSECRET")
	})
})
