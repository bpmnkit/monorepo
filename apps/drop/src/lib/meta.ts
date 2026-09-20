import type { BpmnDefinitions, DmnDefinitions, FormDefinition } from "@bpmnkit/core"
import type { FileKind } from "../shared/constants.js"
import { type FeelDocument, type FeelMode, feelLabel } from "../shared/feel-doc.js"

/** A successfully parsed artifact, tagged by kind. */
export type ParsedModel =
	| { kind: "bpmn"; model: BpmnDefinitions }
	| { kind: "dmn"; model: DmnDefinitions }
	| { kind: "form"; model: FormDefinition }
	| { kind: "feel"; model: FeelDocument }

/** Queryable metadata derived from a parsed model (stored as JSON on the file row). */
export interface FileMeta {
	/** Flow-node count (BPMN). */
	elements?: number
	/** Process count (BPMN). */
	processes?: number
	/** Decision count (DMN). */
	decisions?: number
	/** Decision ids (DMN) — used to resolve cross-file businessRuleTask links. */
	decisionIds?: string[]
	/** Component count (Form). */
	components?: number
	/** Context-variable count (FEEL). */
	variables?: number
	/** How the expression is read (FEEL). */
	feelMode?: FeelMode
	/** Exporter / execution platform, when the file declares one. */
	platform?: string
}

/** Extract a display name and queryable metadata from a parsed model. */
export function extractMeta(parsed: ParsedModel): { name: string | null; meta: FileMeta } {
	switch (parsed.kind) {
		case "bpmn": {
			const m = parsed.model
			const proc = m.processes[0]
			const elements = m.processes.reduce((n, p) => n + p.flowElements.length, 0)
			return {
				name: proc?.name ?? proc?.id ?? m.id ?? null,
				meta: { processes: m.processes.length, elements, platform: m.exporter },
			}
		}
		case "dmn": {
			const m = parsed.model
			const first = m.decisions[0]
			return {
				name: m.name || first?.name || first?.id || null,
				meta: {
					decisions: m.decisions.length,
					decisionIds: m.decisions.map((d) => d.id),
					platform: m.exporter,
				},
			}
		}
		case "form": {
			const m = parsed.model
			return {
				name: m.id ?? null,
				meta: { components: m.components.length, platform: m.executionPlatform },
			}
		}
		case "feel": {
			const m = parsed.model
			return {
				name: feelLabel(m),
				meta: { variables: Object.keys(m.context).length, feelMode: m.mode },
			}
		}
	}
}
