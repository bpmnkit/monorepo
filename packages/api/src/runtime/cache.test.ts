import { describe, expect, it, vi } from "vitest";
import { Cache } from "./cache.js";

describe("Cache", () => {
	it("stores and retrieves values", () => {
		const cache = new Cache(60_000, 100);
		cache.set("key", { value: 42 });
		expect(cache.get("key")).toEqual({ value: 42 });
	});

	it("returns undefined for missing keys", () => {
		const cache = new Cache(60_000, 100);
		expect(cache.get("missing")).toBeUndefined();
	});

	it("expires entries after TTL", () => {
		vi.useFakeTimers();
		const cache = new Cache(100, 100);
		cache.set("key", "value");
		vi.advanceTimersByTime(200);
		expect(cache.get("key")).toBeUndefined();
		vi.useRealTimers();
	});

	it("evicts oldest entry when maxSize is exceeded", () => {
		const cache = new Cache(60_000, 2);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3); // should evict "a"
		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("b")).toBe(2);
		expect(cache.get("c")).toBe(3);
	});

	it("clear removes all entries", () => {
		const cache = new Cache(60_000, 100);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.clear();
		expect(cache.size).toBe(0);
	});
});
