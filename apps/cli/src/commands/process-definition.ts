import { dateTransform } from "../output.js";
import type { ColumnDef, CommandGroup } from "../types.js";
import { DATA_OPT_FLAG, makeGetCmd, makeListCmd, parseJson } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "processDefinitionKey", header: "KEY" },
	{ key: "processDefinitionId", header: "PROCESS DEF ID", maxWidth: 35 },
	{ key: "name", header: "NAME", maxWidth: 30 },
	{ key: "version", header: "VER" },
	{ key: "tenantId", header: "TENANT" },
];

export const processDefinitionGroup: CommandGroup = {
	name: "process-definition",
	aliases: ["pd"],
	description: "Query process definitions",
	commands: [
		makeListCmd({
			description: "Search process definitions",
			columns: COLUMNS,
			examples: [
				{ description: "List all process definitions", command: "casen process-definition list" },
				{
					description: "Filter by name",
					command: 'casen process-definition list --filter \'{"name":"Order Process"}\'',
				},
			],
			search: (client, body) => client.processDefinition.searchProcessDefinitions(body as never),
		}),

		makeGetCmd({
			description: "Get a process definition by key",
			argName: "key",
			argDesc: "Process definition key",
			examples: [
				{
					description: "Get definition details",
					command: "casen process-definition get 2251799813685001",
				},
			],
			get: (client, key) => client.processDefinition.getProcessDefinition(key),
		}),

		{
			name: "xml",
			description: "Print the BPMN XML of a process definition",
			args: [{ name: "key", description: "Process definition key", required: true }],
			examples: [
				{
					description: "Download BPMN XML",
					command: "casen process-definition xml 2251799813685001 --output json",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const client = await ctx.getClient();
				await client.processDefinition.getProcessDefinitionXML(key);
				ctx.output.ok("XML output above.");
			},
		},

		{
			name: "statistics",
			description: "Get element-level statistics for a process definition",
			args: [{ name: "key", description: "Process definition key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{
					description: "Get statistics",
					command: "casen process-definition statistics 2251799813685001",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				const result = await client.processDefinition.getProcessDefinitionStatistics(
					key,
					body as never,
				);
				ctx.output.printList(result, [
					{ key: "elementId", header: "ELEMENT ID" },
					{ key: "activeInstanceCount", header: "ACTIVE" },
					{ key: "incidentCount", header: "INCIDENTS" },
				]);
			},
		},

		{
			name: "instance-statistics",
			description: "Get instance-level statistics across all definitions",
			flags: [DATA_OPT_FLAG],
			examples: [
				{
					description: "Get instance statistics",
					command: "casen process-definition instance-statistics",
				},
			],
			async run(ctx) {
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				const result = await client.processDefinition.getProcessDefinitionInstanceStatistics(
					body as never,
				);
				ctx.output.printList(result, [
					{ key: "processDefinitionKey", header: "KEY" },
					{ key: "processDefinitionId", header: "PROCESS DEF ID", maxWidth: 35 },
					{ key: "activeInstanceCount", header: "ACTIVE" },
					{ key: "incidentCount", header: "INCIDENTS" },
				]);
			},
		},

		{
			name: "form",
			description: "Get the start form for a process definition",
			args: [{ name: "key", description: "Process definition key", required: true }],
			examples: [
				{
					description: "Get start form",
					command: "casen process-definition form 2251799813685001",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const client = await ctx.getClient();
				const result = await client.processDefinition.getStartProcessForm(key);
				ctx.output.printItem(result);
			},
		},
	],
};

// suppress unused import warning
void dateTransform;
