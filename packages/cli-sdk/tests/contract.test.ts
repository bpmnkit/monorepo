import { describe, expect, expectTypeOf, it } from "vitest"
import type {
	CasenPlugin,
	Command,
	CommandGroup,
	FlagSpec,
	OutputFormat,
	RunContext,
	WorkerConfig,
	WorkerJobResult,
} from "../src/index.js"
import { createWorkerCommand } from "../src/index.js"

/**
 * The shape `casen` loads: the default export of a plugin's entry point, with a
 * `groups` array (apps/cli/src/plugin-loader.ts). These tests pin the SDK side
 * of that contract; the type assertions are checked by `pnpm typecheck`.
 */
const plugin: CasenPlugin = {
	id: "com.example.test",
	name: "Test",
	version: "0.1.0",
	groups: [
		{
			name: "test",
			aliases: ["t"],
			description: "Test commands",
			commands: [
				{
					name: "hello",
					description: "Says hello",
					args: [{ name: "who", description: "Who", required: true }],
					flags: [{ name: "loud", description: "Shout", type: "boolean", default: false }],
					examples: [{ description: "Greet", command: "casen test hello world" }],
					async run(ctx) {
						ctx.output.ok(`hello ${ctx.positional[0]}${ctx.flags.loud ? "!" : ""}`)
					},
				},
				createWorkerCommand({ jobType: "test-job" }),
			],
		},
	],
}

describe("CasenPlugin", () => {
	it("is a plain object with the groups the CLI loader reads", () => {
		expect(Array.isArray(plugin.groups)).toBe(true)
		expect(plugin.groups[0]?.commands.map((c) => c.name)).toEqual(["hello", "start"])
	})

	it("runs a command through the RunContext it is given", async () => {
		const lines: string[] = []
		const hello = plugin.groups[0]?.commands[0] as Command
		await hello.run({
			positional: ["world"],
			flags: { loud: true },
			output: {
				format: "json",
				isInteractive: false,
				printList() {},
				printItem() {},
				print() {},
				ok: (m) => lines.push(m),
				info() {},
			},
			getClient: async () => ({}),
			getAdminClient: async () => ({}),
		})
		expect(lines).toEqual(["hello world!"])
	})

	it("keeps the types plugins are written against", () => {
		expectTypeOf<CasenPlugin>().toEqualTypeOf<{
			id: string
			name: string
			version: string
			groups: CommandGroup[]
		}>()
		expectTypeOf<OutputFormat>().toEqualTypeOf<"table" | "json" | "yaml">()
		expectTypeOf<FlagSpec["type"]>().toEqualTypeOf<"string" | "boolean" | "number">()
		expectTypeOf<RunContext["flags"]>().toEqualTypeOf<Record<string, string | boolean | number>>()
		expectTypeOf<RunContext["getClient"]>().returns.toEqualTypeOf<Promise<unknown>>()
		expectTypeOf<WorkerJobResult["outcome"]>().toEqualTypeOf<"complete" | "fail" | "error">()
		expectTypeOf(createWorkerCommand).parameter(0).toEqualTypeOf<WorkerConfig>()
		expectTypeOf(createWorkerCommand).returns.toEqualTypeOf<Command>()
	})

	it("requires processJob to return a WorkerJobResult", () => {
		createWorkerCommand({
			jobType: "t",
			// @ts-expect-error — bare output variables are not a WorkerJobResult
			async processJob(job) {
				return { result: "processed", input: job.variables }
			},
		})
		createWorkerCommand({
			jobType: "t",
			async processJob(job) {
				return { outcome: "complete", variables: { input: job.variables } }
			},
		})
		expect(true).toBe(true)
	})
})
