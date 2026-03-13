export type TutorialDifficulty = "beginner" | "intermediate" | "advanced"
export type StepMode = "reading" | "web-editor" | "cli" | "ai"

export interface TutorialMeta {
	id: string
	title: string
	tagline: string
	description: string
	estimatedMinutes: number
	difficulty: TutorialDifficulty
	tags: string[]
	prerequisites: Prerequisite[]
}

export interface TutorialManifest extends TutorialMeta {
	steps: TutorialStep[]
}

export interface TutorialStep {
	id: string
	title: string
	/** Markdown content for the left pane */
	content: string
	estimatedSeconds?: number
	mode: StepMode
	/** Initial BPMN XML for web-editor steps (if not provided, uses previous step's saved XML) */
	initialXml?: string
	/** Commands for CLI steps */
	commands?: CliCommand[]
	/** Validation config - how to check step completion */
	validation: ValidationConfig
	/** Tiered hints: index 0 = vaguest, last = most specific */
	hints: string[]
}

export interface CliCommand {
	label: string
	command: string
	expectedOutput?: string
}

export type ValidationConfig =
	| { type: "manual"; successMessage: string; errorMessage?: string }
	| {
			type: "bpmn-element-count"
			elementType: string
			min: number
			successMessage: string
			errorMessage: string
	  }
	| { type: "bpmn-has-connection"; successMessage: string; errorMessage: string }
	| { type: "bpmn-element-labeled"; successMessage: string; errorMessage: string }

export interface Prerequisite {
	id: string
	label: string
	description: string
	required: boolean
	check: PrereqCheck
	fix: { command?: string; url?: string; label: string }
}

export type PrereqCheck =
	| { type: "none" }
	| { type: "node-version"; min: string }
	| { type: "proxy-running"; url: string }
	| { type: "manual" }

export interface TutorialProgress {
	currentStep: number
	completedSteps: number[]
	savedXml?: string
	startedAt: string
	lastActivityAt: string
}

export interface AllProgress {
	[tutorialId: string]: TutorialProgress
}
