import type { AdminApiClient } from "@bpmnkit/api"
import type { ColumnDef, Command, FlagSpec, JsonFieldSpec, RunContext } from "../types.js"

// ─── Shared flag specs ────────────────────────────────────────────────────────

export const FILTER_FLAG: FlagSpec = {
	name: "filter",
	short: "f",
	description: "Filter as JSON object",
	type: "string",
	placeholder: "JSON",
}

export const DATA_FLAG: FlagSpec = {
	name: "data",
	short: "d",
	description: "Request body as JSON",
	type: "string",
	required: true,
	placeholder: "JSON",
}

export const DATA_OPT_FLAG: FlagSpec = {
	name: "data",
	short: "d",
	description: "Request body as JSON",
	type: "string",
	placeholder: "JSON",
}

export const LIMIT_FLAG: FlagSpec = {
	name: "limit",
	short: "l",
	description: "Maximum number of results",
	type: "number",
	default: 20,
}

export const SORT_FLAG: FlagSpec = {
	name: "sort-by",
	description: "Sort field",
	type: "string",
	placeholder: "FIELD",
}

export const SORT_ORDER_FLAG: FlagSpec = {
	name: "sort-order",
	description: "Sort order: asc|desc",
	type: "string",
	default: "asc",
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

export function parseJson(value: string | undefined, flagName: string): unknown {
	if (!value) return undefined
	try {
		return JSON.parse(value)
	} catch (err) {
		throw new Error(
			`Invalid JSON for --${flagName}: ${err instanceof Error ? err.message : String(err)}\n\nGot: ${value}`,
		)
	}
}

function buildSearchBody(ctx: RunContext): Record<string, unknown> | undefined {
	const filter = parseJson(ctx.flags.filter as string | undefined, "filter")
	const limit = ctx.flags.limit as number | undefined
	const sortBy = ctx.flags["sort-by"] as string | undefined
	const sortOrder = ctx.flags["sort-order"] as string | undefined

	const body: Record<string, unknown> = {}
	if (filter) body.filter = filter
	if (limit !== undefined) body.page = { limit }
	if (sortBy) body.sort = [{ field: sortBy, order: sortOrder ?? "asc" }]

	return Object.keys(body).length > 0 ? body : undefined
}

// ─── Command factories ────────────────────────────────────────────────────────

export function makeListCmd(opts: {
	name?: string
	aliases?: string[]
	description: string
	columns: ColumnDef[]
	extraFlags?: FlagSpec[]
	examples?: Command["examples"]
	filterFields?: JsonFieldSpec[]
	search: (client: AdminApiClient, body: unknown) => Promise<unknown>
}): Command {
	const filterFlag: FlagSpec = opts.filterFields
		? { ...FILTER_FLAG, fields: opts.filterFields }
		: FILTER_FLAG
	return {
		name: opts.name ?? "list",
		aliases: opts.aliases,
		description: opts.description,
		flags: [filterFlag, LIMIT_FLAG, SORT_FLAG, SORT_ORDER_FLAG, ...(opts.extraFlags ?? [])],
		examples: opts.examples,
		async run(ctx) {
			const client = await ctx.getAdminClient()
			const body = buildSearchBody(ctx)
			const result = await opts.search(client, body)
			ctx.output.printList(result, opts.columns)
		},
	}
}

export function makeGetCmd(opts: {
	name?: string
	aliases?: string[]
	description: string
	argName: string
	argDesc?: string
	examples?: Command["examples"]
	get: (client: AdminApiClient, key: string) => Promise<unknown>
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
			const key = ctx.positional[0]
			if (!key) throw new Error(`Missing required argument: <${opts.argName}>`)
			const client = await ctx.getAdminClient()
			const result = await opts.get(client, key)
			ctx.output.printItem(result)
		},
	}
}

export function makeDeleteCmd(opts: {
	name?: string
	aliases?: string[]
	description: string
	argName: string
	successMsg?: (key: string) => string
	extraFlags?: FlagSpec[]
	examples?: Command["examples"]
	delete: (client: AdminApiClient, key: string, body?: unknown) => Promise<unknown>
}): Command {
	return {
		name: opts.name ?? "delete",
		aliases: opts.aliases,
		description: opts.description,
		args: [{ name: opts.argName, description: `${opts.argName} to delete`, required: true }],
		flags: opts.extraFlags ? [DATA_OPT_FLAG, ...opts.extraFlags] : undefined,
		examples: opts.examples,
		async run(ctx) {
			const key = ctx.positional[0]
			if (!key) throw new Error(`Missing required argument: <${opts.argName}>`)
			const body = opts.extraFlags
				? parseJson(ctx.flags.data as string | undefined, "data")
				: undefined
			const client = await ctx.getAdminClient()
			await opts.delete(client, key, body)
			const msg = opts.successMsg ? opts.successMsg(key) : `Deleted ${key}`
			ctx.output.ok(msg)
		},
	}
}

export function makeCreateCmd(opts: {
	name?: string
	aliases?: string[]
	description: string
	examples?: Command["examples"]
	extraFlags?: FlagSpec[]
	bodyFields?: JsonFieldSpec[]
	create: (client: AdminApiClient, body: unknown) => Promise<unknown>
	successMsg?: string
}): Command {
	const dataFlag: FlagSpec = opts.bodyFields ? { ...DATA_FLAG, fields: opts.bodyFields } : DATA_FLAG
	return {
		name: opts.name ?? "create",
		aliases: opts.aliases,
		description: opts.description,
		flags: [dataFlag, ...(opts.extraFlags ?? [])],
		examples: opts.examples,
		async run(ctx) {
			const raw = ctx.flags.data as string | undefined
			const body = parseJson(raw, "data") ?? {}
			const client = await ctx.getAdminClient()
			const result = await opts.create(client, body)
			if (result !== undefined && result !== null) {
				ctx.output.printItem(result)
			} else {
				ctx.output.ok(opts.successMsg ?? "Created successfully.")
			}
		},
	}
}

export function makeUpdateCmd(opts: {
	name?: string
	aliases?: string[]
	description: string
	argName: string
	examples?: Command["examples"]
	extraFlags?: FlagSpec[]
	bodyFields?: JsonFieldSpec[]
	update: (client: AdminApiClient, key: string, body: unknown) => Promise<unknown>
}): Command {
	const dataFlag: FlagSpec = opts.bodyFields ? { ...DATA_FLAG, fields: opts.bodyFields } : DATA_FLAG
	return {
		name: opts.name ?? "update",
		aliases: opts.aliases,
		description: opts.description,
		args: [{ name: opts.argName, description: `${opts.argName} to update`, required: true }],
		flags: [dataFlag, ...(opts.extraFlags ?? [])],
		examples: opts.examples,
		async run(ctx) {
			const key = ctx.positional[0]
			if (!key) throw new Error(`Missing required argument: <${opts.argName}>`)
			const raw = ctx.flags.data as string | undefined
			const body = parseJson(raw, "data") ?? {}
			const client = await ctx.getAdminClient()
			const result = await opts.update(client, key, body)
			if (result !== undefined && result !== null) {
				ctx.output.printItem(result)
			} else {
				ctx.output.ok(`Updated ${key}.`)
			}
		},
	}
}
