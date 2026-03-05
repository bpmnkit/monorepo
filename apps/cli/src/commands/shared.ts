import type { CamundaClient } from "@bpmn-sdk/api";
import type { ColumnDef, Command, FlagSpec, RunContext } from "../types.js";

// ─── Shared flag specs ────────────────────────────────────────────────────────

export const FILTER_FLAG: FlagSpec = {
	name: "filter",
	short: "f",
	description: "Filter as JSON object",
	type: "string",
	placeholder: "JSON",
};

export const DATA_FLAG: FlagSpec = {
	name: "data",
	short: "d",
	description: "Request body as JSON",
	type: "string",
	required: true,
	placeholder: "JSON",
};

export const DATA_OPT_FLAG: FlagSpec = {
	name: "data",
	short: "d",
	description: "Request body as JSON",
	type: "string",
	placeholder: "JSON",
};

export const LIMIT_FLAG: FlagSpec = {
	name: "limit",
	short: "l",
	description: "Maximum number of results",
	type: "number",
	default: 20,
};

export const SORT_FLAG: FlagSpec = {
	name: "sort-by",
	description: "Sort field",
	type: "string",
	placeholder: "FIELD",
};

export const SORT_ORDER_FLAG: FlagSpec = {
	name: "sort-order",
	description: "Sort order: asc|desc",
	type: "string",
	default: "asc",
};

// ─── JSON helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a JSON flag value. Returns undefined for falsy values.
 * Throws a descriptive error on invalid JSON.
 */
export function parseJson(value: string | undefined, flagName: string): unknown {
	if (!value) return undefined;
	try {
		return JSON.parse(value);
	} catch (err) {
		throw new Error(
			`Invalid JSON for --${flagName}: ${err instanceof Error ? err.message : String(err)}\n\nGot: ${value}`,
		);
	}
}

/** Build a search body from --filter, --limit, --sort-by, --sort-order flags. */
export function buildSearchBody(ctx: RunContext): Record<string, unknown> | undefined {
	const filter = parseJson(ctx.flags.filter as string | undefined, "filter");
	const limit = ctx.flags.limit as number | undefined;
	const sortBy = ctx.flags["sort-by"] as string | undefined;
	const sortOrder = ctx.flags["sort-order"] as string | undefined;

	const body: Record<string, unknown> = {};
	if (filter) body.filter = filter;
	if (limit !== undefined) body.page = { limit };
	if (sortBy) body.sort = [{ field: sortBy, order: sortOrder ?? "asc" }];

	return Object.keys(body).length > 0 ? body : undefined;
}

// ─── Command factories ────────────────────────────────────────────────────────

/** Factory for a "list" command that calls a search method. */
export function makeListCmd(opts: {
	name?: string;
	aliases?: string[];
	description: string;
	columns: ColumnDef[];
	extraFlags?: FlagSpec[];
	examples?: Command["examples"];
	search: (client: CamundaClient, body: unknown) => Promise<unknown>;
}): Command {
	return {
		name: opts.name ?? "list",
		aliases: opts.aliases,
		description: opts.description,
		flags: [FILTER_FLAG, LIMIT_FLAG, SORT_FLAG, SORT_ORDER_FLAG, ...(opts.extraFlags ?? [])],
		examples: opts.examples,
		async run(ctx) {
			const client = await ctx.getClient();
			const body = buildSearchBody(ctx);
			const result = await opts.search(client, body);
			ctx.output.printList(result, opts.columns);
		},
	};
}

/** Factory for a "get" command that takes a key positional argument. */
export function makeGetCmd(opts: {
	name?: string;
	aliases?: string[];
	description: string;
	argName: string;
	argDesc?: string;
	examples?: Command["examples"];
	get: (client: CamundaClient, key: string) => Promise<unknown>;
}): Command {
	return {
		name: opts.name ?? "get",
		aliases: opts.aliases,
		description: opts.description,
		args: [
			{
				name: opts.argName,
				description: opts.argDesc ?? `${opts.argName} to retrieve`,
				required: true,
			},
		],
		examples: opts.examples,
		async run(ctx) {
			const key = ctx.positional[0];
			if (!key) throw new Error(`Missing required argument: <${opts.argName}>`);
			const client = await ctx.getClient();
			const result = await opts.get(client, key);
			ctx.output.printItem(result);
		},
	};
}

/** Factory for a "delete" command that takes a key positional argument. */
export function makeDeleteCmd(opts: {
	name?: string;
	aliases?: string[];
	description: string;
	argName: string;
	successMsg?: (key: string) => string;
	extraFlags?: FlagSpec[];
	examples?: Command["examples"];
	delete: (client: CamundaClient, key: string, body?: unknown) => Promise<unknown>;
}): Command {
	return {
		name: opts.name ?? "delete",
		aliases: opts.aliases,
		description: opts.description,
		args: [{ name: opts.argName, description: `${opts.argName} to delete`, required: true }],
		flags: opts.extraFlags ? [DATA_OPT_FLAG, ...opts.extraFlags] : undefined,
		examples: opts.examples,
		async run(ctx) {
			const key = ctx.positional[0];
			if (!key) throw new Error(`Missing required argument: <${opts.argName}>`);
			const body = opts.extraFlags
				? parseJson(ctx.flags.data as string | undefined, "data")
				: undefined;
			const client = await ctx.getClient();
			await opts.delete(client, key, body);
			const msg = opts.successMsg ? opts.successMsg(key) : `Deleted ${key}`;
			ctx.output.ok(msg);
		},
	};
}

/** Factory for a "create" command that posts a body. */
export function makeCreateCmd(opts: {
	name?: string;
	aliases?: string[];
	description: string;
	examples?: Command["examples"];
	extraFlags?: FlagSpec[];
	create: (client: CamundaClient, body: unknown) => Promise<unknown>;
	successMsg?: string;
}): Command {
	return {
		name: opts.name ?? "create",
		aliases: opts.aliases,
		description: opts.description,
		flags: [DATA_FLAG, ...(opts.extraFlags ?? [])],
		examples: opts.examples,
		async run(ctx) {
			const raw = ctx.flags.data as string | undefined;
			const body = parseJson(raw, "data") ?? {};
			const client = await ctx.getClient();
			const result = await opts.create(client, body);
			if (result !== undefined && result !== null) {
				ctx.output.printItem(result);
			} else {
				ctx.output.ok(opts.successMsg ?? "Created successfully.");
			}
		},
	};
}

/** Factory for an "update" command that patches a resource by key. */
export function makeUpdateCmd(opts: {
	name?: string;
	aliases?: string[];
	description: string;
	argName: string;
	examples?: Command["examples"];
	extraFlags?: FlagSpec[];
	update: (client: CamundaClient, key: string, body: unknown) => Promise<unknown>;
}): Command {
	return {
		name: opts.name ?? "update",
		aliases: opts.aliases,
		description: opts.description,
		args: [{ name: opts.argName, description: `${opts.argName} to update`, required: true }],
		flags: [DATA_FLAG, ...(opts.extraFlags ?? [])],
		examples: opts.examples,
		async run(ctx) {
			const key = ctx.positional[0];
			if (!key) throw new Error(`Missing required argument: <${opts.argName}>`);
			const raw = ctx.flags.data as string | undefined;
			const body = parseJson(raw, "data") ?? {};
			const client = await ctx.getClient();
			const result = await opts.update(client, key, body);
			if (result !== undefined && result !== null) {
				ctx.output.printItem(result);
			} else {
				ctx.output.ok(`Updated ${key}.`);
			}
		},
	};
}
