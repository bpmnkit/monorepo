/**
 * Standalone step runtime module.
 * Logic is inlined directly in [step].astro via its <script> block.
 * This file is kept as a module export for potential reuse.
 */
export type { ValidationResult } from "../lib/validation.js"
export { validateStep } from "../lib/validation.js"
export {
	loadProgress,
	saveProgress,
	markStepComplete,
	saveCanvasXml,
} from "../lib/progress.js"
