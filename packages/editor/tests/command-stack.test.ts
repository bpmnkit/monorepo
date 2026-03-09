import { describe, expect, it } from "vitest"
import { CommandStack } from "../src/command-stack.js"
import { createEmptyDefinitions } from "../src/modeling.js"

function makeDefs(label?: string) {
	const d = createEmptyDefinitions()
	return label ? { ...d, id: label } : d
}

describe("CommandStack", () => {
	it("starts empty with canUndo=false and canRedo=false", () => {
		const cs = new CommandStack()
		expect(cs.canUndo()).toBe(false)
		expect(cs.canRedo()).toBe(false)
		expect(cs.current()).toBeNull()
	})

	it("push makes current() return the pushed value", () => {
		const cs = new CommandStack()
		const d = makeDefs("a")
		cs.push(d)
		expect(cs.current()?.id).toBe("a")
	})

	it("canUndo is false after first push (nothing before it)", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		expect(cs.canUndo()).toBe(false)
	})

	it("canUndo is true after second push", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		cs.push(makeDefs("b"))
		expect(cs.canUndo()).toBe(true)
	})

	it("undo returns previous state", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		cs.push(makeDefs("b"))
		const prev = cs.undo()
		expect(prev?.id).toBe("a")
		expect(cs.current()?.id).toBe("a")
	})

	it("redo returns next state after undo", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		cs.push(makeDefs("b"))
		cs.undo()
		const next = cs.redo()
		expect(next?.id).toBe("b")
	})

	it("canRedo is false initially", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		cs.push(makeDefs("b"))
		expect(cs.canRedo()).toBe(false)
	})

	it("canRedo is true after undo", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		cs.push(makeDefs("b"))
		cs.undo()
		expect(cs.canRedo()).toBe(true)
	})

	it("push clears redo states", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		cs.push(makeDefs("b"))
		cs.undo()
		cs.push(makeDefs("c")) // clears redo
		expect(cs.canRedo()).toBe(false)
		expect(cs.current()?.id).toBe("c")
	})

	it("undo returns null when at first snapshot", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		expect(cs.undo()).toBeNull()
	})

	it("redo returns null when at last snapshot", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		cs.push(makeDefs("b"))
		expect(cs.redo()).toBeNull()
	})

	it("enforces maxSize by discarding oldest", () => {
		// @ts-expect-error — accessing private for test
		const cs = new CommandStack()
		// Push 101 items (maxSize = 100)
		for (let i = 0; i < 101; i++) {
			cs.push(makeDefs(String(i)))
		}
		// Should still be at most 100
		// @ts-expect-error — accessing private for test
		expect(cs._snapshots.length).toBeLessThanOrEqual(100)
		// Cursor is at end
		expect(cs.canRedo()).toBe(false)
	})

	it("clear resets everything", () => {
		const cs = new CommandStack()
		cs.push(makeDefs("a"))
		cs.push(makeDefs("b"))
		cs.clear()
		expect(cs.canUndo()).toBe(false)
		expect(cs.canRedo()).toBe(false)
		expect(cs.current()).toBeNull()
	})
})
