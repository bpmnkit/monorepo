import type { SemanticDiff } from "./bpmn/semantic-hash.js"

/**
 * Typed error codes for all errors thrown by `@bpmnkit/core`.
 *
 * Use these values to programmatically distinguish error causes:
 * ```typescript
 * import { ParseError, ErrorCode } from "@bpmnkit/core"
 *
 * try {
 *   const defs = Bpmn.parse(xml)
 * } catch (err) {
 *   if (err instanceof ParseError) {
 *     console.error(err.code, err.message)
 *   }
 * }
 * ```
 */
export type ErrorCode =
	/** XML could not be parsed or a required attribute was missing. */
	| "parse-error"
	/** A builder received an invalid combination of options. */
	| "validation-error"
	/** Serialising a model and reading it back did not reproduce the model. */
	| "write-verification-error"
	/** The output file could not be written. */
	| "write-error"

/**
 * Base class for all errors thrown by `@bpmnkit/core`.
 *
 * Always use `instanceof ParseError` or `instanceof ValidationError` rather
 * than catching the base class, so you can handle each case precisely.
 */
export class BpmnSdkError extends Error {
	/** Machine-readable error code. */
	readonly code: ErrorCode

	constructor(message: string, code: ErrorCode) {
		super(message)
		this.name = "BpmnSdkError"
		this.code = code
	}
}

/**
 * Thrown when BPMN or DMN XML cannot be parsed, or when a required attribute
 * is missing from an element.
 *
 * @example
 * ```typescript
 * import { Bpmn, ParseError } from "@bpmnkit/core"
 *
 * try {
 *   const defs = Bpmn.parse("<invalid>")
 * } catch (err) {
 *   if (err instanceof ParseError) {
 *     // err.code === "parse-error"
 *     console.error("Bad BPMN XML:", err.message)
 *   }
 * }
 * ```
 */
export class ParseError extends BpmnSdkError {
	constructor(message: string) {
		super(message, "parse-error")
		this.name = "ParseError"
	}
}

/**
 * Thrown when a builder receives an invalid combination of options, such as a
 * DMN rule with the wrong number of input or output entries.
 *
 * @example
 * ```typescript
 * import { Dmn, ValidationError } from "@bpmnkit/core"
 *
 * try {
 *   Dmn.createDecisionTable("decide")
 *     .input({ expression: "age" })
 *     .rule({ inputs: [], outputs: ["adult"] }) // ← wrong count
 *     .build()
 * } catch (err) {
 *   if (err instanceof ValidationError) {
 *     console.error("Builder error:", err.message)
 *   }
 * }
 * ```
 */
export class ValidationError extends BpmnSdkError {
	constructor(message: string) {
		super(message, "validation-error")
		this.name = "ValidationError"
	}
}

/**
 * Thrown when serialising a model and parsing the result back does not
 * reproduce the model.
 *
 * This means the write would have put something on disk that no longer says
 * what the model said, so nothing is written. {@link changes} names the
 * elements that diverged.
 *
 * @example
 * ```typescript
 * import { writeBpmn } from "@bpmnkit/core/node"
 * import { WriteVerificationError } from "@bpmnkit/core"
 *
 * try {
 *   await writeBpmn(definitions, { output: "flow.bpmn" })
 * } catch (err) {
 *   if (err instanceof WriteVerificationError) {
 *     console.error("would have lost:", err.changes.removed)
 *   }
 * }
 * ```
 */
export class WriteVerificationError extends BpmnSdkError {
	/** What differed between the model and the model read back from the output. */
	readonly changes: SemanticDiff

	constructor(message: string, changes: SemanticDiff) {
		super(message, "write-verification-error")
		this.name = "WriteVerificationError"
		this.changes = changes
	}
}

/**
 * Thrown when the output file cannot be written — it already exists and
 * `force` was not given, or the filesystem refused the write.
 */
export class WriteError extends BpmnSdkError {
	constructor(message: string) {
		super(message, "write-error")
		this.name = "WriteError"
	}
}
