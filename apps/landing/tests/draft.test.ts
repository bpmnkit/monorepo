import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	DRAFT_KEY,
	MAX_DRAFT_AGE_MS,
	clearDraft,
	describeAge,
	dismissPrompt,
	isPromptDismissed,
	readDraft,
	saveDraft,
} from "../src/scripts/draft.js"

/** A minimal in-memory Storage, so the module under test is the only thing being tested. */
function fakeStorage(): Storage & { throwOnWrite?: boolean } {
	const map = new Map<string, string>()
	return {
		get length() {
			return map.size
		},
		key: (i: number) => [...map.keys()][i] ?? null,
		getItem: (k: string) => map.get(k) ?? null,
		setItem(k: string, v: string) {
			if ((this as { throwOnWrite?: boolean }).throwOnWrite) {
				throw new DOMException("quota", "QuotaExceededError")
			}
			map.set(k, v)
		},
		removeItem: (k: string) => void map.delete(k),
		clear: () => map.clear(),
	} as Storage
}

let store: Storage

beforeEach(() => {
	store = fakeStorage()
	vi.stubGlobal("localStorage", store)
	vi.stubGlobal("sessionStorage", fakeStorage())
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("saveDraft / readDraft", () => {
	it("round-trips a diagram", () => {
		saveDraft("<definitions/>", "order.bpmn", 1000)
		expect(readDraft(1000)).toEqual({ xml: "<definitions/>", name: "order.bpmn", savedAt: 1000 })
	})

	it("keeps only one draft — the editor has one active diagram", () => {
		saveDraft("<first/>", "a.bpmn", 1000)
		saveDraft("<second/>", "b.bpmn", 2000)
		expect(readDraft(2000)?.xml).toBe("<second/>")
	})

	it("returns null when nothing was ever drafted", () => {
		expect(readDraft()).toBeNull()
	})

	it("accepts an unnamed diagram", () => {
		saveDraft("<definitions/>", null, 1000)
		expect(readDraft(1000)?.name).toBeNull()
	})

	it("never throws when storage is full — a lost draft must not break the editor", () => {
		;(store as { throwOnWrite?: boolean }).throwOnWrite = true
		expect(() => saveDraft("<definitions/>", "order.bpmn")).not.toThrow()
	})

	it("survives storage being unavailable entirely", () => {
		vi.stubGlobal("localStorage", undefined)
		expect(() => saveDraft("<definitions/>", null)).not.toThrow()
		expect(readDraft()).toBeNull()
		expect(() => clearDraft()).not.toThrow()
	})
})

describe("readDraft — bad and stale values", () => {
	it("discards a draft past the age limit rather than offering it back", () => {
		saveDraft("<definitions/>", "order.bpmn", 0)
		expect(readDraft(MAX_DRAFT_AGE_MS + 1)).toBeNull()
		// …and clears it, so it cannot sit there prompting forever.
		expect(store.getItem(DRAFT_KEY)).toBeNull()
	})

	it("keeps a draft that is exactly at the age limit", () => {
		saveDraft("<definitions/>", "order.bpmn", 0)
		expect(readDraft(MAX_DRAFT_AGE_MS)).not.toBeNull()
	})

	it("clears unparseable JSON instead of throwing", () => {
		store.setItem(DRAFT_KEY, "{not json")
		expect(readDraft()).toBeNull()
		expect(store.getItem(DRAFT_KEY)).toBeNull()
	})

	it("rejects a well-formed object that is not a draft", () => {
		store.setItem(DRAFT_KEY, JSON.stringify({ xml: 42, savedAt: "soon" }))
		expect(readDraft()).toBeNull()
		expect(store.getItem(DRAFT_KEY)).toBeNull()
	})

	it("rejects an empty diagram", () => {
		store.setItem(DRAFT_KEY, JSON.stringify({ xml: "", name: null, savedAt: Date.now() }))
		expect(readDraft()).toBeNull()
	})
})

describe("clearDraft", () => {
	it("removes the draft once the work is safe", () => {
		saveDraft("<definitions/>", "order.bpmn", 1000)
		clearDraft()
		expect(readDraft(1000)).toBeNull()
	})
})

describe("the prompt is answered once per tab", () => {
	it("starts undismissed", () => {
		expect(isPromptDismissed()).toBe(false)
	})

	it("stays dismissed after answering", () => {
		dismissPrompt()
		expect(isPromptDismissed()).toBe(true)
	})

	it("does not touch the draft itself — declining must not destroy work", () => {
		saveDraft("<definitions/>", "order.bpmn", 1000)
		dismissPrompt()
		expect(readDraft(1000)?.xml).toBe("<definitions/>")
	})
})

describe("describeAge", () => {
	const s = 1000
	const m = 60 * s
	const h = 60 * m
	const d = 24 * h

	it("reads naturally at each scale", () => {
		expect(describeAge(0, 5 * s)).toBe("just now")
		expect(describeAge(0, 59 * s)).toBe("just now")
		expect(describeAge(0, 8 * m)).toBe("8 minutes ago")
		expect(describeAge(0, 3 * h)).toBe("3 hours ago")
		expect(describeAge(0, 3 * d)).toBe("3 days ago")
	})

	it("singularises", () => {
		expect(describeAge(0, 1 * m)).toBe("1 minute ago")
		expect(describeAge(0, 1 * h)).toBe("1 hour ago")
		expect(describeAge(0, 1 * d)).toBe("1 day ago")
	})

	it("does not report a negative age when clocks disagree", () => {
		expect(describeAge(5 * m, 0)).toBe("just now")
	})
})
