// ── Events ────────────────────────────────────────────────────────────────────

export type ProcessEvent =
	| { type: "element:entering"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:entered"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:leaving"; elementId: string; elementName?: string; elementType: string }
	| { type: "element:left"; elementId: string; elementName?: string; elementType: string }
	| { type: "variable:set"; name: string; value: unknown; scopeId: string }
	/** `elementId` is the element the job belongs to — an ad-hoc sub-process creates several. */
	| { type: "job:created"; job: Job; elementId: string }
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

/** An inner element of an ad-hoc sub-process to activate, with variables local to that activation. */
export interface AdHocActivateElement {
	readonly elementId: string
	readonly variables?: Record<string, unknown>
}

/**
 * The job result a worker for an ad-hoc sub-process completes its job with —
 * Camunda's `adHocSubProcess` job result. Activate inner elements, or fulfil
 * the completion condition, but not both at once.
 */
export interface AdHocSubProcessJobResult {
	readonly type: "adHocSubProcess"
	readonly activateElements?: readonly AdHocActivateElement[]
	/** Complete the ad-hoc sub-process — once its running elements finish, unless they are cancelled. */
	readonly isCompletionConditionFulfilled?: boolean
	/** With a fulfilled completion condition, cancel the inner elements still running. */
	readonly isCancelRemainingInstances?: boolean
}

/** A job result, as passed to {@link Job.complete}. */
export type JobResult = AdHocSubProcessJobResult

export interface Job {
	readonly id: string
	readonly type: string
	readonly headers: Record<string, string>
	readonly variables: Record<string, unknown>
	/**
	 * Complete the job. `result` steers an ad-hoc sub-process job — which inner
	 * elements to activate, whether it is done. Completing an ad-hoc
	 * sub-process job without a result completes the ad-hoc sub-process.
	 */
	complete(variables?: Record<string, unknown>, result?: JobResult): void
	fail(error: string): void
	throwError(code: string, message: string): void
}

export type JobHandler = (job: Job) => void | Promise<void>
