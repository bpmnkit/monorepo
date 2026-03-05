import { dateTransform } from "../output.js";
import type { ColumnDef, CommandGroup } from "../types.js";
import { DATA_FLAG, DATA_OPT_FLAG, makeListCmd, parseJson } from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "jobKey", header: "KEY" },
	{ key: "type", header: "TYPE", maxWidth: 40 },
	{ key: "state", header: "STATE" },
	{ key: "worker", header: "WORKER", maxWidth: 20 },
	{ key: "retries", header: "RETRIES" },
	{ key: "deadline", header: "DEADLINE", transform: dateTransform },
];

export const jobGroup: CommandGroup = {
	name: "job",
	description: "Manage service jobs",
	commands: [
		makeListCmd({
			description: "Search jobs",
			columns: COLUMNS,
			examples: [
				{ description: "List all jobs", command: "casen job list" },
				{
					description: "Filter by type",
					command: 'casen job list --filter \'{"type":"send-email"}\'',
				},
			],
			search: (client, body) => client.job.searchJobs(body as never),
		}),

		{
			name: "activate",
			description: "Activate (lock) jobs for processing",
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Activate up to 10 jobs",
					command:
						'casen job activate --data \'{"type":"send-email","worker":"worker-1","timeout":60000,"maxJobsToActivate":10}\'',
				},
			],
			async run(ctx) {
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				const result = await client.job.activateJobs(body as never);
				ctx.output.printList(result, COLUMNS);
			},
		},

		{
			name: "complete",
			description: "Complete an activated job",
			args: [{ name: "key", description: "Job key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{
					description: "Complete job with variables",
					command: "casen job complete 2251799813685100 --data '{\"emailSent\":true}'",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				await client.job.completeJob(key, body as never);
				ctx.output.ok(`Completed job ${key}`);
			},
		},

		{
			name: "fail",
			description: "Fail a job (decrements retries, optionally adds backoff)",
			args: [{ name: "key", description: "Job key", required: true }],
			flags: [DATA_OPT_FLAG],
			examples: [
				{
					description: "Fail with retries left",
					command:
						'casen job fail 2251799813685100 --data \'{"retries":2,"errorMessage":"Timeout","retryBackOff":5000}\'',
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const body = parseJson(ctx.flags.data as string | undefined, "data");
				const client = await ctx.getClient();
				await client.job.failJob(key, body as never);
				ctx.output.ok(`Failed job ${key}`);
			},
		},

		{
			name: "throw-error",
			aliases: ["error"],
			description: "Throw a BPMN error for a job (triggers error boundary events)",
			args: [{ name: "key", description: "Job key", required: true }],
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Throw BPMN error",
					command:
						'casen job throw-error 2251799813685100 --data \'{"errorCode":"PAYMENT_FAILED","errorMessage":"Card declined"}\'',
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				await client.job.throwJobError(key, body as never);
				ctx.output.ok(`Threw error for job ${key}`);
			},
		},

		{
			name: "update",
			description: "Update job retries or timeout",
			args: [{ name: "key", description: "Job key", required: true }],
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Update retries",
					command: "casen job update 2251799813685100 --data '{\"retries\":3}'",
				},
			],
			async run(ctx) {
				const key = ctx.positional[0];
				if (!key) throw new Error("Missing required argument: <key>");
				const raw = ctx.flags.data as string | undefined;
				const body = parseJson(raw, "data");
				const client = await ctx.getClient();
				await client.job.updateJob(key, body as never);
				ctx.output.ok(`Updated job ${key}`);
			},
		},
	],
};
