/**
 * `.bpmnlintrc` compatibility — reading a bpmnlint configuration and applying
 * it to BPMN Kit's own findings.
 *
 * Teams coming from bpmn.io keep their lint configuration in a `.bpmnlintrc`.
 * This module reads that file's JSON, expands bpmnlint's built-in presets, and
 * maps each bpmnlint rule onto the BPMN Kit findings that report the same
 * problem, so the file's `off`/`warn`/`error`/`info` settings govern those
 * findings. Rules BPMN Kit had no finding for, and the parts of rules its
 * findings do not cover exactly, are implemented natively in
 * `optimize/bpmnlint-rules.ts` and only run when the config enables them.
 *
 * Pure and dependency-free: nothing here touches the filesystem or loads
 * bpmnlint itself. Finding the file and running real bpmnlint (for
 * third-party `bpmnlint-plugin-*` rules) is `@bpmnkit/core/node`'s job.
 *
 * @packageDocumentation
 */

import type { BpmnDefinitions } from "./bpmn-model.js"
import { NATIVE_BPMNLINT_RULES, analyzeBpmnlintRules } from "./optimize/bpmnlint-rules.js"
import type {
	OptimizationCategory,
	OptimizationFinding,
	OptimizationSeverity,
} from "./optimize/types.js"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** A rule's reporting level. bpmnlint also accepts `0`–`3` for these, in this order. */
export type BpmnlintSeverity = "off" | "warn" | "error" | "info"

/** A rule's setting as written in `.bpmnlintrc`: a level, or `[level, options]`. */
export type BpmnlintRuleValue =
	| BpmnlintSeverity
	| 0
	| 1
	| 2
	| 3
	| readonly [BpmnlintSeverity | 0 | 1 | 2 | 3, unknown?]

/** The contents of a `.bpmnlintrc` file. */
export interface BpmnlintConfig {
	extends?: string | string[]
	rules?: Record<string, BpmnlintRuleValue>
	/** Moddle extension descriptors, by prefix. Only real bpmnlint uses these. */
	moddleExtensions?: Record<string, string>
}

/** One rule's effective setting after presets and overrides are merged. */
export interface BpmnlintRuleSetting {
	severity: BpmnlintSeverity
	/** The second element of an `[level, options]` setting, when there was one. */
	options?: unknown
}

/** A `.bpmnlintrc` with its presets expanded and its rule names normalised. */
export interface ResolvedBpmnlintConfig {
	/** Rule name (`label-required`, `camunda-compat/timer`, …) → effective setting. */
	rules: Record<string, BpmnlintRuleSetting>
	/**
	 * `extends` entries this module could not expand — plugin configs
	 * (`plugin:<name>/<config>`) live in npm packages, which only real bpmnlint
	 * can load. Their rules are therefore unknown here.
	 */
	unresolvedExtends: string[]
}

/** bpmnlint's built-in presets, as of bpmnlint 11.14. */
const RULE_NAMES_ALL = [
	"ad-hoc-sub-process",
	"conditional-event",
	"conditional-flows",
	"end-event-required",
	"event-based-gateway",
	"event-sub-process-typed-start-event",
	"fake-join",
	"global",
	"label-required",
	"link-event",
	"no-bpmndi",
	"no-complex-gateway",
	"no-disconnected",
	"no-duplicate-sequence-flows",
	"no-gateway-join-fork",
	"no-implicit-end",
	"no-implicit-split",
	"no-implicit-start",
	"no-inclusive-gateway",
	"no-overlapping-elements",
	"single-blank-start-event",
	"single-event-definition",
	"standard-size",
	"start-event-required",
	"sub-process-blank-start-event",
	"superfluous-gateway",
	"superfluous-label",
	"superfluous-termination",
] as const

