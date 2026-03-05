import { readFileSync } from "node:fs";
import type { ColumnDef, CommandGroup } from "../types.js";
import { DATA_OPT_FLAG, makeGetCmd, parseJson } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "resourceKey", header: "KEY" },
	{ key: "resourceId", header: "RESOURCE ID", maxWidth: 35 },
	{ key: "resourceName", header: "NAME", maxWidth: 30 },
	{ key: "tenantId", header: "TENANT" },
];

export const resourceGroup: CommandGroup = {
	name: "resource",
	aliases: ["deployment"],
	description: "Deploy and manage resources (BPMN, DMN, Forms)",
	commands: [
		{
			name: "deploy",
			description: "Deploy BPMN/DMN/form files to the cluster",
			flags: [
				{
					name: "files",
					description: "Comma-separated file paths to deploy",
					type: "string",
					required: true,
					placeholder: "PATHS",
				},
				{
					name: "tenant-id",
					description: "Tenant ID for the deployment",
					type: "string",
					placeholder: "ID",
				},
			],
			examples: [
				{
					description: "Deploy a BPMN file",
					command: "casen resource deploy --files order-process.bpmn",
				},
				{
					description: "Deploy multiple files",
					command: "casen resource deploy --files order.bpmn,loan.dmn --tenant-id my-tenant",
				},
			],
			async run(ctx) {
				const filesFlag = ctx.flags.files as string | undefined;
				if (!filesFlag) throw new Error("--files is required");
				const paths = filesFlag.split(",").map((p) => p.trim());
				const tenantId = ctx.flags["tenant-id"] as string | undefined;

				const resources = paths.map((filePath) => {
					const content = readFileSync(filePath);
					const name = filePath.split("/").pop() ?? filePath;
					return { name, content: content.toString("base64") };
				});

				const client = await ctx.getClient();
				const result = await client.resource.createDeployment();
				ctx.output.info(
					`Deploying ${resources.map((r) => r.name).join(", ")}${tenantId ? ` (tenant: ${tenantId})` : ""}...`,
				);
				ctx.output.printItem(result);
			},
		},

		makeGetCmd({
			description: "Get a deployed resource by key",
			argName: "key",
			argDesc: "Resource key",
			examples: [{ description: "Get resource", command: "casen resource get 2251799813685700" }],
			get: (client, key) => client.resource.getResource(key),
		}),

		{
			name: "delete",
			description: "Delete a deployed resource",
			args: [{ name: "key", description: "Resource key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{ description: "Delete resource", command: "casen resource delete 2251799813685700" },
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				const result = await client.resource.deleteResource(key, body as never);
				ctx.output.printItem(result);
			},
		},
	],
};
