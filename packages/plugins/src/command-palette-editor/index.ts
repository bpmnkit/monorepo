/**
 * @bpmn-sdk/canvas-plugin-command-palette-editor — editor extension for the
 * command palette plugin. Adds one command per BPMN element type.
 *
 * Must be used together with `@bpmn-sdk/canvas-plugin-command-palette`.
 *
 * ## Usage
 * ```typescript
 * import { createCommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";
 * import { createCommandPaletteEditorPlugin } from "@bpmn-sdk/canvas-plugin-command-palette-editor";
 *
 * let editorRef: BpmnEditor | null = null;
 * const palette = createCommandPalettePlugin({ ... });
 * const paletteEditor = createCommandPaletteEditorPlugin(palette, (tool) => {
 *   editorRef?.setTool(tool);
 * });
 * const editor = new BpmnEditor({ container, xml, plugins: [palette, paletteEditor] });
 * editorRef = editor;
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin } from "@bpmn-sdk/canvas"
import { ELEMENT_GROUPS, ELEMENT_TYPE_LABELS } from "@bpmn-sdk/editor"
import type { CommandPalettePlugin } from "../command-palette/index.js"

// ── Element catalogue ─────────────────────────────────────────────────────────

const ELEMENT_COMMANDS = ELEMENT_GROUPS.flatMap((group) =>
	group.types.map((type) => ({
		type,
		title: `Add ${ELEMENT_TYPE_LABELS[type]}`,
		description: group.title,
	})),
)

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates the editor command palette extension plugin.
 *
 * @param palette - The base command palette plugin returned by
 *   `createCommandPalettePlugin`. Commands are registered into it.
 * @param setTool - Callback that activates an element creation tool on the
 *   editor (e.g. `editor.setTool`). May reference the editor lazily — it is
 *   only called when the user executes a command, well after construction.
 */
export function createCommandPaletteEditorPlugin(
	palette: CommandPalettePlugin,
	setTool: (tool: string) => void,
): CanvasPlugin {
	let _deregister: (() => void) | null = null

	return {
		name: "command-palette-editor",

		install(_api) {
			_deregister = palette.addCommands(
				ELEMENT_COMMANDS.map((cmd) => ({
					id: `create:${cmd.type}`,
					title: cmd.title,
					description: cmd.description,
					action() {
						setTool(`create:${cmd.type}`)
					},
				})),
			)
		},

		uninstall() {
			_deregister?.()
			_deregister = null
		},
	}
}