const PRESETS: Record<string, Record<string, BpmnlintSeverity>> = {
	all: Object.fromEntries(RULE_NAMES_ALL.map((name) => [name, "error"])),
	correctness: {
		"ad-hoc-sub-process": "error",
		"conditional-event": "error",
		"event-based-gateway": "error",
		"event-sub-process-typed-start-event": "error",
		"link-event": "error",
		"no-duplicate-sequence-flows": "warn",
		"sub-process-blank-start-event": "error",
		"single-blank-start-event": "error",
	},
	recommended: {
		"ad-hoc-sub-process": "error",
		"conditional-flows": "error",
		"end-event-required": "error",
		"event-based-gateway": "error",
		"event-sub-process-typed-start-event": "error",
		"fake-join": "warn",
		global: "warn",
		"label-required": "error",
		"link-event": "error",
		"no-bpmndi": "error",
		"no-complex-gateway": "error",
		"no-disconnected": "error",
		"no-duplicate-sequence-flows": "error",
		"no-gateway-join-fork": "error",
		"no-implicit-split": "error",
		"no-implicit-end": "error",
		"no-implicit-start": "error",
		"no-inclusive-gateway": "warn",
		"no-overlapping-elements": "warn",
		"single-blank-start-event": "error",
		"single-event-definition": "error",
		"start-event-required": "error",
		"sub-process-blank-start-event": "error",
		"superfluous-gateway": "warn",
		"superfluous-label": "warn",
		"superfluous-termination": "warn",
	},
}

const NUMERIC_SEVERITY: readonly BpmnlintSeverity[] = ["off", "warn", "error", "info"]

function configError(message: string): Error {
	return new Error(
		`${message} See https://github.com/bpmn-io/bpmnlint#configuration for the file format.`,
	)
}

/**
 * Parses the text of a `.bpmnlintrc` file.
 *
 * @param text - The file's contents (JSON).
 * @throws When the text is not JSON or does not have the shape bpmnlint expects.
 */
export function parseBpmnlintConfig(text: string): BpmnlintConfig {
	let value: unknown
	try {
		value = JSON.parse(text)
	} catch (err) {
		throw configError(`.bpmnlintrc is not valid JSON: ${(err as Error).message}.`)
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw configError(".bpmnlintrc must contain a JSON object.")
	}
	const raw = value as Record<string, unknown>
	const config: BpmnlintConfig = {}

	if (raw.extends !== undefined) {
		const list = Array.isArray(raw.extends) ? raw.extends : [raw.extends]
		if (!list.every((entry): entry is string => typeof entry === "string")) {
			throw configError('.bpmnlintrc "extends" must be a string or an array of strings.')
		}
		config.extends = typeof raw.extends === "string" ? raw.extends : list
	}

	if (raw.rules !== undefined) {
		if (typeof raw.rules !== "object" || raw.rules === null || Array.isArray(raw.rules)) {
			throw configError('.bpmnlintrc "rules" must be an object of rule name → setting.')
		}
		const rules: Record<string, BpmnlintRuleValue> = {}
		for (const [name, setting] of Object.entries(raw.rules)) {
			parseRuleValue(name, setting)
			rules[name] = setting as BpmnlintRuleValue
		}
		config.rules = rules
	}

	if (raw.moddleExtensions !== undefined) {
		const ext = raw.moddleExtensions
		if (
			typeof ext !== "object" ||
			ext === null ||
			!Object.values(ext).every((v) => typeof v === "string")
		) {
			throw configError('.bpmnlintrc "moddleExtensions" must map prefixes to module paths.')
		}
		config.moddleExtensions = ext as Record<string, string>
	}

	return config
}

/** Reads one rule setting, the way bpmnlint's `Linter#parseRuleValue` does. */
function parseRuleValue(name: string, value: unknown): BpmnlintRuleSetting {
	const [level, options] = Array.isArray(value) ? [value[0], value[1]] : [value, undefined]
	const normalised = typeof level === "string" ? level.toLowerCase() : level
	const severity =
		typeof normalised === "number" ? NUMERIC_SEVERITY[normalised] : (normalised as BpmnlintSeverity)
	if (severity === undefined || !NUMERIC_SEVERITY.includes(severity)) {
		throw configError(
			`.bpmnlintrc rule "${name}" has setting ${JSON.stringify(value)}; expected "off", "warn", "error", "info" (or 0–3), optionally as [level, options].`,
		)
	}
	return options === undefined ? { severity } : { severity, options }
}

