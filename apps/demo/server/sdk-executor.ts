import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Writes TS code to a temp file, executes it with tsx from the monorepo root
 * (so @bpmnkit/core resolves), captures stdout as the BPMN XML.
 *
 * The temp file must live under apps/demo/ (not os.tmpdir()) because Node's
 * ESM bare-specifier resolution walks up from the file's own path, not cwd —
 * a file outside the workspace can never resolve @bpmnkit/core.
 */
export async function executeSdkCode(tsCode: string, repoRoot: string): Promise<string> {
	const tmpRoot = join(repoRoot, "apps/demo/tmp")
	mkdirSync(tmpRoot, { recursive: true })
	const dir = mkdtempSync(join(tmpRoot, "bpmnkit-demo-"))
	const file = join(dir, `${randomUUID()}.ts`)

	try {
		writeFileSync(file, tsCode, "utf-8")

		const result = spawnSync("tsx", [file], {
			cwd: repoRoot,
			encoding: "utf-8",
			timeout: 30_000,
		})

		if (result.error) throw new Error(`tsx spawn failed: ${result.error.message}`)
		if (result.status !== 0) {
			throw new Error(`tsx exited with code ${result.status}: ${result.stderr}`)
		}

		const xml = result.stdout.trim()
		if (!xml) throw new Error("tsx produced no output — code must write to stdout")

		return xml
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}
