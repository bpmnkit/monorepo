import type { ColumnDef, CommandGroup } from "../types.js";
import { makeGetCmd, makeListCmd } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "variableKey", header: "KEY" },
	{ key: "name", header: "NAME", maxWidth: 30 },
	{ key: "value", header: "VALUE", maxWidth: 50 },
	{ key: "scopeKey", header: "SCOPE KEY" },
	{ key: "processInstanceKey", header: "PROCESS INSTANCE" },
	{ key: "tenantId", header: "TENANT" },
];

export const variableGroup: CommandGroup = {
	name: "variable",
	aliases: ["var"],
	description: "Query process variables",
	commands: [
		makeListCmd({
			description: "Search variables",
			columns: COLUMNS,
			examples: [
				{
					description: "List variables for a process instance",
					command: 'casen variable list --filter \'{"processInstanceKey":"2251799813685281"}\'',
				},
				{
					description: "Filter by name",
					command: 'casen variable list --filter \'{"name":"orderId"}\'',
				},
			],
			search: (client, body) => client.variable.searchVariables(body as never),
		}),

		makeGetCmd({
			description: "Get a variable by key",
			argName: "key",
			argDesc: "Variable key",
			examples: [
				{ description: "Get variable details", command: "casen variable get 2251799813685400" },
			],
			get: (client, key) => client.variable.getVariable(key),
		}),
	],
};
