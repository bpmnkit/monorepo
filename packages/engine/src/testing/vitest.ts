/**
 * Registers the BPMN matchers with Vitest and adds their types to `expect`.
 * Import it once from a setup file (`test.setupFiles`) or at the top of a test.
 */
import { expect } from "vitest"
import { bpmnMatchers } from "./matchers.js"
import type { BpmnMatchers } from "./matchers.js"

expect.extend(bpmnMatchers)

declare module "vitest" {
	// biome-ignore lint/suspicious/noExplicitAny: must match Vitest's own `Assertion<T = any>` declaration to merge with it
	// biome-ignore lint/suspicious/noEmptyInterface: declaration merging adds the matchers to Vitest's interface
	interface Assertion<T = any> extends BpmnMatchers<T> {}
}
