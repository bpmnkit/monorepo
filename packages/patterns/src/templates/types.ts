import type { BpmnDefinitions, DmnDefinitions, FormDefinition } from "@bpmnkit/core"

/** Gallery category a template is filed under. */
export type TemplateCategory =
	| "order-to-cash"
	| "approvals"
	| "onboarding"
	| "incident"
	| "documents"
	| "sla"
	| "saga"
	| "human-in-the-loop"
	| "ai-agents"

/** Display metadata for a {@link TemplateCategory}. */
export interface TemplateCategoryInfo {
	id: TemplateCategory
	label: string
	description: string
}

/** What a mocked job worker does in a scenario: complete with outputs, or fail. */
export interface TemplateScenarioMock {
	/** Variables the worker completes the job with. */
	outputs?: Record<string, unknown>
	/** If set, the worker fails the job with this message instead of completing it. */
	error?: string
}

/**
 * One test scenario, in the `.bpmn.tests.json` shape that `casen test` reads and
 * `runScenario` from `@bpmnkit/engine` accepts.
 */
export interface TemplateScenario {
	id: string
	name: string
	/** Process to start. Defaults to the first process in the file. */
	processId?: string
	/** Variables the instance starts with. */
	inputs?: Record<string, unknown>
	/** Job worker mocks keyed by job type. Native user tasks are keyed `userTask`. */
	mocks?: Record<string, TemplateScenarioMock>
	expect?: {
		/** Element ids that must be visited, in this order (a subsequence of the run). */
		path?: string[]
		/** Variables that must hold these values when the instance ends. */
		variables?: Record<string, unknown>
	}
}

/** A runnable Camunda 8 process template. */
export interface ProcessTemplate {
	/** Unique slug — the gallery URL and `casen template use <id>`. */
	id: string
	title: string
	/** One paragraph: what the process does and what it shows. */
	description: string
	category: TemplateCategory
	tags: string[]
	/** Builds the process, laid out, with Zeebe extensions. Each call returns a fresh model. */
	build(): BpmnDefinitions
	/** DMN decisions the process calls, deployed next to it. */
	decisions?(): DmnDefinitions[]
	/** Camunda forms the process's user tasks link to. */
	forms?(): FormDefinition[]
	/** At least a happy path and one alternative path. */
	scenarios: TemplateScenario[]
}

/** A file a template writes into a project. */
export interface TemplateFile {
	/** File name, relative to the target directory. */
	path: string
	content: string
}
