import type { ColumnDef, CommandGroup } from "../types.js";
import { makeCreateCmd, makeDeleteCmd, makeGetCmd, makeListCmd, makeUpdateCmd } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "mappingRuleId", header: "ID", maxWidth: 30 },
	{ key: "name", header: "NAME", maxWidth: 30 },
	{ key: "claimName", header: "CLAIM NAME", maxWidth: 20 },
	{ key: "claimValue", header: "CLAIM VALUE", maxWidth: 20 },
];

export const mappingRuleGroup: CommandGroup = {
	name: "mapping-rule",
	aliases: ["mapping"],
	description: "Manage identity mapping rules",
	commands: [
		makeListCmd({
			description: "Search mapping rules",
			columns: COLUMNS,
			examples: [{ description: "List mapping rules", command: "casen mapping-rule list" }],
			search: (client, body) => client.mappingRule.searchMappingRule(body as never),
		}),

		makeGetCmd({
			description: "Get a mapping rule by ID",
			argName: "id",
			argDesc: "Mapping rule ID",
			examples: [{ description: "Get mapping rule", command: "casen mapping-rule get my-rule" }],
			get: (client, key) => client.mappingRule.getMappingRule(key),
		}),

		makeCreateCmd({
			description: "Create a mapping rule",
			examples: [
				{
					description: "Create a mapping rule",
					command:
						'casen mapping-rule create --data \'{"name":"Admin Rule","claimName":"groups","claimValue":"admins"}\'',
				},
			],
			create: (client, body) => client.mappingRule.createMappingRule(body as never),
		}),

		makeUpdateCmd({
			description: "Update a mapping rule",
			argName: "id",
			examples: [
				{
					description: "Update mapping rule",
					command: 'casen mapping-rule update my-rule --data \'{"claimValue":"superadmins"}\'',
				},
			],
			update: (client, key, body) => client.mappingRule.updateMappingRule(key, body as never),
		}),

		makeDeleteCmd({
			description: "Delete a mapping rule",
			argName: "id",
			successMsg: (key) => `Deleted mapping rule "${key}"`,
			examples: [
				{ description: "Delete mapping rule", command: "casen mapping-rule delete my-rule" },
			],
			delete: (client, key) => client.mappingRule.deleteMappingRule(key),
		}),
	],
};
