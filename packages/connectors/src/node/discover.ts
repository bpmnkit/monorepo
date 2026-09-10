import type { Dirent } from "node:fs"
import { readFile, readdir, stat } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"
import type { ElementTemplate } from "../template-types.js"
import { type TemplateProblem, readTemplateDocument } from "../validate.js"

/** The folder name searched at each level, unless the caller names another. */
export const DEFAULT_CONFIG_FOLDER = ".camunda"

/** The sub-folder inside the config folder that holds templates. */
export const TEMPLATES_SUBFOLDER = "element-templates"

export interface DiscoverOptions {
	/**
	 * Where to start looking — a `.bpmn` file, or the directory holding it.
	 * The search walks up from here.
	 */
	from: string
	/**
	 * Where to stop. The walk includes this directory and goes no further, so a
	 * template outside the project cannot be picked up by accident. Defaults to
	 * the filesystem root, which is almost never what a caller wants.
	 */
	root?: string
	/** Config folder name. Defaults to `.camunda`. */
	configFolder?: string
}

/** A template that could not be used, and where it came from. */
export interface DiscoveryProblem extends TemplateProblem {
	/** Absolute path of the file the problem was found in. */
	file: string
	/** The template's id, when the document got far enough to have one. */
	id?: string
	/** Index within the file, for a document holding an array of templates. */
	index?: number
}

export interface DiscoveryResult {
	/** Valid templates, nearest directory last so a later register wins. */
	templates: ElementTemplate[]
	/** Everything rejected, each named by file — nothing is dropped silently. */
	problems: DiscoveryProblem[]
	/** Valid but worth saying, e.g. a binding this toolkit cannot apply yet. */
	warnings: DiscoveryProblem[]
	/** The template directories that were read, nearest last. */
	directories: string[]
}

/** Directories from `root` down to `from`, so the nearest one is read last. */
function directoriesFromRootDown(from: string, root: string | undefined): string[] {
	const start = resolve(from)
	if (root === undefined) {
		// No root given: walk to the filesystem root.
		const chain: string[] = []
		for (let dir = start; ; dir = dirname(dir)) {
			chain.push(dir)
			if (dirname(dir) === dir) break
		}
		return chain.reverse()
	}

	const stop = resolve(root)
	// A start outside the root would otherwise walk past it and out of the
	// project; search only where the caller said it was allowed to.
	if (start !== stop && !start.startsWith(stop + sep)) return [start]

	const chain: string[] = []
	for (let dir = start; ; dir = dirname(dir)) {
		chain.push(dir)
		if (dir === stop || dirname(dir) === dir) break
	}
	return chain.reverse()
}

async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory()
	} catch {
		return false
	}
}

/**
 * Finds a project's own element templates by convention.
 *
 * Every directory from `root` down to the one holding `from` is checked for
 * `<configFolder>/element-templates/*.json`. No project configuration, no
 * registration step: drop a template next to the diagram that uses it and the
 * tools pick it up.
 *
 * Order is deliberate. Directories are read root-first so the nearest one is
 * read last, and `registerElementTemplates` keeps the last registration of an
 * id — a template beside the diagram overrides one at the project root, which
 * overrides the bundled catalogue.
 *
 * A file that is not valid JSON, or holds a template the schema rejects, is
 * reported in `problems` against its own path and left out of `templates`. One
 * bad file never costs the caller the good ones beside it.
 *
 * @example
 * ```typescript
 * const { templates, problems } = await discoverElementTemplates({
 *   from: "processes/orders/order.bpmn",
 *   root: process.cwd(),
 * });
 * registerElementTemplates(templates);
 * ```
 */
