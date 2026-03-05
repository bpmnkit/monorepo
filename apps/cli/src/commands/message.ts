import type { CommandGroup } from "../types.js";
import { DATA_FLAG, parseJson } from "./shared.js";

export const messageGroup: CommandGroup = {
	name: "message",
	description: "Publish and correlate messages",
	commands: [
		{
			name: "publish",
			description: "Publish a message to correlate with a catch event",
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Publish a payment message",
					command:
						'casen message publish --data \'{"name":"payment-received","correlationKey":"order-123","timeToLive":60000,"variables":{"amount":99.99}}\'',
				},
			],
			async run(ctx) {
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				const result = await client.message.publishMessage(body as never);
				ctx.output.printItem(result);
			},
		},

		{
			name: "correlate",
			description: "Correlate a message to a specific process instance",
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Correlate a message",
					command:
						'casen message correlate --data \'{"name":"approval-received","correlationKey":"request-456","variables":{"approved":true}}\'',
				},
			],
			async run(ctx) {
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				const result = await client.message.correlateMessage(body as never);
				ctx.output.printItem(result);
			},
		},
	],
};
