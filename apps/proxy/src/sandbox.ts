import ivm from "isolated-vm"

export type HostFunction = (...args: unknown[]) => Promise<unknown>

export interface SandboxContext {
  /** JSON-serializable values injected as named globals */
  data?: Record<string, unknown>
  /** Async host functions exposed as ivm.References */
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

    return await context.evalClosure(
      `return (async function() {\n${fullCode}\n})()`,
      [],
      { result: { promise: true, copy: true }, timeout: timeoutMs },
    )
  } finally {
    isolate.dispose()
  }
}
