import { describe, expect, it, vi } from "vitest";
import { TypedEventEmitter } from "./events.js";

type TestEvents = {
	ping: { id: number };
	pong: { message: string };
};

describe("TypedEventEmitter", () => {
	it("emits events to registered listeners", () => {
		const emitter = new TypedEventEmitter<TestEvents>();
		const handler = vi.fn();
		emitter.on("ping", handler);
		emitter.emit("ping", { id: 42 });
		expect(handler).toHaveBeenCalledWith({ id: 42 });
	});

	it("supports multiple listeners for the same event", () => {
		const emitter = new TypedEventEmitter<TestEvents>();
		const a = vi.fn();
		const b = vi.fn();
		emitter.on("ping", a);
		emitter.on("ping", b);
		emitter.emit("ping", { id: 1 });
		expect(a).toHaveBeenCalledOnce();
		expect(b).toHaveBeenCalledOnce();
	});

	it("off removes a listener", () => {
		const emitter = new TypedEventEmitter<TestEvents>();
		const handler = vi.fn();
		emitter.on("ping", handler);
		emitter.off("ping", handler);
		emitter.emit("ping", { id: 1 });
		expect(handler).not.toHaveBeenCalled();
	});

	it("once fires exactly once", () => {
		const emitter = new TypedEventEmitter<TestEvents>();
		const handler = vi.fn();
		emitter.once("ping", handler);
		emitter.emit("ping", { id: 1 });
		emitter.emit("ping", { id: 2 });
		expect(handler).toHaveBeenCalledOnce();
	});

	it("does not propagate listener errors", () => {
		const emitter = new TypedEventEmitter<TestEvents>();
		emitter.on("ping", () => {
			throw new Error("boom");
		});
		expect(() => emitter.emit("ping", { id: 1 })).not.toThrow();
	});

	it("removeAllListeners clears all events", () => {
		const emitter = new TypedEventEmitter<TestEvents>();
		const a = vi.fn();
		const b = vi.fn();
		emitter.on("ping", a);
		emitter.on("pong", b);
		emitter.removeAllListeners();
		emitter.emit("ping", { id: 1 });
		emitter.emit("pong", { message: "hi" });
		expect(a).not.toHaveBeenCalled();
		expect(b).not.toHaveBeenCalled();
	});
});
