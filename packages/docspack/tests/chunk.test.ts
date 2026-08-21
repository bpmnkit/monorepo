import { describe, expect, it } from "vitest"
import { chunkDocument } from "../src/chunk.js"
import { estimateTokens, stem, terms } from "../src/text.js"

describe("stem", () => {
	it("reduces a query word and a documented word to the same stem", () => {
		expect(stem("authenticate")).toBe(stem("authentication"))
		expect(stem("deploying")).toBe(stem("deployed"))
		expect(stem("gateways")).toBe(stem("gateway"))
	})

	it("leaves short words alone", () => {
		expect(stem("id")).toBe("id")
	})
})

describe("terms", () => {
	it("drops stop words", () => {
		expect(terms("how do I use the gateway")).toEqual([stem("gateway")])
	})

	it("keeps a qualified identifier whole and by its parts", () => {
		expect(terms("Bpmn.createProcess")).toContain("bpmn.createprocess")
		expect(terms("Bpmn.createProcess")).toContain(stem("createprocess"))
	})
})

describe("estimateTokens", () => {
	it("is zero only for empty text", () => {
		expect(estimateTokens("   ")).toBe(0)
		expect(estimateTokens("a")).toBeGreaterThan(0)
	})
})

describe("chunkDocument", () => {
	const markdown = `---
title: Quick Start
tags: [tutorial]
---

Intro paragraph that is long enough to stand on its own as a chunk because it keeps
going with several more clauses, sentences and words so that the merge threshold does
not swallow it into the section that follows it in the document body here.

## Step 1: Create a process

<!-- docspack: tags=builder -->
<!-- docspack: entities=Bpmn.createProcess -->

Use \`Bpmn.createProcess\` to describe the process. This paragraph is padded out with
enough words that the section clears the minimum chunk size on its own and is not
merged into whatever comes after it in the source document.

\`\`\`sh
## not a heading, it is a shell comment
\`\`\`

## Step 2: Deploy it

Deploy with \`casen deploy\`. Again this section carries enough prose to clear the
minimum chunk size so the assertions below can count sections rather than merges,
which keeps the test about splitting instead of about packing.
`

	// A low merge threshold so each section here stands alone; merging has its own test.
	const chunks = chunkDocument({ slug: "getting-started/quick-start", markdown }, { minTokens: 30 })

	it("makes one chunk per level-two section plus the intro", () => {
		expect(chunks).toHaveLength(3)
	})

	it("ignores a heading-like line inside a fenced code block", () => {
		const step1 = chunks.find((c) => c.title.includes("Step 1"))
		expect(step1?.body).toContain("it is a shell comment")
	})

	it("builds ids that satisfy the manifest pattern", () => {
		for (const chunk of chunks) expect(chunk.id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
		expect(chunks[0]?.id).toBe("getting-started.quick-start")
		expect(chunks[1]?.id).toBe("getting-started.quick-start.step-1-create-a-process")
	})

	it("carries front matter tags, slug segments and heading words as tags", () => {
		expect(chunks[1]?.tags).toContain("tutorial")
		expect(chunks[1]?.tags).toContain("getting-started")
		expect(chunks[1]?.tags).toContain("process")
	})

	it("takes tags and entities from section directives and keeps them out of the body", () => {
		expect(chunks[1]?.tags).toContain("builder")
		expect(chunks[1]?.entities).toContain("Bpmn.createProcess")
		expect(chunks[1]?.body).not.toContain("docspack:")
	})

	it("titles each chunk with the document and the section", () => {
		expect(chunks[1]?.title).toBe("Quick Start — Step 1: Create a process")
		expect(chunks[1]?.body.startsWith("# Quick Start — Step 1: Create a process")).toBe(true)
	})

	it("merges a section too short to answer anything into the next one", () => {
		const merged = chunkDocument({
			slug: "guides/tiny",
			markdown: "# T\n\n## A\n\nshort\n\n## B\n\nalso short\n",
		})
		expect(merged).toHaveLength(1)
		expect(merged[0]?.body).toContain("also short")
	})

	it("subdivides a section that overruns the token budget", () => {
		const long = `## Big\n\n${Array.from({ length: 40 }, (_, i) => `Paragraph ${i} with a handful of words in it.`).join("\n\n")}\n`
		const parts = chunkDocument({ slug: "guides/long", markdown: long }, { maxTokens: 100 })
		expect(parts.length).toBeGreaterThan(1)
		for (const part of parts) expect(part.tokens).toBeLessThan(300)
	})

	it("links each chunk back to its page when a site URL is configured", () => {
		const [first] = chunkDocument(
			{ slug: "guides/ai", markdown: "# A\n\nbody text here" },
			{ siteUrl: "https://docs.bpmnkit.com" },
		)
		expect(first?.body).toContain("Source: https://docs.bpmnkit.com/guides/ai/")
	})
})
