import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { activate } from "../src/extension.js"
import { registrations, reset } from "./vscode-stub.js"

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
	contributes: {
		commands: Array<{ command: string }>
		customEditors: Array<{ viewType: string }>
		menus: Record<string, Array<{ command: string }>>
	}
}

function run(): { subscriptions: unknown[] } {
	const context = { subscriptions: [] as unknown[], extensionUri: { path: "/ext" } }
	activate(context as never)
	return context
}

const ids = (kind: "command" | "customEditor"): string[] =>
	registrations.filter((r) => r.kind === kind).map((r) => r.id)

describe("activate", () => {
	beforeEach(reset)

	it("registers a custom editor for every artifact the manifest claims", () => {
		run()
		expect(ids("customEditor").sort()).toEqual(
			manifest.contributes.customEditors.map((editor) => editor.viewType).sort(),
		)
	})

	it("registers every command the manifest contributes", () => {
		// A command in the manifest with no handler shows up in the palette and
		// fails when it is picked. `vsce package` does not check this; nothing does.
		run()
		expect(ids("command").sort()).toEqual(
			manifest.contributes.commands.map((command) => command.command).sort(),
		)
	})

	it("contributes no menu item for a command that does not exist", () => {
		const declared = new Set(manifest.contributes.commands.map((c) => c.command))
		const inMenus = Object.values(manifest.contributes.menus)
			.flat()
			.map((item) => item.command)
		expect(inMenus.filter((command) => !declared.has(command))).toEqual([])
	})

	it("hands every registration back for disposal", () => {
		const context = run()
		expect(context.subscriptions.length).toBeGreaterThanOrEqual(registrations.length)
	})
})
