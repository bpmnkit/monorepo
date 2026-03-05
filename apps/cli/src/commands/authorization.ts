import type { ColumnDef, CommandGroup } from "../types.js";
import { makeCreateCmd, makeDeleteCmd, makeGetCmd, makeListCmd, makeUpdateCmd } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "authorizationKey", header: "KEY" },
	{ key: "ownerId", header: "OWNER ID", maxWidth: 25 },
	{ key: "ownerType", header: "OWNER TYPE" },
	{ key: "resourceId", header: "RESOURCE ID", maxWidth: 25 },
	{ key: "resourceType", header: "RESOURCE TYPE", maxWidth: 20 },
];

export const authorizationGroup: CommandGroup = {
	name: "authorization",
	aliases: ["auth"],
	description: "Manage authorizations",
	commands: [
		makeListCmd({
			description: "Search authorizations",
			columns: COLUMNS,
			examples: [
				{ description: "List all authorizations", command: "casen authorization list" },
				{
					description: "Filter by owner",
					command: 'casen authorization list --filter \'{"ownerId":"alice"}\'',
				},
			],
			search: (client, body) => client.authorization.searchAuthorizations(body as never),
		}),

		makeGetCmd({
			description: "Get an authorization by key",
			argName: "key",
			argDesc: "Authorization key",
			examples: [
				{ description: "Get authorization", command: "casen authorization get 2251799813685950" },
			],
			get: (client, key) => client.authorization.getAuthorization(key),
		}),

		makeCreateCmd({
			description: "Create an authorization",
			examples: [
				{
					description: "Create an authorization",
					command:
						'casen authorization create --data \'{"ownerId":"alice","ownerType":"USER","resourceId":"*","resourceType":"PROCESS_DEFINITION","permissions":["READ"]}\'',
				},
			],
			create: (client, body) => client.authorization.createAuthorization(body as never),
		}),

		makeUpdateCmd({
			description: "Update an authorization",
			argName: "key",
			examples: [
				{
					description: "Update authorization permissions",
					command:
						'casen authorization update 2251799813685950 --data \'{"permissions":["READ","WRITE"]}\'',
				},
			],
			update: (client, key, body) => client.authorization.updateAuthorization(key, body as never),
		}),

		makeDeleteCmd({
			description: "Delete an authorization",
			argName: "key",
			successMsg: (key) => `Deleted authorization ${key}`,
			examples: [
				{
					description: "Delete authorization",
					command: "casen authorization delete 2251799813685950",
				},
			],
			delete: (client, key) => client.authorization.deleteAuthorization(key),
		}),
	],
};
