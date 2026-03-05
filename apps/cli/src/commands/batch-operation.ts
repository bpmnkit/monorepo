import type { ColumnDef, CommandGroup } from "../types.js";
import { makeGetCmd, makeListCmd } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "batchOperationKey", header: "KEY" },
	{ key: "type", header: "TYPE", maxWidth: 30 },
	{ key: "state", header: "STATE" },
	{ key: "startDate", header: "STARTED" },
	{ key: "endDate", header: "ENDED" },
];

export const batchOperationGroup: CommandGroup = {
	name: "batch-operation",
	aliases: ["batch"],
	description: "Manage batch operations",
	commands: [
		makeListCmd({
			description: "Search batch operations",
			columns: COLUMNS,
			examples: [{ description: "List batch operations", command: "casen batch-operation list" }],
			search: (client, body) => client.batchOperation.searchBatchOperations(body as never),
		}),

		makeGetCmd({
			description: "Get a batch operation by key",
			argName: "key",
			argDesc: "Batch operation key",
			examples: [
				{
					description: "Get batch operation",
					command: "casen batch-operation get 2251799813685800",
				},
			],
			get: (client, key) => client.batchOperation.getBatchOperation(key),
		}),

		{
			name: "cancel",
			description: "Cancel a batch operation",
			args: [{ name: "key", description: "Batch operation key", required: true }],
			examples: [
				{
					description: "Cancel batch operation",
					command: "casen batch-operation cancel 2251799813685800",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const client = await ctx.getClient();
				await client.batchOperation.cancelBatchOperation(key);
				ctx.output.ok(`Cancelled batch operation ${key}`);
			},
		},

		{
			name: "suspend",
			description: "Suspend a batch operation",
			args: [{ name: "key", description: "Batch operation key", required: true }],
			examples: [
				{
					description: "Suspend batch operation",
					command: "casen batch-operation suspend 2251799813685800",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const client = await ctx.getClient();
				await client.batchOperation.suspendBatchOperation(key);
				ctx.output.ok(`Suspended batch operation ${key}`);
			},
		},

		{
			name: "resume",
			description: "Resume a suspended batch operation",
			args: [{ name: "key", description: "Batch operation key", required: true }],
			examples: [
				{
					description: "Resume batch operation",
					command: "casen batch-operation resume 2251799813685800",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const client = await ctx.getClient();
				await client.batchOperation.resumeBatchOperation(key);
				ctx.output.ok(`Resumed batch operation ${key}`);
			},
		},
	],
};
