import { dateTransform } from "../output.js";
import type { ColumnDef, CommandGroup } from "../types.js";
import { DATA_OPT_FLAG, makeGetCmd, makeListCmd, parseJson } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "incidentKey", header: "KEY" },
	{ key: "type", header: "TYPE", maxWidth: 30 },
	{ key: "state", header: "STATE" },
	{ key: "errorMessage", header: "ERROR", maxWidth: 40 },
	{ key: "processInstanceKey", header: "PROCESS INSTANCE" },
	{ key: "creationTime", header: "CREATED", transform: dateTransform },
];

export const incidentGroup: CommandGroup = {
	name: "incident",
	description: "Manage incidents",
	commands: [
		makeListCmd({
			description: "Search incidents",
			columns: COLUMNS,
			examples: [
				{
					description: "List all active incidents",
					command: 'casen incident list --filter \'{"state":"ACTIVE"}\'',
				},
				{
					description: "Filter by process instance",
					command: 'casen incident list --filter \'{"processInstanceKey":"2251799813685281"}\'',
				},
			],
			search: (client, body) => client.incident.searchIncidents(body as never),
		}),

		makeGetCmd({
			description: "Get an incident by key",
			argName: "key",
			argDesc: "Incident key",
			examples: [
				{ description: "Get incident details", command: "casen incident get 2251799813685300" },
			],
			get: (client, key) => client.incident.getIncident(key),
		}),

		{
			name: "resolve",
			description: "Resolve an incident",
			args: [{ name: "key", description: "Incident key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{ description: "Resolve incident", command: "casen incident resolve 2251799813685300" },
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				await client.incident.resolveIncident(key, body as never);
				ctx.output.ok(`Resolved incident ${key}`);
			},
		},
	],
};
