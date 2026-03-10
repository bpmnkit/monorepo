/**
 * Typed error codes for all errors thrown by `@bpmn-sdk/core`.
 *
 * Use these values to programmatically distinguish error causes:
 * ```typescript
 * import { ParseError, ErrorCode } from "@bpmn-sdk/core"
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

/**
 * Base class for all errors thrown by `@bpmn-sdk/core`.
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
 * import { Bpmn, ParseError } from "@bpmn-sdk/core"
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
 * import { Dmn, ValidationError } from "@bpmn-sdk/core"
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
