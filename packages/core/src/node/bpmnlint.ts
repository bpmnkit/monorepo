/**
 * Finding a project's `.bpmnlintrc` and, when the project has installed
 * bpmnlint itself, running it.
 *
 * bpmnlint is never a dependency of BPMN Kit. It is loaded — with a dynamic
 * `import()` — from the project that owns the `.bpmnlintrc`, the way ESLint
 * integrations load a project's own ESLint. That is what makes third-party
 * `bpmnlint-plugin-*` rules work: they resolve from the project's
 * `node_modules`, exactly as they do for the `bpmnlint` CLI.
 *
 * When bpmnlint is not installed, nothing is lost but the plugin rules: the
 * config still governs BPMN Kit's own equivalents (`applyBpmnlintConfig`).
 *
 * @packageDocumentation
 */

import { readFile, stat } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import {
	type BpmnlintConfig,
	type BpmnlintRuleValue,
	type ResolvedBpmnlintConfig,
	parseBpmnlintConfig,
	resolveBpmnlintConfig,
} from "../bpmn/bpmnlint.js"
import type { OptimizationSeverity } from "../bpmn/optimize/types.js"

/** The file name bpmnlint reads its configuration from. */
export const BPMNLINTRC = ".bpmnlintrc"

/**
 * Looks for a `.bpmnlintrc` in `startDir` and each directory above it.
 *
 * @param startDir - Where to start, usually the directory of the file being linted.
 * @returns The absolute path of the nearest config, or `undefined`.
 */
export async function findBpmnlintrc(startDir: string): Promise<string | undefined> {
	let dir = resolve(startDir)
	while (true) {
		const candidate = join(dir, BPMNLINTRC)
		try {
			if ((await stat(candidate)).isFile()) return candidate
		} catch {
			// Not here — keep walking up.
		}
		const parent = dirname(dir)
		if (parent === dir) return undefined
		dir = parent
	}
}

/**
 * Reads and parses a `.bpmnlintrc`.
 *
 * @param path - The file to read.
 * @throws With the path in the message when the file is not a valid config.
 */
export async function readBpmnlintrc(path: string): Promise<BpmnlintConfig> {
	const text = await readFile(path, "utf-8")
	try {
		return parseBpmnlintConfig(text)
	} catch (err) {
		throw new Error(`${path}: ${(err as Error).message}`)
	}
}

/** One problem reported by real bpmnlint. */
export interface BpmnlintReport {
	/** The rule that reported it, as bpmnlint names it (`label-required`, `camunda-compat/timer`). */
	rule: string
	severity: OptimizationSeverity
	message: string
	/** The element it concerns, when the rule named one. */
	elementId?: string
	/** The rule's documentation page, when it declares one. */
	documentationUrl?: string
}

export type RunBpmnlintResult =
	| {
			status: "ok"
			/** The version of bpmnlint that ran. */
			version: string
			reports: BpmnlintReport[]
			/**
			 * The rules bpmnlint actually applied, plugin configs included — what
			 * `applyBpmnlintConfig({ delegated: true })` needs to know which BPMN
			 * Kit findings bpmnlint has already covered.
			 */
			config: ResolvedBpmnlintConfig
	  }
	/** bpmnlint (or bpmn-moddle, which it parses with) is not installed in the project. */
	| { status: "unavailable"; missing: string[] }
	/** bpmnlint is installed but could not lint — an unknown plugin, a broken rule, bad XML. */
	| { status: "failed"; error: string }

// The slice of bpmnlint's and bpmn-moddle's APIs this module uses.
interface Linter {
	lint(root: unknown): Promise<Record<string, RawReport[]>>
	resolveConfiguredRules(config: BpmnlintConfig): Promise<Record<string, BpmnlintRuleValue>>
}
type LinterConstructor = new (options: { config: BpmnlintConfig; resolver: unknown }) => Linter
type NodeResolverConstructor = new (options: { require: NodeJS.Require }) => unknown
type ModdleConstructor = new (
	extensions: Record<string, unknown>,
) => { fromXML(xml: string): Promise<{ rootElement: unknown; warnings?: RawWarning[] }> }
interface RawReport {
	id?: string
	message: string
	category: "warn" | "error" | "info" | "rule-error"
	meta?: { documentation?: { url?: string } }
}
interface RawWarning {
	message: string
	element?: { id?: string }
}

const REPORT_SEVERITY: Record<RawReport["category"], OptimizationSeverity> = {
	error: "error",
	"rule-error": "error",
	warn: "warning",
	info: "info",
}

/** A module's export, whether it came through as a named ESM export or CommonJS `module.exports`. */
function exported<T>(mod: unknown, name: string): T | undefined {
	const record = mod as Record<string, unknown> & { default?: Record<string, unknown> }
	return (record[name] ?? record.default?.[name]) as T | undefined
}

/**
 * Lints a diagram with the project's own bpmnlint, if the project has one.
 *
 * @param xml - The diagram source.
 * @param config - The parsed `.bpmnlintrc`.
 * @param projectDir - Where bpmnlint, bpmn-moddle, plugins and moddle
 *   extensions are resolved from — the `.bpmnlintrc`'s directory.
 */
