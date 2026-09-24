import { type RenderOptions, isBpmnLang, parseFenceInfo, renderBpmnBlock } from "./render.js"

export interface PrerenderOptions extends Omit<RenderOptions, "onError" | "link"> {
	/**
	 * Directory new SVG files go in, relative to the Markdown file. Default: `"diagrams"`.
	 * A fence attribute `file=path/to.svg` picks a block's path itself.
	 */
	outDir?: string
}

export interface PrerenderResult {
	/** The Markdown with every BPMN block wrapped in a pre-rendered region. */
	markdown: string
	/** The SVG files the regions reference, with paths relative to the Markdown file. */
	files: Array<{ path: string; svg: string }>
}

const BEGIN = /^<!-- bpmnkit-md:begin (\S+) -->$/
const END = "<!-- bpmnkit-md:end -->"
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/

/**
 * Pre-renders the BPMN blocks of a Markdown document to SVG files, for renderers
 * that run no plugins — GitHub READMEs above all.
 *
 * Each ` ```bpmn ` / ` ```bpmn-compact ` / ` ```bpmn-json ` block becomes a region
 * between `<!-- bpmnkit-md:begin <svg path> -->` and `<!-- bpmnkit-md:end -->`: an
 * image of the diagram, then the source block, folded into a `<details>`. Running it
 * again re-renders each region from the source it holds, so it is idempotent and
 * the source stays the thing to edit. Only top-level fences (indented at most three
 * spaces) are recognised; fences inside other fences are left alone.
 *
 * Invalid blocks throw — a committed image of an error box helps no one.
 */
export function prerenderMarkdown(
	markdown: string,
	options: PrerenderOptions = {},
): PrerenderResult {
	const { outDir = "diagrams", ...renderOptions } = options
	const lines = markdown.split("\n")
	const out: string[] = []
	const files: PrerenderResult["files"] = []
	const used = new Set<string>()
	for (const line of lines) {
		const path = BEGIN.exec(line)?.[1]
		if (path) used.add(path)
	}

	const emit = (fence: string[], startLine: number, fixedPath: string | undefined): void => {
		const { lang, attrs } = parseFenceInfo(FENCE_OPEN.exec(fence[0] ?? "")?.[3] ?? "")
		if (!isBpmnLang(lang)) return
		const indent = FENCE_OPEN.exec(fence[0] ?? "")?.[1]?.length ?? 0
		const body = fence
			.slice(1, isClosed(fence) ? -1 : undefined)
			.map((l) => l.replace(new RegExp(`^ {0,${indent}}`), ""))
			.join("\n")
		let result: ReturnType<typeof renderBpmnBlock>
		try {
			result = renderBpmnBlock(body, lang, {
				...renderOptions,
				...(attrs.title ? { title: attrs.title } : {}),
				onError: "throw",
			})
		} catch (err) {
			throw new Error(`line ${startLine}: ${err instanceof Error ? err.message : String(err)}`, {
				cause: err,
			})
		}
		if (!result.ok) return
		const path = fixedPath ?? uniquePath(attrs.file ?? `${outDir}/${slug(result.title)}.svg`, used)
		files.push({ path, svg: `${result.svg}\n` })
		out.push(
			`<!-- bpmnkit-md:begin ${path} -->`,
			`![${result.title.replace(/[[\]\\]/g, "\\$&")}](${path})`,
			"",
			"<details>",
			"<summary>BPMN source</summary>",
			"",
			...fence,
			"",
			"</details>",
			END,
		)
	}

	let i = 0
	while (i < lines.length) {
		const line = lines[i] ?? ""
		const regionPath = BEGIN.exec(line)?.[1]
		if (regionPath) {
			const end = lines.indexOf(END, i + 1)
			if (end === -1) throw new Error(`line ${i + 1}: bpmnkit-md:begin has no matching end marker`)
			const start = lines.findIndex((l, n) => n > i && n < end && isBpmnFence(l))
			if (start === -1) throw new Error(`line ${i + 1}: bpmnkit-md region holds no BPMN block`)
			emit(lines.slice(start, fenceEnd(lines, start) + 1), start + 1, regionPath)
			i = end + 1
			continue
		}
		if (FENCE_OPEN.test(line)) {
			const end = fenceEnd(lines, i)
			const fence = lines.slice(i, end + 1)
			if (isBpmnFence(line)) emit(fence, i + 1, undefined)
			else out.push(...fence)
			i = end + 1
			continue
		}
		out.push(line)
		i++
	}
	return { markdown: out.join("\n"), files }
}

function isBpmnFence(line: string): boolean {
	const info = FENCE_OPEN.exec(line)?.[3]
	return info !== undefined && isBpmnLang(parseFenceInfo(info).lang)
}

/** Index of the closing fence line, or the last line when the fence is never closed. */
function fenceEnd(lines: string[], start: number): number {
	const marker = FENCE_OPEN.exec(lines[start] ?? "")?.[2] ?? "```"
	const close = new RegExp(`^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`)
	for (let n = start + 1; n < lines.length; n++) {
		if (close.test(lines[n] ?? "")) return n
	}
	return lines.length - 1
}

function isClosed(fence: string[]): boolean {
	return fence.length > 1 && /^ {0,3}(`{3,}|~{3,})\s*$/.test(fence[fence.length - 1] ?? "")
}

function slug(title: string): string {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "diagram"
	)
}

function uniquePath(path: string, used: Set<string>): string {
	let candidate = path
	for (let n = 2; used.has(candidate); n++) candidate = path.replace(/(\.svg)?$/, `-${n}$1`)
	used.add(candidate)
	return candidate
}
