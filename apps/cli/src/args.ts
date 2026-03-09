import type { ParsedFlags } from "./types.js"

export interface ParseResult {
	positional: string[]
	flags: ParsedFlags
}

/**
 * Parse argv tokens into positional arguments and flags.
 *
 * Supports:
 *   --flag value        string / number flag
 *   --flag=value        alternative syntax
 *   --flag              boolean flag (true)
 *   --no-flag           boolean flag negation (false)
 *   -f value            short flag
 *   -f=value            short flag with equals
 *   --                  stop flag parsing; everything after is positional
 */
export function parseArgs(argv: string[]): ParseResult {
	const positional: string[] = []
	const flags: ParsedFlags = {}
	let i = 0
	let stopFlags = false

	while (i < argv.length) {
		const arg = argv[i] ?? ""

		if (stopFlags || arg === "") {
			positional.push(arg)
			i++
			continue
		}

		if (arg === "--") {
			stopFlags = true
			i++
			continue
		}

		if (arg.startsWith("--")) {
			const raw = arg.slice(2)
			const eqIdx = raw.indexOf("=")

			if (eqIdx >= 0) {
				// --flag=value
				const name = raw.slice(0, eqIdx)
				const value = raw.slice(eqIdx + 1)
				flags[name] = coerce(value)
			} else if (raw.startsWith("no-")) {
				// --no-flag → false
				flags[raw.slice(3)] = false
			} else {
				// --flag [value?]
				const next = argv[i + 1]
				if (next !== undefined && !next.startsWith("-")) {
					flags[raw] = coerce(next)
					i++
				} else {
					flags[raw] = true
				}
			}
		} else if (arg.startsWith("-") && arg.length === 2) {
			// -f [value?]
			const short = arg.slice(1)
			const next = argv[i + 1]
			if (next !== undefined && !next.startsWith("-")) {
				flags[short] = coerce(next)
				i++
			} else {
				flags[short] = true
			}
		} else if (arg.startsWith("-") && arg.length > 2 && arg[2] !== "-") {
			// -fVALUE or -f=VALUE
			const short = arg[1] ?? ""
			const rest = arg.slice(2).replace(/^=/, "")
			flags[short] = coerce(rest)
		} else {
			positional.push(arg)
		}

		i++
	}

	return { positional, flags }
}

/** Coerce string to number or boolean if it looks like one. */
function coerce(value: string): string | number | boolean {
	if (value === "true") return true
	if (value === "false") return false
	const n = Number(value)
	if (!Number.isNaN(n) && value.trim() !== "") return n
	return value
}

/** Resolve a flag value with a fallback, returning it as a string. */
export function flagStr(flags: ParsedFlags, name: string, short?: string): string | undefined {
	const v = flags[name] ?? (short ? flags[short] : undefined)
	return v !== undefined ? String(v) : undefined
}

/** Resolve a flag value as a boolean. */
export function flagBool(flags: ParsedFlags, name: string, short?: string): boolean {
	const v = flags[name] ?? (short ? flags[short] : undefined)
	return v === true || v === "true" || v === 1
}
