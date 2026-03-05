import { describe, expect, it } from "vitest";
import { getRuntimeCompletions } from "./completion.js";
import type { CommandGroup } from "./types.js";

const groups: CommandGroup[] = [
	{
		name: "process-instance",
		aliases: ["pi"],
		description: "Manage process instances",
		commands: [
			{
				name: "list",
				description: "List instances",
				flags: [{ name: "filter", short: "f", description: "Filter", type: "string" }],
				async run() {},
			},
			{ name: "get", description: "Get instance", async run() {} },
		],
	},
	{
		name: "job",
		description: "Manage jobs",
		commands: [{ name: "list", description: "List jobs", async run() {} }],
	},
];

describe("getRuntimeCompletions", () => {
	it("completes resource names at position 1", () => {
		const completions = getRuntimeCompletions(groups, 1, ["casen", ""]);
		expect(completions).toContain("process-instance");
		expect(completions).toContain("pi");
		expect(completions).toContain("job");
	});

	it("filters resource names by prefix", () => {
		const completions = getRuntimeCompletions(groups, 1, ["casen", "pro"]);
		expect(completions).toContain("process-instance");
		expect(completions).not.toContain("job");
	});

	it("completes command names at position 2", () => {
		const completions = getRuntimeCompletions(groups, 2, ["casen", "process-instance", ""]);
		expect(completions).toContain("list");
		expect(completions).toContain("get");
	});

	it("completes command names via alias", () => {
		const completions = getRuntimeCompletions(groups, 2, ["casen", "pi", ""]);
		expect(completions).toContain("list");
		expect(completions).toContain("get");
	});

	it("completes flags at position 3+", () => {
		const completions = getRuntimeCompletions(groups, 3, ["casen", "process-instance", "list", ""]);
		expect(completions).toContain("--filter");
		expect(completions).toContain("--profile");
		expect(completions).toContain("--help");
	});

	it("filters flags by prefix", () => {
		const completions = getRuntimeCompletions(groups, 3, [
			"casen",
			"process-instance",
			"list",
			"--fi",
		]);
		expect(completions).toContain("--filter");
		expect(completions).not.toContain("--profile");
	});

	it("returns empty for unknown group", () => {
		const completions = getRuntimeCompletions(groups, 2, ["casen", "unknown", ""]);
		expect(completions).toEqual([]);
	});
});
