import { readFileSync, watch } from "node:fs"
import { basename } from "node:path"
import { Bpmn } from "@bpmnkit/core"

/**
 * Reports the MCP server's output file every time it changes.
 *
 * The MCP server rewrites that file on each mutating tool call, so a diagram
 * built over several calls is already complete on disk long before the adapter
 * stops streaming. Reporting each write turns the diagram into something the
 * user watches being drawn rather than a result they wait for.
 *
 * Previews are advisory: the authoritative XML is still read once the stream
 * ends. That is what lets this drop a frame instead of repairing it — a read
 * that lands mid-write parses as nothing, and the next write carries the whole
 * file.
 *
 * Watches the directory, not the file: the MCP server only creates the file on
 * the first tool call, and `watch` on a path that does not exist yet throws.
 *
 * @param dir - Directory holding the output file.
 * @param file - Absolute path of the output file.
 * @param onWrite - Called with each complete, changed BPMN XML written.
 * @returns A function that stops watching.
 */
export function watchOutputFile(
	dir: string,
	file: string,
	onWrite: (xml: string) => void,
): () => void {
	const name = basename(file)
	let last = ""
	const watcher = watch(dir, (_event, changed) => {
		// `changed` is null on platforms that do not report the filename; there is
		// nothing to filter on then, so fall through and let the read decide.
		if (changed !== null && changed !== name) return
		let xml: string
		try {
			xml = readFileSync(file, "utf8")
		} catch {
			return // not written yet, or removed since the event
		}
		if (xml === "" || xml === last) return
		try {
			Bpmn.parse(xml)
		} catch {
			return // caught mid-write
		}
		last = xml
		onWrite(xml)
	})
	return () => watcher.close()
}
