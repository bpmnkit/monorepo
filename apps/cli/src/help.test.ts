import { afterEach, describe, expect, it, vi } from "vitest"
import { devGroup } from "./commands/dev.js"
import { printCommandHelp } from "./help.js"

describe("printCommandHelp", () => {
	afterEach(() => vi.restoreAllMocks())

	it("does not repeat a command that shares its group's name", () => {
		const written: string[] = []
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			written.push(String(chunk))
			return true
		})
		const cmd = devGroup.commands[0]
		if (!cmd) throw new Error("dev group has no command")
		printCommandHelp(devGroup, cmd, false)
		const text = written.join("")
		expect(text).toContain("casen dev [dir] [flags]")
		expect(text).not.toContain("casen dev dev")
	})
})
