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
	"packages/camunda-docspack",
	"packages/profiles",
	"packages/operate",
	"packages/astro-shared",
	"packages/connector-gen",
	"packages/connectors",
	"packages/patterns",
	"packages/worker-client",
	"packages/user-tasks",
	"apps/cli",
	"packages/cli-sdk",
	"packages/create-casen-plugin",
	"apps/proxy",
	"apps/reebe-wasm",
	"plugins-cli/casen-report",
	"plugins-cli/casen-worker-http",
	"plugins-cli/casen-worker-ai",
]

/**
 * Published packages whose licence is not the repo's MIT, and the licence they carry instead.
 *
 * `@bpmnkit/camunda-docspack` carries documentation that belongs to Camunda Services GmbH, not
 * to BPMN Kit, published by them under CC BY-SA 3.0. Chunking that prose and rendering its
 * embedded diagrams as text make the package an Adaptation under §1 of that licence, and
 * ShareAlike then requires the result to carry the same terms — so it cannot be relicensed
 * MIT, and `sync-license.mjs` must not copy the root LICENCE over the one it ships.
 *
 * Keep this empty unless a package genuinely cannot be MIT. It is an exception, not an option.
 */
export const LICENSE_OVERRIDES = {
	"packages/camunda-docspack": "CC-BY-SA-3.0",
}