export async function discoverElementTemplates(options: DiscoverOptions): Promise<DiscoveryResult> {
	const { from, root, configFolder = DEFAULT_CONFIG_FOLDER } = options

	// `from` may name the diagram rather than its folder.
	const startDir = (await isDirectory(from)) ? resolve(from) : dirname(resolve(from))

	const templates: ElementTemplate[] = []
	const problems: DiscoveryProblem[] = []
	const warnings: DiscoveryProblem[] = []
	const directories: string[] = []

	for (const dir of directoriesFromRootDown(startDir, root)) {
		const templateDir = join(dir, configFolder, TEMPLATES_SUBFOLDER)
		if (!(await isDirectory(templateDir))) continue
		directories.push(templateDir)

		const found = await readTemplateDirectory(templateDir)
		templates.push(...found.templates)
		problems.push(...found.problems)
		warnings.push(...found.warnings)
	}

	return { templates, problems, warnings, directories }
}

/** Reads one `element-templates` directory, in a stable filename order. */
async function readTemplateDirectory(templateDir: string): Promise<{
	templates: ElementTemplate[]
	problems: DiscoveryProblem[]
	warnings: DiscoveryProblem[]
}> {
	const templates: ElementTemplate[] = []
	const problems: DiscoveryProblem[] = []
	const warnings: DiscoveryProblem[] = []

	const entries = await readdir(templateDir, { withFileTypes: true })
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
		.map((entry) => entry.name)
		.sort()

	for (const name of files) {
		const file = join(templateDir, name)
		let parsed: unknown
		try {
			parsed = JSON.parse(await readFile(file, "utf-8"))
		} catch (err) {
			problems.push({
				file,
				path: "",
				message: `not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
			})
			continue
		}

		const result = readTemplateDocument(parsed)
		templates.push(...result.templates)
		for (const problem of result.problems) problems.push({ ...problem, file })
		for (const warning of result.warnings) warnings.push({ ...warning, file })
	}

	return { templates, problems, warnings }
}

/** Directories never worth descending into when scanning a project. */
const SKIP_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "out", "coverage"])

/**
 * Reads every element template a project holds, wherever it sits.
 *
 * The sibling of {@link discoverElementTemplates}, and the opposite walk. That
 * one answers "which templates apply to this diagram" by climbing from a file
 * to the root; this one answers "is everything in this project valid" by
 * descending from the root, which is the question a CI check asks. A project
 * with templates beside a sub-folder's diagrams would otherwise pass a check
 * that only ever looked at the root.
 *
 * The walk is breadth-first, so templates arrive shallowest-first and a deeper
 * directory's version of an id registers last and wins. That is a reasonable
 * merge for a host keeping one registry for a whole project, but it is not the
 * same thing as per-file resolution: which template a *particular* diagram
 * should see is {@link discoverElementTemplates}, and only that walk knows.
 *
 * @param options - `root` to scan, and the config folder name to look for.
 */
export async function collectElementTemplates(options: {
	root: string
	configFolder?: string
}): Promise<DiscoveryResult> {
	const { root, configFolder = DEFAULT_CONFIG_FOLDER } = options
	const templates: ElementTemplate[] = []
	const problems: DiscoveryProblem[] = []
	const warnings: DiscoveryProblem[] = []
	const directories: string[] = []

	const queue: string[] = [resolve(root)]
	while (queue.length > 0) {
		const dir = queue.shift()
		if (dir === undefined) continue

		let entries: Dirent[]
		try {
			entries = await readdir(dir, { withFileTypes: true })
		} catch {
			continue
		}

		for (const entry of entries) {
			if (!entry.isDirectory() || SKIP_DIRECTORIES.has(entry.name)) continue
			queue.push(join(dir, entry.name))
		}

		const templateDir = join(dir, configFolder, TEMPLATES_SUBFOLDER)
		if (!(await isDirectory(templateDir))) continue
		directories.push(templateDir)
		const found = await readTemplateDirectory(templateDir)
		templates.push(...found.templates)
		problems.push(...found.problems)
		warnings.push(...found.warnings)
	}

	directories.sort()
	return { templates, problems, warnings, directories }
}
