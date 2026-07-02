import { Bpmn, expand } from "@bpmnkit/core"
import { parseCompactDsl } from "./compact-dsl.js"

/**
 * Decodes compact notation DSL text into valid BPMN 2.0 XML, entirely
 * in-process (no subprocess, no temp files) via the SDK's own expand()
 * and Bpmn.export(). Throws if the DSL is malformed.
 */
export function executeCompactDsl(dslText: string): string {
	const compact = parseCompactDsl(dslText)
	const definitions = expand(compact)
	return Bpmn.export(definitions)
}
