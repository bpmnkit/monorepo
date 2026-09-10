/**
 * `@bpmnkit/connectors/node` — the filesystem half of element templates.
 *
 * Kept behind its own entry point so the main package stays importable in a
 * browser: a studio or a viewer takes templates from its host and never reaches
 * for `node:fs`.
 *
 * @packageDocumentation
 */

export {
	collectElementTemplates,
	discoverElementTemplates,
	DEFAULT_CONFIG_FOLDER,
	TEMPLATES_SUBFOLDER,
} from "./discover.js"
export type { DiscoverOptions, DiscoveryProblem, DiscoveryResult } from "./discover.js"
