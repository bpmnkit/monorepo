import type { ColumnDef, CommandGroup } from "../types.js";
import { makeCreateCmd, makeDeleteCmd, makeGetCmd, makeListCmd, makeUpdateCmd } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "groupId", header: "ID", maxWidth: 30 },
	{ key: "name", header: "NAME", maxWidth: 40 },
];

export const groupGroup: CommandGroup = {
	name: "group",
	description: "Manage groups",
	commands: [
		makeListCmd({
			description: "Search groups",
			columns: COLUMNS,
			examples: [{ description: "List all groups", command: "casen group list" }],
			search: (client, body) => client.group.searchGroups(body as never),
		}),

		makeGetCmd({
			description: "Get a group by ID",
			argName: "id",
			argDesc: "Group ID",
			examples: [{ description: "Get group", command: "casen group get admins" }],
			get: (client, key) => client.group.getGroup(key),
		}),

		makeCreateCmd({
			description: "Create a new group",
			examples: [
				{
					description: "Create a group",
					command: 'casen group create --data \'{"name":"Operations Team"}\'',
				},
			],
			create: (client, body) => client.group.createGroup(body as never),
		}),

		makeUpdateCmd({
			description: "Update a group",
			argName: "id",
			examples: [
				{
					description: "Rename a group",
					command: 'casen group update admins --data \'{"name":"Administrators"}\'',
				},
			],
			update: (client, key, body) => client.group.updateGroup(key, body as never),
		}),

		makeDeleteCmd({
			description: "Delete a group",
			argName: "id",
			successMsg: (key) => `Deleted group "${key}"`,
			examples: [{ description: "Delete group", command: "casen group delete old-group" }],
			delete: (client, key) => client.group.deleteGroup(key),
		}),

		{
			name: "assign-user",
			description: "Add a user to a group",
			args: [
				{ name: "group-id", description: "Group ID", required: true },
				{ name: "username", description: "Username to add", required: true },
			],
			examples: [
				{ description: "Add user to group", command: "casen group assign-user admins alice" },
			],
			async run(ctx) {
				const groupId = ctx.positional[0];
				const username = ctx.positional[1];
				if (!groupId) throw new Error("Missing required argument: <group-id>");
				if (!username) throw new Error("Missing required argument: <username>");
				const client = await ctx.getClient();
				await client.group.assignUserToGroup(groupId, username);
				ctx.output.ok(`Added user "${username}" to group "${groupId}"`);
			},
		},

		{
			name: "unassign-user",
			description: "Remove a user from a group",
			args: [
				{ name: "group-id", description: "Group ID", required: true },
				{ name: "username", description: "Username to remove", required: true },
			],
			examples: [
				{
					description: "Remove user from group",
					command: "casen group unassign-user admins alice",
				},
			],
			async run(ctx) {
				const groupId = ctx.positional[0];
				const username = ctx.positional[1];
				if (!groupId) throw new Error("Missing required argument: <group-id>");
				if (!username) throw new Error("Missing required argument: <username>");
				const client = await ctx.getClient();
				await client.group.unassignUserFromGroup(groupId, username);
				ctx.output.ok(`Removed user "${username}" from group "${groupId}"`);
			},
		},
	],
};