function unprefixPlugin(name: string): string {
	return name.startsWith("bpmnlint-plugin-") ? name.slice("bpmnlint-plugin-".length) : name
}

/**
 * Normalises a rule name the way bpmnlint does, so the same rule written two
 * ways is one rule: `bpmnlint/label-required` → `label-required`,
 * `bpmnlint-plugin-foo/bar` → `foo/bar`, `@scope/bpmnlint-plugin-foo/bar` →
 * `@scope/foo/bar`.
 *
 * @param name - The rule name as written in the config.
 */
export function normalizeBpmnlintRuleName(name: string): string {
	const match = /^(?:(?:(@[^/]+)\/)?([^@/][^/]*)\/)?([^/]+)$/.exec(name)
	if (match === null) return name
	const [, scope, pkg, rule] = match
	if (pkg === undefined || pkg === "bpmnlint") return rule as string
	return `${scope !== undefined ? `${scope}/` : ""}${unprefixPlugin(pkg)}/${rule}`
}

/**
 * Expands a config's `extends` and merges its rules into one effective setting
 * per rule. Later entries win, and the file's own `rules` win over everything
 * it extends — the order bpmnlint applies.
 *
 * `bpmnlint:recommended`, `bpmnlint:all` and `bpmnlint:correctness` expand to
 * bpmnlint 11.14's presets. Plugin configs cannot be expanded without loading
 * the plugin and are listed in `unresolvedExtends` instead.
 *
 * @param config - A parsed `.bpmnlintrc`.
 */
export function resolveBpmnlintConfig(config: BpmnlintConfig): ResolvedBpmnlintConfig {
	const rules: Record<string, BpmnlintRuleSetting> = {}
	const unresolvedExtends: string[] = []

	const parents =
		config.extends === undefined
			? []
			: typeof config.extends === "string"
				? [config.extends]
				: config.extends
	for (const parent of parents) {
		const preset = /^bpmnlint:(.+)$/.exec(parent)?.[1]
		const presetRules = preset === undefined ? undefined : PRESETS[preset]
		if (presetRules === undefined) {
			unresolvedExtends.push(parent)
			continue
		}
		for (const [name, severity] of Object.entries(presetRules)) rules[name] = { severity }
	}

	for (const [name, value] of Object.entries(config.rules ?? {})) {
		rules[normalizeBpmnlintRuleName(name)] = parseRuleValue(name, value)
	}

	return { rules, unresolvedExtends }
}

// ---------------------------------------------------------------------------
// Rule mapping
// ---------------------------------------------------------------------------

/** How faithfully BPMN Kit reproduces a bpmnlint rule. */
export type BpmnlintMatch = "exact" | "approximate"

export interface BpmnlintRuleMapping {
	/** The BPMN Kit finding ids that report this rule's problem. */
	findings: readonly string[]
	match: BpmnlintMatch
	/** Where the two differ, for `approximate`. */
	note?: string
	/**
	 * BPMN Kit's own findings for the same concern whose semantics differ from
	 * the rule's. While a config sets the rule, at any level, they are dropped
	 * and the native finding in `findings` reports the rule instead. Without a
	 * config they are reported as usual.
	 */
	replaces?: readonly string[]
}

/**
 * Every bpmnlint built-in rule and the BPMN Kit findings standing in for it.
 *
 * The documentation table (`guides/bpmnlint`) is written from this — keep them
 * in step.
 */
