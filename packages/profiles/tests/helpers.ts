import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/** The OS the module under test sees: `platform()` and `homedir()` read from it. */
export interface FakeOs {
	platform: NodeJS.Platform
	home: string
}

const ENV_KEYS = ["XDG_CONFIG_HOME", "APPDATA"] as const

/**
 * Points the fake OS at a fresh temp dir and clears the config environment
 * variables, so nothing reads or writes the real home. Returns a teardown.
 */
export function useTempHome(fakeOs: FakeOs): { dir: string; restore(): void } {
	const dir = mkdtempSync(join(tmpdir(), "bpmnkit-profiles-"))
	fakeOs.platform = "linux"
	fakeOs.home = join(dir, "home")
	const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
	for (const k of ENV_KEYS) delete process.env[k]
	return {
		dir,
		restore() {
			for (const k of ENV_KEYS) {
				const v = saved[k]
				if (v === undefined) delete process.env[k]
				else process.env[k] = v
			}
			rmSync(dir, { recursive: true, force: true })
		},
	}
}
