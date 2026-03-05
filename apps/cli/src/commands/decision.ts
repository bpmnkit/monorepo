import type { ColumnDef, CommandGroup } from "../types.js";
import { DATA_FLAG, DATA_OPT_FLAG, makeGetCmd, makeListCmd, parseJson } from "./shared.js";

const DEF_COLUMNS: ColumnDef[] = [
	{ key: "decisionDefinitionKey", header: "KEY" },
	{ key: "decisionDefinitionId", header: "DECISION ID", maxWidth: 35 },
	{ key: "name", header: "NAME", maxWidth: 30 },
	{ key: "version", header: "VER" },
	{ key: "tenantId", header: "TENANT" },
];

const INST_COLUMNS: ColumnDef[] = [
	{ key: "decisionInstanceKey", header: "KEY" },
	{ key: "decisionDefinitionId", header: "DECISION ID", maxWidth: 25 },
	{ key: "state", header: "STATE" },
	{ key: "evaluationDate", header: "EVALUATED" },
];

export const decisionGroup: CommandGroup = {
	name: "decision",
	aliases: ["dd"],
	description: "Manage decision definitions and instances",
	commands: [
		makeListCmd({
			name: "definition-list",
			aliases: ["defs"],
			description: "Search decision definitions",
			columns: DEF_COLUMNS,
			examples: [
				{ description: "List all decision definitions", command: "casen decision definition-list" },
			],
			search: (client, body) => client.decisionDefinition.searchDecisionDefinitions(body as never),
		}),

		makeGetCmd({
			name: "definition-get",
			description: "Get a decision definition by key",
			argName: "key",
			argDesc: "Decision definition key",
			examples: [
				{
					description: "Get decision definition",
					command: "casen decision definition-get 2251799813685500",
				},
			],
			get: (client, key) => client.decisionDefinition.getDecisionDefinition(key),
		}),

		{
			name: "evaluate",
			description: "Evaluate a DMN decision",
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Evaluate a decision",
					command:
						'casen decision evaluate --data \'{"decisionDefinitionId":"loan-approval","variables":{"amount":50000,"creditScore":720}}\'',
				},
			],
			async run(ctx) {
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				const result = await client.decisionDefinition.evaluateDecision(body as never);
				ctx.output.printItem(result);
			},
		},

		makeListCmd({
			name: "instance-list",
			aliases: ["instances"],
			description: "Search decision instances (evaluation history)",
			columns: INST_COLUMNS,
			examples: [
				{ description: "List decision instances", command: "casen decision instance-list" },
			],
			search: (client, body) => client.decisionInstance.searchDecisionInstances(body as never),
		}),

		makeGetCmd({
			name: "instance-get",
			description: "Get a decision instance by key",
			argName: "key",
			argDesc: "Decision instance key",
			examples: [
				{
					description: "Get decision instance",
					command: "casen decision instance-get 2251799813685600",
				},
			],
			get: (client, key) => client.decisionInstance.getDecisionInstance(key),
		}),

		{
			name: "instance-delete",
			description: "Delete a decision instance",
			args: [{ name: "key", description: "Decision instance key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{
					description: "Delete decision instance",
					command: "casen decision instance-delete 2251799813685600",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				await client.decisionInstance.deleteDecisionInstance(key, body as never);
				ctx.output.ok(`Deleted decision instance ${key}`);
			},
		},
	],
};
