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
	"apps/cli",
	"apps/proxy",
	"apps/reebe-wasm",
	"plugins-cli/casen-report",
	"plugins-cli/casen-worker-http",
	"plugins-cli/casen-worker-ai",
]
