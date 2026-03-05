import type { CommandGroup } from "../types.js";
import { DATA_FLAG, parseJson } from "./shared.js";

export const signalGroup: CommandGroup = {
	name: "signal",
	description: "Broadcast signals",
	commands: [
		{
			name: "broadcast",
			description: "Broadcast a signal to all matching signal catch events",
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Broadcast a system alert signal",
					command:
						'casen signal broadcast --data \'{"signalName":"system-alert","variables":{"severity":"HIGH"}}\'',
				},
			],
			async run(ctx) {
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				const result = await client.signal.broadcastSignal(body as never);
				ctx.output.printItem(result);
			},
		},
	],
};
