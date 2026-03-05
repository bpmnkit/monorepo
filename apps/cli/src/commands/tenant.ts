import type { ColumnDef, CommandGroup } from "../types.js";
import { makeCreateCmd, makeDeleteCmd, makeGetCmd, makeListCmd, makeUpdateCmd } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "tenantId", header: "ID", maxWidth: 30 },
	{ key: "name", header: "NAME", maxWidth: 40 },
];

export const tenantGroup: CommandGroup = {
	name: "tenant",
	description: "Manage tenants",
	commands: [
		makeListCmd({
			description: "Search tenants",
			columns: COLUMNS,
			examples: [{ description: "List all tenants", command: "casen tenant list" }],
			search: (client, body) => client.tenant.searchTenants(body as never),
		}),

		makeGetCmd({
			description: "Get a tenant by ID",
			argName: "id",
			argDesc: "Tenant ID",
			examples: [{ description: "Get tenant", command: "casen tenant get my-tenant" }],
			get: (client, key) => client.tenant.getTenant(key),
		}),

		makeCreateCmd({
			description: "Create a new tenant",
			examples: [
				{
					description: "Create a tenant",
					command: 'casen tenant create --data \'{"tenantId":"acme","name":"Acme Corp"}\'',
				},
			],
			create: (client, body) => client.tenant.createTenant(body as never),
		}),

		makeUpdateCmd({
			description: "Update a tenant",
			argName: "id",
			examples: [
				{
					description: "Rename tenant",
					command: 'casen tenant update acme --data \'{"name":"Acme Corporation"}\'',
				},
			],
			update: (client, key, body) => client.tenant.updateTenant(key, body as never),
		}),

		makeDeleteCmd({
			description: "Delete a tenant",
			argName: "id",
			successMsg: (key) => `Deleted tenant "${key}"`,
			examples: [{ description: "Delete tenant", command: "casen tenant delete old-tenant" }],
			delete: (client, key) => client.tenant.deleteTenant(key),
		}),

		{
			name: "assign-user",
			description: "Add a user to a tenant",
			args: [
				{ name: "tenant-id", description: "Tenant ID", required: true },
				{ name: "username", description: "Username to add", required: true },
			],
			examples: [
				{ description: "Add user to tenant", command: "casen tenant assign-user acme alice" },
			],
			async run(ctx) {
				const tenantId = ctx.positional[0];
				const username = ctx.positional[1];
				if (!tenantId) throw new Error("Missing required argument: <tenant-id>");
				if (!username) throw new Error("Missing required argument: <username>");
				const client = await ctx.getClient();
				await client.tenant.assignUserToTenant(tenantId, username);
				ctx.output.ok(`Added user "${username}" to tenant "${tenantId}"`);
			},
		},
	],
};
