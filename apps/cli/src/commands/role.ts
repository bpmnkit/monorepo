import type { ColumnDef, CommandGroup } from "../types.js";
import { makeCreateCmd, makeDeleteCmd, makeGetCmd, makeListCmd, makeUpdateCmd } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "roleId", header: "ID", maxWidth: 30 },
	{ key: "name", header: "NAME", maxWidth: 40 },
];

export const roleGroup: CommandGroup = {
	name: "role",
	description: "Manage roles",
	commands: [
		makeListCmd({
			description: "Search roles",
			columns: COLUMNS,
			examples: [{ description: "List all roles", command: "casen role list" }],
			search: (client, body) => client.role.searchRoles(body as never),
		}),

		makeGetCmd({
			description: "Get a role by ID",
			argName: "id",
			argDesc: "Role ID",
			examples: [{ description: "Get role", command: "casen role get admin-role" }],
			get: (client, key) => client.role.getRole(key),
		}),

		makeCreateCmd({
			description: "Create a new role",
			examples: [
				{
					description: "Create a role",
					command: 'casen role create --data \'{"name":"Process Administrator"}\'',
				},
			],
			create: (client, body) => client.role.createRole(body as never),
		}),

		makeUpdateCmd({
			description: "Update a role",
			argName: "id",
			examples: [
				{
					description: "Rename role",
					command: 'casen role update admin-role --data \'{"name":"Super Admin"}\'',
				},
			],
			update: (client, key, body) => client.role.updateRole(key, body as never),
		}),

		makeDeleteCmd({
			description: "Delete a role",
			argName: "id",
			successMsg: (key) => `Deleted role "${key}"`,
			examples: [{ description: "Delete role", command: "casen role delete old-role" }],
			delete: (client, key) => client.role.deleteRole(key),
		}),

		{
			name: "assign-user",
			description: "Assign a role to a user",
			args: [
				{ name: "role-id", description: "Role ID", required: true },
				{ name: "username", description: "Username", required: true },
			],
			examples: [
				{ description: "Assign role to user", command: "casen role assign-user admin-role alice" },
			],
			async run(ctx) {
				const roleId = ctx.positional[0];
				const username = ctx.positional[1];
				if (!roleId) throw new Error("Missing required argument: <role-id>");
				if (!username) throw new Error("Missing required argument: <username>");
				const client = await ctx.getClient();
				await client.role.assignRoleToUser(roleId, username);
				ctx.output.ok(`Assigned role "${roleId}" to user "${username}"`);
			},
		},

		{
			name: "unassign-user",
			description: "Remove a role from a user",
			args: [
				{ name: "role-id", description: "Role ID", required: true },
				{ name: "username", description: "Username", required: true },
			],
			examples: [
				{
					description: "Remove role from user",
					command: "casen role unassign-user admin-role alice",
				},
			],
			async run(ctx) {
				const roleId = ctx.positional[0];
				const username = ctx.positional[1];
				if (!roleId) throw new Error("Missing required argument: <role-id>");
				if (!username) throw new Error("Missing required argument: <username>");
				const client = await ctx.getClient();
				await client.role.unassignRoleFromUser(roleId, username);
				ctx.output.ok(`Removed role "${roleId}" from user "${username}"`);
			},
		},

		{
			name: "assign-group",
			description: "Assign a role to a group",
			args: [
				{ name: "role-id", description: "Role ID", required: true },
				{ name: "group-id", description: "Group ID", required: true },
			],
			examples: [
				{
					description: "Assign role to group",
					command: "casen role assign-group admin-role ops-team",
				},
			],
			async run(ctx) {
				const roleId = ctx.positional[0];
				const groupId = ctx.positional[1];
				if (!roleId) throw new Error("Missing required argument: <role-id>");
				if (!groupId) throw new Error("Missing required argument: <group-id>");
				const client = await ctx.getClient();
				await client.role.assignRoleToGroup(roleId, groupId);
				ctx.output.ok(`Assigned role "${roleId}" to group "${groupId}"`);
			},
		},
	],
};
