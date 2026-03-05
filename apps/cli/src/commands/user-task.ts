import { dateTransform } from "../output.js";
import type { ColumnDef, CommandGroup } from "../types.js";
import { DATA_OPT_FLAG, makeGetCmd, makeListCmd, parseJson } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "userTaskKey", header: "KEY" },
	{ key: "elementId", header: "ELEMENT ID", maxWidth: 25 },
	{ key: "name", header: "NAME", maxWidth: 30 },
	{ key: "assignee", header: "ASSIGNEE", maxWidth: 20 },
	{ key: "state", header: "STATE" },
	{ key: "creationDate", header: "CREATED", transform: dateTransform },
];

export const userTaskGroup: CommandGroup = {
	name: "user-task",
	aliases: ["ut"],
	description: "Manage user tasks",
	commands: [
		makeListCmd({
			description: "Search user tasks",
			columns: COLUMNS,
			examples: [
				{
					description: "List unassigned tasks",
					command: 'casen user-task list --filter \'{"state":"CREATED","assignee":""}\'',
				},
				{
					description: "Filter by process definition",
					command: 'casen user-task list --filter \'{"processDefinitionId":"approval-process"}\'',
				},
			],
			search: (client, body) => client.userTask.searchUserTasks(body as never),
		}),

		makeGetCmd({
			description: "Get a user task by key",
			argName: "key",
			argDesc: "User task key",
			examples: [
				{ description: "Get task details", command: "casen user-task get 2251799813685200" },
			],
			get: (client, key) => client.userTask.getUserTask(key),
		}),

		{
			name: "assign",
			description: "Assign a user task to an assignee",
			args: [{ name: "key", description: "User task key", required: true }],
			flags: [
				{
					name: "assignee",
					description: "Username to assign the task to",
					type: "string",
					required: true,
					placeholder: "USER",
				},
				{
					name: "allow-override",
					description: "Allow overriding existing assignment",
					type: "boolean",
				},
			],
			examples: [
				{
					description: "Assign task",
					command: "casen user-task assign 2251799813685200 --assignee alice@example.com",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const assignee = ctx.flags.assignee as string | undefined;
				if (!assignee) throw new Error("--assignee is required");
				const client = await ctx.getClient();
				await client.userTask.assignUserTask(key, {
					assignee,
					allowOverride: (ctx.flags["allow-override"] as boolean | undefined) ?? false,
				} as never);
				ctx.output.ok(`Assigned task ${key} to ${assignee}`);
			},
		},

		{
			name: "unassign",
			description: "Remove the assignee from a user task",
			args: [{ name: "key", description: "User task key", required: true }],
			examples: [
				{ description: "Unassign task", command: "casen user-task unassign 2251799813685200" },
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const client = await ctx.getClient();
				await client.userTask.unassignUserTask(key);
				ctx.output.ok(`Unassigned task ${key}`);
			},
		},

		{
			name: "complete",
			description: "Complete a user task",
			args: [{ name: "key", description: "User task key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{
					description: "Complete task with variables",
					command: "casen user-task complete 2251799813685200 --data '{\"approved\":true}'",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				await client.userTask.completeUserTask(key, body as never);
				ctx.output.ok(`Completed task ${key}`);
			},
		},

		{
			name: "update",
			description: "Update a user task (due date, priority, candidate groups)",
			args: [{ name: "key", description: "User task key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{
					description: "Update task priority",
					command: "casen user-task update 2251799813685200 --data '{\"priority\":80}'",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				await client.userTask.updateUserTask(key, body as never);
				ctx.output.ok(`Updated task ${key}`);
			},
		},

		{
			name: "form",
			description: "Get the form schema for a user task",
			args: [{ name: "key", description: "User task key", required: true }],
			examples: [
				{ description: "Get task form", command: "casen user-task form 2251799813685200" },
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const client = await ctx.getClient();
				const result = await client.userTask.getUserTaskForm(key);
				ctx.output.printItem(result);
			},
		},
	],
};
