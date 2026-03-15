/**
 * @bpmnkit/canvas-plugin-config-panel — schema-driven element config panel for
 * `@bpmnkit/editor`.
 *
 * Provides a compact right-rail panel and a full 65%-overlay editor for
 * configuring BPMN element properties. Schemas and adapters are registered by
 * companion plugins (e.g. `@bpmnkit/canvas-plugin-config-panel-bpmn`).
 *
 * ## Usage
 * ```typescript
 * import { createConfigPanelPlugin } from "@bpmnkit/canvas-plugin-config-panel";
 *
 * let editorRef: BpmnEditor | null = null;
 * const configPanel = createConfigPanelPlugin({
 *   getDefinitions: () => editorRef?.getDefinitions() ?? null,
 *   applyChange: (fn) => { editorRef?.applyChange(fn); },
 * });
 * const editor = new BpmnEditor({ container, xml, plugins: [configPanel] });
 * editorRef = editor;
 * ```
 *
 * @packageDocumentation
 */

import type { BpmnDefinitions } from "@bpmnkit/core"
import { injectConfigPanelStyles } from "./css.js"
import { ConfigPanelRenderer } from "./renderer.js"
import type { ConfigPanelOptions, ConfigPanelPlugin, PanelAdapter, PanelSchema } from "./types.js"

export type {
	ConfigPanelOptions,
	ConfigPanelPlugin,
	FieldSchema,
	FieldType,
	FieldValue,
	GroupSchema,
	PanelAdapter,
	PanelSchema,
	SelectOption,
} from "./types.js"

export { CONFIG_PANEL_CSS, CONFIG_PANEL_STYLE_ID, injectConfigPanelStyles } from "./css.js"

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates the config panel plugin.
 *
 * @param options.getDefinitions - Returns the current BpmnDefinitions (may be
 *   null before the editor is initialized). Called lazily when the panel opens.
 * @param options.applyChange - Applies a pure transformation to the diagram.
 *   May reference the editor lazily via a captured reference.
 */
export function createConfigPanelPlugin(options: ConfigPanelOptions): ConfigPanelPlugin {
	const { getDefinitions, applyChange } = options

	// Shared schema registry — populated before or after install via registerSchema
	const _schemas = new Map<string, { schema: PanelSchema; adapter: PanelAdapter }>()
	let _renderer: ConfigPanelRenderer | null = null
	const _unsubs: Array<() => void> = []

	return {
		name: "config-panel",

		install(api) {
			injectConfigPanelStyles()
			_renderer = new ConfigPanelRenderer(
				_schemas,
				getDefinitions,
				applyChange,
				() => api.viewportEl,
				() => api.getShapes(),
				{
					container: options.container,
					onPanelShow: options.onPanelShow,
					onPanelHide: options.onPanelHide,
					openInPlayground: options.openInPlayground,
					readonly: options.readonly,
				},
			)

			// BpmnEditor routes EditorEvents through api.on at runtime.
			// TypeScript only knows CanvasEvents here, so we cast for editor events.
			type EvtFn = (event: string, handler: (...args: unknown[]) => void) => () => void
			const anyOn = api.on.bind(api) as unknown as EvtFn

			_unsubs.push(
				anyOn("editor:select", (rawIds) => {
					_renderer?.onSelect(rawIds as string[], api.getShapes(), api.getEdges())
				}),
			)
			_unsubs.push(
				anyOn("diagram:change", (rawDefs) => {
					_renderer?.onDiagramChange(rawDefs as BpmnDefinitions)
				}),
			)
		},

		uninstall() {
			for (const unsub of _unsubs) unsub()
			_unsubs.length = 0
			_renderer?.destroy()
			_renderer = null
		},

		registerSchema(elementType: string, schema: PanelSchema, adapter: PanelAdapter): void {
			_schemas.set(elementType, { schema, adapter })
		},
	}
}