export const BPMNLINT_RULE_MAP: Readonly<Record<string, BpmnlintRuleMapping>> = {
	"ad-hoc-sub-process": { findings: ["flow/ad-hoc-start-end-event"], match: "exact" },
	"conditional-event": { findings: ["flow/conditional-event-no-condition"], match: "exact" },
	"conditional-flows": {
		findings: ["feel/missing-condition"],
		replaces: ["feel/empty-condition"],
		match: "exact",
	},
	"end-event-required": {
		findings: ["flow/no-end-event", "flow/sub-process-no-end-event"],
		match: "exact",
	},
	"event-based-gateway": { findings: ["flow/event-gateway-invalid"], match: "exact" },
	"event-sub-process-typed-start-event": {
		findings: ["flow/event-sub-process-untyped-start"],
		match: "exact",
	},
	"fake-join": { findings: ["flow/multi-incoming-task"], match: "exact" },
	global: {
		findings: ["pattern/global-element"],
		match: "exact",
		note: "Also reports a global element with no name attribute at all; bpmnlint only reports an empty one.",
	},
	"label-required": {
		findings: ["naming/missing-label"],
		replaces: [
			"naming/unlabeled-task",
			"naming/unlabeled-start-event",
			"naming/unlabeled-end-event",
			"naming/split-gateway-no-label",
			"naming/missing-flow-condition",
		],
		match: "exact",
		note: "Lanes are read from a process's first lane set, the one BPMN Kit models.",
	},
	"link-event": { findings: ["flow/link-event-mismatch"], match: "exact" },
	"no-bpmndi": { findings: ["pattern/missing-di"], match: "exact" },
	"no-complex-gateway": { findings: ["pattern/complex-gateway"], match: "exact" },
	"no-disconnected": { findings: ["flow/disconnected"], match: "exact" },
	"no-duplicate-sequence-flows": {
		findings: ["flow/duplicate-sequence-flow"],
		match: "exact",
		note: "One finding per duplicate flow naming the flow, its source and its target, where bpmnlint reports the three separately.",
	},
	"no-gateway-join-fork": { findings: ["flow/mixed-gateway"], match: "exact" },
	"no-implicit-end": {
		findings: ["flow/implicit-end"],
		replaces: ["flow/dead-end"],
		match: "exact",
	},
	"no-implicit-split": { findings: ["flow/implicit-split"], match: "exact" },
	"no-implicit-start": {
		findings: ["flow/implicit-start"],
		replaces: ["flow/unreachable"],
		match: "exact",
	},
	"no-inclusive-gateway": { findings: ["pattern/inclusive-gateway"], match: "exact" },
	"no-overlapping-elements": { findings: ["pattern/overlapping-elements"], match: "exact" },
	"single-blank-start-event": { findings: ["flow/multiple-blank-start-events"], match: "exact" },
	"single-event-definition": { findings: ["flow/multiple-event-definitions"], match: "exact" },
	"standard-size": { findings: ["pattern/non-standard-size"], match: "exact" },
	"start-event-required": {
		findings: ["flow/no-start-event", "flow/sub-process-no-start-event"],
		match: "exact",
	},
	"sub-process-blank-start-event": { findings: ["flow/sub-process-typed-start"], match: "exact" },
	"superfluous-gateway": { findings: ["flow/redundant-gateway"], match: "exact" },
	"superfluous-label": { findings: ["naming/superfluous-flow-label"], match: "exact" },
	"superfluous-termination": { findings: ["flow/superfluous-termination"], match: "exact" },
}

const RULE_FOR_FINDING: ReadonlyMap<string, string> = new Map(
	Object.entries(BPMNLINT_RULE_MAP).flatMap(([rule, mapping]) =>
		mapping.findings.map((finding) => [finding, rule] as const),
	),
)

const RULE_REPLACING_FINDING: ReadonlyMap<string, string> = new Map(
	Object.entries(BPMNLINT_RULE_MAP).flatMap(([rule, mapping]) =>
		(mapping.replaces ?? []).map((finding) => [finding, rule] as const),
	),
)

/**
 * The bpmnlint rule a BPMN Kit finding stands in for, if any.
 *
 * @param findingId - A finding id such as `flow/mixed-gateway`.
 */
export function bpmnlintRuleForFinding(findingId: string): string | undefined {
	return RULE_FOR_FINDING.get(findingId)
}

// ---------------------------------------------------------------------------
// Applying a config
// ---------------------------------------------------------------------------

/** A configured rule, or `extends` entry, BPMN Kit could not honour. */
export interface UnsupportedBpmnlintRule {
	/** The rule name, or the `extends` entry. */
	name: string
	reason: "plugin-rule" | "unknown-rule" | "unresolved-extends"
	/** The configured severity, for a rule. */
	severity?: BpmnlintSeverity
}

