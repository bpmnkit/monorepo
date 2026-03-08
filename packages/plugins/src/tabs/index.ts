/**
 * @bpmn-sdk/canvas-plugin-tabs — multi-tab view management for BpmnCanvas/BpmnEditor.
 *
 * Adds a tab bar overlay to the canvas container. Each tab can hold a BPMN,
 * DMN, or Form view. Includes a `FileResolver` abstraction for pluggable
 * reference resolution (in-memory by default; extensible to FS, SaaS DB, etc.).
 *
 * @packageDocumentation
 */

export { createTabsPlugin } from "./tabs-plugin.js";
export type {
	TabConfig,
	TabsPluginOptions,
	TabsApi,
	WelcomeExample,
	WelcomeSection,
	WelcomeSectionItem,
	WelcomeRecentItem,
	TabContentSnapshot,
} from "./tabs-plugin.js";
export { InMemoryFileResolver } from "./file-resolver.js";
export type { FileResolver, ResolvedFile } from "./file-resolver.js";
export { TABS_CSS, injectTabsStyles } from "./css.js";
