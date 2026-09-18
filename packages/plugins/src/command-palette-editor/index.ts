/**
 * @bpmnkit/plugins/command-palette-editor — editor extension for the
 * command palette plugin. Adds one command per BPMN element type. When
 * executed, shows a second-step picker listing candidate source nodes to
 * connect after. Falls back to `setTool` (free-click placement) when the
 * diagram is empty.
 *
 * Must be used together with `@bpmnkit/plugins/command-palette`.
 *
 * ## Usage
 * ```typescript
 * import { createCommandPalettePlugin } from "@bpmnkit/plugins/command-palette";
 * import { createCommandPaletteEditorPlugin } from "@bpmnkit/plugins/command-palette-editor";
 *
 * let editorRef: BpmnEditor | null = null;
 * const palette = createCommandPalettePlugin({ ... });
 * const paletteEditor = createCommandPaletteEditorPlugin(palette, () => editorRef);
 * const editor = new BpmnEditor({ container, xml, plugins: [palette, paletteEditor] });
 * editorRef = editor;
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { ELEMENT_GROUPS, ELEMENT_TYPE_LABELS } from "@bpmnkit/editor"
import type { CreateShapeType } from "@bpmnkit/editor"
import type { CommandPalettePlugin } from "../command-palette/index.js"

// ── Minimal editor interface ──────────────────────────────────────────────────

/** Subset of BpmnEditor needed by this plugin. */
export interface EditorLike {
	setTool(tool: string): void
	addConnectedElement(sourceId: string, type: CreateShapeType, name?: string): string | null
}

// ── Element catalogue ─────────────────────────────────────────────────────────

const ELEMENT_COMMANDS = ELEMENT_GROUPS.flatMap((group) =>
	group.types.map((type) => ({
		type,
		title: `Add ${ELEMENT_TYPE_LABELS[type]}`,
		description: group.title,
	})),
)

// BPMN element types that cannot have outgoing sequence flows
const NO_OUTGOING_TYPES = new Set([
	"endEvent",
	"messageEndEvent",
	"escalationEndEvent",
	"errorEndEvent",
	"compensationEndEvent",
	"signalEndEvent",
	"terminateEndEvent",
	"textAnnotation",
])

// Only gateways may have more than one outgoing sequence flow.
// Every other connectable element is limited to one outgoing flow.
const MULTI_OUTGOING_TYPES = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

// ── Candidate helpers ─────────────────────────────────────────────────────────

function getCandidates(api: CanvasApi) {
	return api
		.getShapes()
		.filter((s) => {
			const el = s.flowElement
			if (el == null) return false
			if (NO_OUTGOING_TYPES.has(el.type)) return false
			// Non-gateway elements can only have one outgoing flow
			if (!MULTI_OUTGOING_TYPES.has(el.type) && el.outgoing.length >= 1) return false
			return true
		})
		.sort((a, b) => {
			// Prefer leaf nodes (no outgoing) — most natural append targets
			const aOut = a.flowElement?.outgoing.length ?? 0
			const bOut = b.flowElement?.outgoing.length ?? 0
			return aOut - bOut
		})
}

function candidateLabel(s: ReturnType<CanvasApi["getShapes"]>[number]): string {
	const el = s.flowElement
	if (!el) return s.id
	const typeLabel = ELEMENT_TYPE_LABELS[el.type as CreateShapeType] ?? el.type
	return el.name ? el.name : typeLabel
}

function candidateDescription(s: ReturnType<CanvasApi["getShapes"]>[number]): string | undefined {
	const el = s.flowElement
	if (!el) return undefined
	const typeLabel = ELEMENT_TYPE_LABELS[el.type as CreateShapeType] ?? el.type
	const out = el.outgoing.length
	if (el.name) {
		return out > 0 ? `${typeLabel} · ${out} outgoing` : typeLabel
	}
	return out > 0 ? `${out} outgoing` : undefined
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates the editor command palette extension plugin.
 *
 * @param palette  The base command palette plugin.
 * @param getEditor  Lazy getter returning the editor instance (or null before
 *   it is created). Called only when the user executes a command.
 */
export function createCommandPaletteEditorPlugin(
	palette: CommandPalettePlugin,
	getEditor: () => EditorLike | null,
): CanvasPlugin {
	let _api: CanvasApi | null = null
	let _deregister: (() => void) | null = null

	return {
		name: "command-palette-editor",

		install(api) {
			_api = api
			_deregister = palette.addCommands(
				ELEMENT_COMMANDS.map((cmd) => ({
					id: `create:${cmd.type}`,
					title: cmd.title,
					description: cmd.description,
					action() {
						const candidates = _api ? getCandidates(_api) : []

						if (candidates.length === 0) {
							// Empty diagram — fall back to tool mode so the user can
							// click anywhere to place the element.
							getEditor()?.setTool(`create:${cmd.type}`)
							return
						}

						// Step 2: pick a connection target.
						palette.pushView(
							candidates.map((s) => ({
								id: `connect:${s.id}:${cmd.type}`,
								title: candidateLabel(s),
								description: candidateDescription(s),
								action() {
									// Step 3: enter a label, then insert.
									const typeLabel = ELEMENT_TYPE_LABELS[cmd.type] ?? cmd.type
									palette.pushView([], {
										placeholder: `Label for new ${typeLabel} (optional)\u2026`,
										onConfirm(label: string) {
											getEditor()?.addConnectedElement(s.id, cmd.type, label.trim() || undefined)
										},
									})
								},
							})),
							{ placeholder: "Connect after which element?" },
						)
					},
				})),
			)
		},

		uninstall() {
			_deregister?.()
			_deregister = null
			_api = null
		},
	}
}