export interface ApplyBpmnlintOptions {
	/**
	 * Real bpmnlint ran the configured rules itself, so BPMN Kit must not report
	 * them a second time: findings mapped to a configured rule are dropped and
	 * no native equivalents run. Rules the config leaves out are untouched.
	 */
	delegated?: boolean
	/** Restrict native equivalents to these categories (mirrors `--categories`). */
	categories?: readonly OptimizationCategory[]
}

export interface BpmnlintApplication {
	/** The findings with the config applied: re-levelled, dropped or added. */
	findings: OptimizationFinding[]
	/** What the config asked for that BPMN Kit could not do. Empty when delegated. */
	unsupported: UnsupportedBpmnlintRule[]
}

const SEVERITY: Record<Exclude<BpmnlintSeverity, "off">, OptimizationSeverity> = {
	error: "error",
	warn: "warning",
	info: "info",
}

/**
 * Applies a `.bpmnlintrc` to a set of BPMN Kit findings.
 *
 * - A finding that stands in for a configured rule takes that rule's
 *   severity, or is dropped when the rule is `off`, and carries the rule name
 *   in `bpmnlintRule`.
 * - A finding a configured rule `replaces` is dropped: the rule's native
 *   finding reports the concern with bpmnlint's semantics instead.
 * - Enabled rules BPMN Kit implements natively are run and their findings
 *   added.
 * - Findings with no bpmnlint counterpart, and findings whose rule the config
 *   does not mention, keep BPMN Kit's defaults: the config overrides BPMN
 *   Kit's opinion where it has one, it does not switch BPMN Kit's other rules
 *   off.
 * - Configured rules with no equivalent are returned in `unsupported`, never
 *   silently ignored.
 *
 * @param definitions - The model the findings were produced from.
 * @param findings - Output of `optimize()` (or a filtered subset of it).
 * @param config - A resolved `.bpmnlintrc`.
 * @param options - See {@link ApplyBpmnlintOptions}.
 */
export function applyBpmnlintConfig(
	definitions: BpmnDefinitions,
	findings: readonly OptimizationFinding[],
	config: ResolvedBpmnlintConfig,
	options: ApplyBpmnlintOptions = {},
): BpmnlintApplication {
	const delegated = options.delegated === true
	const result: OptimizationFinding[] = []

	for (const finding of findings) {
		const replacedBy = RULE_REPLACING_FINDING.get(finding.id)
		if (replacedBy !== undefined && config.rules[replacedBy] !== undefined) continue
		const rule = bpmnlintRuleForFinding(finding.id)
		const setting = rule === undefined ? undefined : config.rules[rule]
		if (rule === undefined || setting === undefined) {
			result.push(finding)
			continue
		}
		if (delegated || setting.severity === "off") continue
		result.push({ ...finding, severity: SEVERITY[setting.severity], bpmnlintRule: rule })
	}

	if (delegated) return { findings: result, unsupported: [] }

	const native = new Map<string, unknown>()
	const unsupported: UnsupportedBpmnlintRule[] = config.unresolvedExtends.map((name) => ({
		name,
		reason: "unresolved-extends",
	}))
	for (const [rule, setting] of Object.entries(config.rules)) {
		if (setting.severity === "off") continue
		if (BPMNLINT_RULE_MAP[rule] === undefined) {
			unsupported.push({
				name: rule,
				reason: rule.includes("/") ? "plugin-rule" : "unknown-rule",
				severity: setting.severity,
			})
			continue
		}
		if (NATIVE_BPMNLINT_RULES.includes(rule)) native.set(rule, setting.options)
	}

	for (const finding of analyzeBpmnlintRules(definitions, native, options.categories)) {
		const rule = bpmnlintRuleForFinding(finding.id)
		const setting = rule === undefined ? undefined : config.rules[rule]
		if (rule === undefined || setting === undefined || setting.severity === "off") continue
		result.push({ ...finding, severity: SEVERITY[setting.severity], bpmnlintRule: rule })
	}

	return { findings: result, unsupported }
}