export async function runBpmnlint(
	xml: string,
	config: BpmnlintConfig,
	projectDir: string,
): Promise<RunBpmnlintResult> {
	const projectRequire = createRequire(join(resolve(projectDir), "__placeholder__.js"))
	const locate = (specifier: string): string | undefined => {
		try {
			return projectRequire.resolve(specifier)
		} catch {
			return undefined
		}
	}

	const paths = {
		bpmnlint: locate("bpmnlint"),
		resolver: locate("bpmnlint/lib/resolver/node-resolver"),
		moddle: locate("bpmn-moddle"),
	}
	const missing = [
		...(paths.bpmnlint === undefined || paths.resolver === undefined ? ["bpmnlint"] : []),
		...(paths.moddle === undefined ? ["bpmn-moddle"] : []),
	]
	if (paths.bpmnlint === undefined || paths.resolver === undefined || paths.moddle === undefined) {
		return { status: "unavailable", missing }
	}

	try {
		// One at a time: bpmnlint is CommonJS that `require()`s ESM shared with
		// bpmn-moddle, and Node refuses that require while a concurrent import()
		// of the same ESM is still loading.
		const moddleModule = await import(pathToFileURL(paths.moddle).href)
		const lintModule = await import(pathToFileURL(paths.bpmnlint).href)
		const resolverModule = await import(pathToFileURL(paths.resolver).href)
		const LinterClass = exported<LinterConstructor>(lintModule, "Linter")
		const NodeResolver = (resolverModule as { default?: NodeResolverConstructor }).default
		const Moddle =
			exported<ModdleConstructor>(moddleModule, "BpmnModdle") ??
			(moddleModule as { default?: ModdleConstructor }).default
		if (LinterClass === undefined || NodeResolver === undefined || Moddle === undefined) {
			return {
				status: "failed",
				error: "the installed bpmnlint or bpmn-moddle does not export the expected API",
			}
		}

		const extensions: Record<string, unknown> = {}
		for (const [prefix, path] of Object.entries(config.moddleExtensions ?? {})) {
			extensions[prefix] = projectRequire(path)
		}

		const { rootElement, warnings = [] } = await new Moddle(extensions).fromXML(xml)
		const linter = new LinterClass({
			config,
			resolver: new NodeResolver({ require: projectRequire }),
		})
		const [results, effective] = await Promise.all([
			linter.lint(rootElement),
			linter.resolveConfiguredRules(config),
		])

		// bpmnlint's CLI reports import warnings as errors under no rule; so do we.
		const reports: BpmnlintReport[] = warnings.map((warning) => ({
			rule: "bpmnlint/import",
			severity: "error",
			message: `Import warning: ${warning.message.split("\n")[0]}`,
			...(warning.element?.id !== undefined ? { elementId: warning.element.id } : {}),
		}))
		for (const [rule, ruleReports] of Object.entries(results)) {
			for (const report of ruleReports) {
				const url = report.meta?.documentation?.url
				reports.push({
					rule,
					severity: REPORT_SEVERITY[report.category] ?? "error",
					message:
						report.category === "rule-error" ? `Rule failed: ${report.message}` : report.message,
					...(report.id !== undefined ? { elementId: report.id } : {}),
					...(url !== undefined ? { documentationUrl: url } : {}),
				})
			}
		}

		const version = (projectRequire("bpmnlint/package.json") as { version: string }).version
		return { status: "ok", version, reports, config: resolveBpmnlintConfig({ rules: effective }) }
	} catch (err) {
		return { status: "failed", error: (err as Error).message }
	}
}

/** What a host needs to honour a project's `.bpmnlintrc` for one file. */
export interface BpmnlintSetup {
	/** The `.bpmnlintrc` that applies. */
	path: string
	/** The rules to apply to BPMN Kit's findings. */
	config: ResolvedBpmnlintConfig
	/** True when real bpmnlint ran the rules — pass as `delegated`/`bpmnlintDelegated`. */
	delegated: boolean
	/** Real bpmnlint's findings; empty when it did not run. */
	reports: BpmnlintReport[]
	/** Why real bpmnlint did not run, when it is installed but failed. */
	failure?: string
	/** The bpmnlint version that ran, when one did. */
	version?: string
}

/**
 * Finds the `.bpmnlintrc` governing a file and prepares it: parses it, and
 * runs the project's own bpmnlint when there is one.
 *
 * When real bpmnlint runs, its view of the config wins — it can expand
 * `plugin:` configs this package cannot — and `delegated` is true, so the
 * caller drops BPMN Kit's equivalents of the rules bpmnlint just reported.
 * When it is not installed, or fails, BPMN Kit's equivalents stand in.
 *
 * @param filePath - The diagram being linted.
 * @param xml - Its contents.
 * @param options - `runBpmnlint: false` skips real bpmnlint even if installed.
 * @returns `undefined` when no `.bpmnlintrc` applies.
 * @throws When the `.bpmnlintrc` found is not a valid config.
 */
export async function prepareBpmnlint(
	filePath: string,
	xml: string,
	options: { runBpmnlint?: boolean } = {},
): Promise<BpmnlintSetup | undefined> {
	const path = await findBpmnlintrc(dirname(resolve(filePath)))
	if (path === undefined) return undefined
	const raw = await readBpmnlintrc(path)
	const fallback = resolveBpmnlintConfig(raw)
	if (options.runBpmnlint === false) {
		return { path, config: fallback, delegated: false, reports: [] }
	}

	const run = await runBpmnlint(xml, raw, dirname(path))
	switch (run.status) {
		case "ok":
			return {
				path,
				config: run.config,
				delegated: true,
				reports: run.reports,
				version: run.version,
			}
		case "failed":
			return { path, config: fallback, delegated: false, reports: [], failure: run.error }
		case "unavailable":
			return { path, config: fallback, delegated: false, reports: [] }
	}
}
