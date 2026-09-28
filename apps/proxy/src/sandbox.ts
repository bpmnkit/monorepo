import ivm from "isolated-vm"

export type HostFunction = (...args: unknown[]) => Promise<unknown>

export interface SandboxContext {
	/** JSON-serializable values injected as named globals */
	data?: Record<string, unknown>
	/**
	 * Async host functions exposed as ivm.References.
	 * Inside the sandbox, call them with:
	 *   await __name.apply(undefined, [...args], { result: { promise: true, copy: true } })
	 */
	functions?: Record<string, HostFunction>
	/** JS injected before user code (e.g. proxy builders) */
	bootstrap?: string
}

export async function runSandboxed(
	code: string,
	ctx: SandboxContext,
	timeoutMs = 5000,
): Promise<unknown> {
	const isolate = new ivm.Isolate({ memoryLimit: 64 })
	try {
		const context = await isolate.createContext()
		const jail = context.global

		await jail.set("global", jail.derefInto())

		for (const [key, value] of Object.entries(ctx.data ?? {})) {
			await jail.set(key, new ivm.ExternalCopy(value).copyInto())
		}

		for (const [key, fn] of Object.entries(ctx.functions ?? {})) {
			await jail.set(
				key,
				new ivm.Reference(async (...args: unknown[]) => {
					const result = await fn(...args)
					return new ivm.ExternalCopy(result).copyInto()
				}),
			)
		}

		const fullCode = ctx.bootstrap ? `${ctx.bootstrap}\n${code}` : code

		return await context.evalClosure(`return (async function() {\n${fullCode}\n})()`, [], {
			result: { promise: true, copy: true },
			timeout: timeoutMs,
		})
	} finally {
		isolate.dispose()
	}
}

export interface SyncSandboxContext {
	/** JSON-serializable values injected as named globals */
	data?: Record<string, unknown>
	/**
	 * Host functions injected as named globals and called synchronously. Their
	 * arguments and return values are copied across the isolate boundary, so
	 * sandboxed code never holds a host object — nothing through which it could
	 * reach the host's `Function`, `process` or modules, as it can under
	 * `node:vm`.
	 */
	functions?: Record<string, (...args: unknown[]) => unknown>
	/** JS injected before user code (e.g. to group functions into an object) */
	bootstrap?: string
}

/**
 * The synchronous counterpart of {@link runSandboxed}, for callers that cannot
 * await — the MCP server's tool handlers run model-written code this way.
 * Returns a copy of the value the code returns; throws if the code throws,
 * times out or returns something that cannot be copied.
 */
export function runSandboxedSync(code: string, ctx: SyncSandboxContext, timeoutMs = 5000): unknown {
	const isolate = new ivm.Isolate({ memoryLimit: 64 })
	try {
		const context = isolate.createContextSync()
		const jail = context.global
		jail.setSync("global", jail.derefInto())
		for (const [key, value] of Object.entries(ctx.data ?? {})) {
			jail.setSync(key, new ivm.ExternalCopy(value).copyInto())
		}
		for (const [key, fn] of Object.entries(ctx.functions ?? {})) {
			jail.setSync(key, new ivm.Callback(fn))
		}
		const fullCode = ctx.bootstrap ? `${ctx.bootstrap}\n${code}` : code
		return context.evalSync(`(function() {\n${fullCode}\n})()`, {
			timeout: timeoutMs,
			copy: true,
		})
	} finally {
		isolate.dispose()
	}
}
