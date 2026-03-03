import { describe, expect, it } from "vitest";
import { VariableStore } from "../src/variables.js";

describe("VariableStore", () => {
	it("stores and retrieves a value", () => {
		const s = new VariableStore();
		s.createScope("root");
		s.setLocal("root", "x", 42);
		expect(s.get("root", "x")).toBe(42);
	});

	it("returns undefined for missing variable", () => {
		const s = new VariableStore();
		s.createScope("root");
		expect(s.get("root", "missing")).toBeUndefined();
	});

	it("walks up the parent chain on read", () => {
		const s = new VariableStore();
		s.createScope("root");
		s.createScope("child", "root");
		s.setLocal("root", "x", 1);
		expect(s.get("child", "x")).toBe(1);
	});

	it("child scope shadows parent", () => {
		const s = new VariableStore();
		s.createScope("root");
		s.createScope("child", "root");
		s.setLocal("root", "x", 1);
		s.setLocal("child", "x", 2);
		expect(s.get("child", "x")).toBe(2);
		expect(s.get("root", "x")).toBe(1);
	});

	it("set updates existing variable in nearest owning scope", () => {
		const s = new VariableStore();
		s.createScope("root");
		s.createScope("child", "root");
		s.setLocal("root", "x", 1);
		s.set("child", "x", 99);
		// Should update root since root owns x
		expect(s.get("root", "x")).toBe(99);
		expect(s.get("child", "x")).toBe(99);
	});

	it("set creates local variable if not found in chain", () => {
		const s = new VariableStore();
		s.createScope("root");
		s.createScope("child", "root");
		s.set("child", "newVar", "hello");
		expect(s.get("child", "newVar")).toBe("hello");
		expect(s.get("root", "newVar")).toBeUndefined();
	});

	it("getAll merges parent and child (child wins)", () => {
		const s = new VariableStore();
		s.createScope("root");
		s.createScope("child", "root");
		s.setLocal("root", "a", 1);
		s.setLocal("root", "b", 2);
		s.setLocal("child", "b", 20);
		s.setLocal("child", "c", 3);
		expect(s.getAll("child")).toEqual({ a: 1, b: 20, c: 3 });
	});

	it("removeScope cleans up without affecting parent", () => {
		const s = new VariableStore();
		s.createScope("root");
		s.createScope("child", "root");
		s.setLocal("root", "x", 5);
		s.removeScope("child");
		expect(s.get("root", "x")).toBe(5);
	});
});
