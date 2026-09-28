/**
 * What the `casen dev` server and its browser UI say to each other.
 *
 * Types only, and no imports: the browser bundle type-checks against this file
 * under DOM typings, where nothing from Node may leak in.
 */

export type ModelKind = "bpmn" | "dmn" | "form"

/** A file the dev server can open and write. `tests` is a `.bpmn.tests.json` sidecar. */
export type EditableKind = ModelKind | "tests"

export interface ProjectFile {
	/** Project-relative, always with `/` separators. */
	path: string
	kind: ModelKind
	/** For a BPMN file: whether a `.bpmn.tests.json` sidecar sits next to it. */
	hasTests: boolean
}

/** `ts` is `@bpmnkit/engine`; `wasm` is Reebe compiled to WebAssembly, for Zeebe semantics. */
export type ScenarioEngine = "ts" | "wasm"

export interface LintSummary {
	errors: number
	warnings: number
	infos: number
	findings: Array<{
		severity: "error" | "warning" | "info"
		category: string
		message: string
		elementIds: string[]
	}>
}

export interface ScenarioOutcome {
	name: string
	passed: boolean
	durationMs: number
	/** One line per failed assertion or runtime error. */
	problems: string[]
}

export interface CheckResult {
	/** Project-relative path of the model the checks ran on. */
	path: string
	kind: ModelKind
	/** ISO timestamp of the run. */
	at: string
	/** Set when the file does not parse; nothing else ran. */
	parseError?: string
	/** BPMN only. */
	lint?: LintSummary
	/** BPMN with a sidecar only. */
	tests?: { engine: ScenarioEngine; passed: number; failed: number; scenarios: ScenarioOutcome[] }
	/** Set when the sidecar exists but cannot be read as a list of scenarios. */
	testsError?: string
}

/** `GET /api/files` */
export interface FilesResponse {
	project: string
	engine: ScenarioEngine
	files: ProjectFile[]
	checks: CheckResult[]
}

/** `GET /api/file?path=` */
export interface FileResponse {
	path: string
	kind: EditableKind
	text: string
	etag: string
}

/** `PUT /api/file?path=` with `{ text, baseEtag }`; `baseEtag: null` creates the file. */
export interface SaveRequest {
	text: string
	baseEtag: string | null
}

export interface SaveResponse {
	path: string
	etag: string
	outcome: "created" | "preserved" | "rewritten"
}

/** Any non-2xx answer. A 409 carries what is on disk now (`null`: deleted). */
export interface ErrorResponse {
	error: string
	etag?: string | null
}

/** One frame on `GET /api/events`. */
export type DevEvent =
	| { type: "files"; files: ProjectFile[] }
	| { type: "change"; path: string; etag: string | null }
	| { type: "check"; result: CheckResult }

/** The header every `/api` request carries; `/api/events` takes `?token=` instead. */
export const TOKEN_HEADER = "x-casen-dev-token"
