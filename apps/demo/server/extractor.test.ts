import { describe, expect, it } from "vitest"
import { extractTsBlock, extractXmlBlock } from "./extractor.js"

describe("extractXmlBlock", () => {
  it("returns null when no XML present", () => {
    expect(extractXmlBlock("no xml here")).toBeNull()
  })

  it("extracts a BPMN XML block", () => {
    const text = 'Some text\n<?xml version="1.0"?>\n<bpmn:definitions>foo</bpmn:definitions>\nTrailing'
    const result = extractXmlBlock(text)
    expect(result).toBe('<?xml version="1.0"?>\n<bpmn:definitions>foo</bpmn:definitions>')
  })

  it("handles definitions without bpmn: prefix", () => {
    const text = '<?xml version="1.0"?>\n<definitions>bar</definitions>'
    const result = extractXmlBlock(text)
    expect(result).toBe('<?xml version="1.0"?>\n<definitions>bar</definitions>')
  })
})

describe("extractTsBlock", () => {
  it("returns null when no code present", () => {
    expect(extractTsBlock("no code here")).toBeNull()
  })

  it("strips typescript fences", () => {
    const text = "```typescript\nconst x = 1\n```"
    expect(extractTsBlock(text)).toBe("const x = 1")
  })

  it("strips ts fences", () => {
    const text = "```ts\nconst x = 1\n```"
    expect(extractTsBlock(text)).toBe("const x = 1")
  })

  it("strips plain code fences", () => {
    const text = "```\nconst x = 1\n```"
    expect(extractTsBlock(text)).toBe("const x = 1")
  })

  it("returns text unchanged when already raw TS (no fences)", () => {
    const text = "import { Bpmn } from '@bpmnkit/core'\nconst x = 1"
    expect(extractTsBlock(text)).toBe(text)
  })
})
