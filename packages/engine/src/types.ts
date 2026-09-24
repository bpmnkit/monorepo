// ── Events ────────────────────────────────────────────────────────────────────

export type ProcessEvent =
	| { type: "element:entering"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:entered"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:leaving"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:left"; elementId: string; elementName?: string; elementType: string }
	| { type: "variable:set"; name: string; value: unknown; scopeId: string }
	| { type: "job:created"; job: Job }
	| {
			type: "feel:evaluated"
			elementId: string
			property: string
			expression: string
			result: unknown
			variables: Record<string, unknown>
	  }
	| { type: "element:failed"; elementId: string; error: string }
	/** An active element was cancelled by an interrupting event, a terminate end event or a completion condition. */
	| { type: "element:terminated"; elementId: string; elementName?: string; elementType: string }
	/** Something the simulator could not execute as modelled; the run continues. */
	| { type: "element:warning"; elementId: string; message: string }
	| { type: "process:completed"; variables: Record<string, unknown> }
	| { type: "process:failed"; error: string }

// ── Jobs ──────────────────────────────────────────────────────────────────────

export interface Job {
	readonly id: string
	readonly type: string
	readonly headers: Record<string, string>
	readonly variables: Record<string, unknown>
	complete(variables?: Record<string, unknown>): void
	fail(error: string): void
	throwError(code: string, message: string): void
}

export type JobHandler = (job: Job) => void | Promise<void>
