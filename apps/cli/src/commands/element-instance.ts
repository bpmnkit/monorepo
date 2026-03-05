import { dateTransform } from "../output.js";
import type { ColumnDef, CommandGroup } from "../types.js";
import { makeGetCmd, makeListCmd } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "elementInstanceKey", header: "KEY" },
	{ key: "elementId", header: "ELEMENT ID", maxWidth: 30 },
	{ key: "elementName", header: "NAME", maxWidth: 25 },
	{ key: "state", header: "STATE" },
	{ key: "processInstanceKey", header: "PROCESS INSTANCE" },
	{ key: "startDate", header: "STARTED", transform: dateTransform },
];

export const elementInstanceGroup: CommandGroup = {
	name: "element-instance",
	aliases: ["element"],
	description: "Query element (flow node) instances",
	commands: [
		makeListCmd({
			description: "Search element instances",
			columns: COLUMNS,
			examples: [
				{
					description: "List element instances",
					command:
						'casen element-instance list --filter \'{"processInstanceKey":"2251799813685281"}\'',
				},
			],
			search: (client, body) => client.elementInstance.searchElementInstances(body as never),
		}),

		makeGetCmd({
			description: "Get an element instance by key",
			argName: "key",
			argDesc: "Element instance key",
			examples: [
				{
					description: "Get element instance",
					command: "casen element-instance get 2251799813685900",
				},
			],
			get: (client, key) => client.elementInstance.getElementInstance(key),
		}),
	],
};
