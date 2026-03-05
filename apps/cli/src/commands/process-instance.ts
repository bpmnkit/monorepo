import { dateTransform } from "../output.js";
import type { ColumnDef, CommandGroup } from "../types.js";
import {
	DATA_FLAG,
	DATA_OPT_FLAG,
	makeCreateCmd,
	makeDeleteCmd,
	makeGetCmd,
	makeListCmd,
	parseJson,
} from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "processInstanceKey", header: "KEY" },
	{ key: "processDefinitionId", header: "PROCESS DEF ID", maxWidth: 35 },
	{ key: "processDefinitionVersion", header: "VER" },
	{ key: "state", header: "STATE" },
	{ key: "tenantId", header: "TENANT" },
	{ key: "startDate", header: "STARTED", transform: dateTransform },
];

export const processInstanceGroup: CommandGroup = {
	name: "process-instance",
	aliases: ["pi"],
	description: "Manage process instances",
	commands: [
		makeListCmd({
			description: "Search process instances",
			columns: COLUMNS,
			examples: [
				{
					description: "List all active instances",
					command: 'casen process-instance list --filter \'{"state":"ACTIVE"}\'',
				},
				{
					description: "Filter by process definition",
					command:
						'casen process-instance list --filter \'{"processDefinitionId":"order-process"}\'',
				},
			],
			search: (client, body) => client.processInstance.searchProcessInstances(body as never),
		}),

		makeGetCmd({
			description: "Get a process instance by key",
			argName: "key",
			argDesc: "Process instance key",
			examples: [
				{
					description: "Get instance details",
					command: "casen process-instance get 2251799813685281",
				},
			],
			get: (client, key) => client.processInstance.getProcessInstance(key),
		}),

		makeCreateCmd({
			description: "Create (start) a new process instance",
			examples: [
				{
					description: "Start a process instance",
					command:
						'casen process-instance create --data \'{"processDefinitionId":"order-process","variables":{"orderId":"123"}}\'',
				},
			],
			create: (client, body) => client.processInstance.createProcessInstance(body as never),
		}),

		{
			name: "cancel",
			description: "Cancel a running process instance",
			args: [{ name: "key", description: "Process instance key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{
					description: "Cancel instance",
					command: "casen process-instance cancel 2251799813685281",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				await client.processInstance.cancelProcessInstance(key, body as never);
				ctx.output.ok(`Cancelled process instance ${key}`);
			},
		},

		makeDeleteCmd({
			description: "Delete a process instance",
			argName: "key",
			successMsg: (key) => `Deleted process instance ${key}`,
			extraFlags: [],
			examples: [
				{
					description: "Delete instance",
					command: "casen process-instance delete 2251799813685281",
				},
			],
			delete: (client, key, body) =>
				client.processInstance.deleteProcessInstance(key, body as never),
		}),

		{
			name: "migrate",
			description: "Migrate a process instance to a new process definition version",
			args: [{ name: "key", description: "Process instance key", required: true }],
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Migrate instance",
					command:
						'casen process-instance migrate 2251799813685281 --data \'{"migrationPlan":{"targetProcessDefinitionKey":"9","mappingInstructions":[{"sourceElementId":"task-v1","targetElementId":"task-v2"}]}}\'',
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				await client.processInstance.migrateProcessInstance(key, body as never);
				ctx.output.ok(`Migration started for process instance ${key}`);
			},
		},

		{
			name: "modify",
			description: "Modify a running process instance (add/terminate tokens)",
			args: [{ name: "key", description: "Process instance key", required: true }],
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Modify instance",
					command:
						'casen process-instance modify 2251799813685281 --data \'{"activateInstructions":[{"elementId":"task-a"}]}\'',
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				await client.processInstance.modifyProcessInstance(key, body as never);
				ctx.output.ok(`Modified process instance ${key}`);
			},
		},

		{
			name: "resolve-incidents",
			description: "Resolve all incidents for a process instance",
			args: [{ name: "key", description: "Process instance key", required: true }],
			examples: [
				{
					description: "Resolve all incidents",
					command: "casen process-instance resolve-incidents 2251799813685281",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const client = await ctx.getClient();
				const result = await client.processInstance.resolveProcessInstanceIncidents(key);
				ctx.output.printItem(result);
			},
		},
	],
};
