/**
 * Watching a project for changes, one directory watcher per directory.
 *
 * `fs.watch(root, { recursive: true })` is not used on purpose. On Linux, Node
 * implements it by watching every *file*, and a file watcher follows the inode:
 * once a file is replaced by a rename — how most editors save, and how this
 * server saves — that file is never reported again. A directory watcher sees
 * the rename itself, so it keeps reporting the path whatever happens to the
 * file behind it.
 */

import { type FSWatcher, watch } from "node:fs"
import { readdir, stat } from "node:fs/promises"
import { join, relative, sep } from "node:path"

export interface TreeWatcher {
	close(): void
}

/**
 * Reports every changed path under `root`, relative and with `/` separators.
 *
 * @param root - The directory to watch.
 * @param skipDir - Directory names not to descend into.
 * @param onChange - Called with a project-relative path; may fire more than
 *   once per change, so callers debounce.
 */
export async function watchTree(
	root: string,
	skipDir: (name: string) => boolean,
	onChange: (path: string) => void,
): Promise<TreeWatcher> {
	const watchers = new Map<string, FSWatcher>()
	let closed = false

	const toRelative = (full: string) => relative(root, full).split(sep).join("/")

	function unwatch(dir: string): void {
		for (const [watched, watcher] of watchers) {
			if (watched === dir || watched.startsWith(`${dir}${sep}`)) {
				watcher.close()
				watchers.delete(watched)
			}
		}
	}

	/** Watches `dir` and everything below it; with `announce`, reports the files found. */
	async function add(dir: string, announce: boolean): Promise<void> {
		if (closed || watchers.has(dir)) return
		let watcher: FSWatcher
		try {
			watcher = watch(dir, (_event, name) => {
				if (name !== null) void changed(join(dir, name.toString()))
			})
		} catch {
			return // Gone already, or unreadable: nothing to watch.
		}
		watcher.on("error", () => unwatch(dir))
		watchers.set(dir, watcher)

		const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
		for (const entry of entries) {
			if (entry.name.startsWith(".")) continue
			const full = join(dir, entry.name)
			if (entry.isDirectory()) {
				if (!skipDir(entry.name)) await add(full, announce)
			} else if (announce && entry.isFile()) {
				onChange(toRelative(full))
			}
		}
	}

	async function changed(full: string): Promise<void> {
		const rel = toRelative(full)
		if (rel.split("/").some((segment) => segment.startsWith("."))) return
		const info = await stat(full).catch(() => null)
		if (info?.isDirectory()) {
			// A directory created or moved in: watch it, and report what it brought.
			const name = rel.split("/").pop() ?? ""
			if (!skipDir(name)) await add(full, true)
			return
		}
		if (info === null) unwatch(full)
		onChange(rel)
	}

	await add(root, false)
	return {
		close() {
			closed = true
			for (const watcher of watchers.values()) watcher.close()
			watchers.clear()
		},
	}
}
