import type { CommandGroup } from "../types.js";

export const clusterGroup: CommandGroup = {
	name: "cluster",
	description: "Query cluster status and topology",
	commands: [
		{
			name: "topology",
			aliases: ["status"],
			description: "Get the cluster topology (brokers, partitions, replication)",
			examples: [
				{ description: "Get cluster topology", command: "casen cluster topology" },
				{ description: "Get as JSON", command: "casen cluster topology --output json" },
			],
			async run(ctx) {
				const client = await ctx.getClient();
				const result = await client.cluster.getTopology();
				ctx.output.printItem(result);
			},
		},

		{
			name: "license",
			description: "Show license status",
			examples: [{ description: "Check license", command: "casen cluster license" }],
			async run(ctx) {
				const client = await ctx.getClient();
				const result = await client.license.getLicense();
				ctx.output.printItem(result);
			},
		},

		{
			name: "whoami",
			description: "Show the currently authenticated user",
			examples: [{ description: "Who am I?", command: "casen cluster whoami" }],
			async run(ctx) {
				const client = await ctx.getClient();
				const result = await client.authentication.getAuthentication();
				ctx.output.printItem(result);
			},
		},
	],
};
