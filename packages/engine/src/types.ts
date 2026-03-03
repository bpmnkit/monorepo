// ── Events ────────────────────────────────────────────────────────────────────

export type ProcessEvent =
	| { type: "element:entering"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:entered"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:leaving"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:left"; elementId: string; elementName?: string; elementType: string }
	| { type: "variable:set"; name: string; value: unknown; scopeId: string }
	| { type: "job:created"; job: Job }
	| { type: "process:completed"; variables: Record<string, unknown> }
	| { type: "process:failed"; error: string };

// ── Jobs ──────────────────────────────────────────────────────────────────────

export interface Job {
	readonly id: string;
	readonly type: string;
	readonly headers: Record<string, string>;
	readonly variables: Record<string, unknown>;
	complete(variables?: Record<string, unknown>): void;
	fail(error: string): void;
	throwError(code: string, message: string): void;
}

export type JobHandler = (job: Job) => void | Promise<void>;
