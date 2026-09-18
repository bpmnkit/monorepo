/**
 * The packages this repo publishes to npm, as workspace-relative directories.
 *
 * One list, because three scripts need it and a package missing from one of
 * them is exactly the drift they exist to catch: a package with no LICENSE, no
 * generated README, or one that never gets its tarball opened.
 *
 * Adding a package here is step one; see the "Adding a New Package" section of
 * CLAUDE.md for the rest.
 */
export const PUBLISHED = [
	"packages/core",
	"packages/canvas",
	"packages/editor",
	"packages/ui",
	"packages/plugins",
	"packages/engine",
	"packages/feel",
	"packages/api",
	"packages/ascii",
	"packages/docspack",
	"packages/profiles",
	"packages/operate",
	"packages/astro-shared",
	"packages/connector-gen",
	"packages/connectors",
	"packages/patterns",
	"packages/worker-client",
	"packages/user-tasks",
	"packages/cli-sdk",
	"packages/create-casen-plugin",
	"apps/cli",
	"apps/proxy",
	"apps/reebe-wasm",
	"plugins-cli/casen-report",
	"plugins-cli/casen-worker-http",
	"plugins-cli/casen-worker-ai",
]

/**
 * The packages that carry the 1.0 stability promise.
 *
 * https://bpmnkit.com/docs/getting-started/stability is the contract; this is
 * the membership. A package belongs here when all three conditions that page
 * sets are true of it:
 *
 *   1. a test suite that would catch its own breakage,
 *   2. a documentation page on bpmnkit.com,
 *   3. an API worth defending for a year.
 *
 * Only the first two can be checked by a script, and `check-packages.mjs` does,
 * in both directions: nothing here may lack tests or a page, and nothing at
 * 1.0.0 or above may be missing from this list. The third is a judgement, and
 * the reasoning for each call is in `doc/release-1.0.0.md`.
 *
 * Joining later costs nothing — a package going 0.x → 1.0 breaks no one — so
 * the bar is applied strictly rather than generously. Fourteen published
 * packages are deliberately not here.
 */
export const STABLE = [
	"packages/core",
	"packages/canvas",
	"packages/editor",
	"packages/plugins",
	"packages/engine",
	"packages/feel",
	"packages/api",
	"packages/ascii",
	"packages/docspack",
	"packages/connector-gen",
	"packages/connectors",
	"apps/cli",
]
