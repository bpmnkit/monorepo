import type { AdminApiClient, CamundaClient, RawResponseEvent } from "@bpmnkit/api"
import type { Relation } from "@bpmnkit/api"

export type { RawResponseEvent, Relation }

// ─── Output ───────────────────────────────────────────────────────────────────

export type OutputFormat = "table" | "json" | "yaml"

/** Column definition for table output. */
export interface ColumnDef {
	/** Dot-path into the row object, e.g. "processInstanceKey" */
	key: string
	/** Column header text (printed in upper case) */
	header: string
	/** Hard truncation to this many chars (0 = no limit) */
	maxWidth?: number
	/** Optional value transformer applied before display */
	transform?: (value: unknown) => string
}

/**
 * The single output seam between commands and their rendering layer.
 * CLI renders tables/JSON; a future TUI can provide its own implementation.
 */
export interface OutputWriter {
	readonly format: OutputFormat
	readonly isInteractive: boolean
	/** Render a list result (auto-unwraps .items). Shows total count. */
	printList(data: unknown, columns: ColumnDef[]): void
	/** Render a single object as labelled key-value pairs. */
	printItem(data: unknown): void
	/** Render raw data according to the active format. */
	print(data: unknown): void
	/** Print a success line (✓ message) */
	ok(msg: string): void
	/** Print an informational line */
	info(msg: string): void
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/** Schema spec for a single field inside a JSON flag value. */
export interface JsonFieldSpec {
	name: string
	type: "string" | "boolean" | "number" | "object" | "array"
	description?: string
	required?: boolean
	/** Restricts to specific values; TUI shows a cycling picker. */
	enum?: string[]
}

export interface FlagSpec {
	name: string
	short?: string
	description: string
	type: "string" | "boolean" | "number"
	default?: string | boolean | number
	required?: boolean
	/** Display placeholder in help, e.g. "JSON" or "KEY" */
	placeholder?: string
	/** Restricts to specific values; TUI shows a cycling picker (↑↓ to select). */
	enum?: string[]
	/** Value is a JSON object; TUI opens a structured key-value editor. */
	json?: boolean
	/** Preset values for number fields; ↑↓ cycles through them in edit mode. */
	presets?: number[]
	/** Known fields within this JSON object, sourced from OpenAPI schema. */
	fields?: JsonFieldSpec[]
}

export interface ArgSpec {
	name: string
	description: string
	required?: boolean
	/** Restricts to specific values; TUI shows a cycling picker. */
	enum?: string[]
	/** Value is a JSON object; TUI opens a key-value editor. */
	json?: boolean
}

export interface Example {
	description: string
	command: string
}

/** Context passed to every command's run function. */
export interface RunContext {
	positional: string[]
	flags: ParsedFlags
	output: OutputWriter
	/** Lazily creates a CamundaClient (C8 API) from the active profile. */
	getClient(): Promise<CamundaClient>
	/** Lazily creates an AdminApiClient from the active profile. */
	getAdminClient(): Promise<AdminApiClient>
}

export type ParsedFlags = Record<string, string | boolean | number>

/** A single executable command. */
export interface Command {
	name: string
	aliases?: string[]
	description: string
	args?: ArgSpec[]
	flags?: FlagSpec[]
	examples?: Example[]
	/** Column definitions — stored on list commands for display and relation detection. */
	columns?: ColumnDef[]
	/** Follow-up commands whose args can be pre-filled from this command's result fields. */
	relations?: Relation[]
	run(ctx: RunContext): Promise<void>
}

/** A group of related commands (maps to one API resource namespace). */
export interface CommandGroup {
	/** kebab-case name, e.g. "process-instance" */
	name: string
	aliases?: string[]
	description: string
	commands: Command[]
}
