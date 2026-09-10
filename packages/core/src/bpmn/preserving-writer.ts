/**
 * Writing a model back over the file it came from, changing as little as
 * possible.
 *
 * {@link serializeBpmn} writes a model the way this toolkit writes models. That
 * is the right output for a new document and the wrong one for an existing
 * file: the first visual edit reformats every line, and the commit says "the
 * whole diagram" when it means "a box moved". These write the file that was
 * already there, and change only what the model changed.
 *
 * ## Why order needs deciding, and why it is checked
 *
 * The model cannot represent the order a file writes its children in — a
 * process holds `flowElements` and `sequenceFlows` as separate lists, a plane
 * holds `shapes` and `edges` — so every serialization emits its own order, and
 * a file written by another tool comes back reshuffled even when nothing
 * changed. Keeping the original order is therefore worth more than keeping the
 * indentation. The same goes for an attribute set to its schema default:
 * `isExecutable="false"` disappears from a file that said it out loud.
 *
 * Neither is safe to assume in general, so neither is assumed. Each strategy is
 * tried, the result is **parsed back and compared against a plain write**, and
 * the first that reads the same is the one used. The plain write is the floor,
 * so calling this is never worse than not.
 *
 * @packageDocumentation
 */

import { type VerifiedPreserve, preserveFormattingVerified } from "../xml/xml-patch.js"
import type { BpmnDefinitions } from "./bpmn-model.js"
import { parseBpmn } from "./bpmn-parser.js"
import { serializeBpmn } from "./bpmn-serializer.js"

export type { VerifiedPreserve as PreservingWriteResult }

/**
 * Rewrites a document to say what a freshly serialized one says, keeping the
 * original's formatting wherever a BPMN reader cannot tell the difference.
 *
 * Takes both sides as text, for a caller holding a serialized document rather
 * than a model — an editor's `exportXml()`, say.
 *
 * @param original - The file's current contents.
 * @param updated - The document as the serializer would write it now.
 */
export function preserveBpmnFormatting(original: string, updated: string): VerifiedPreserve {
	return preserveFormattingVerified(original, updated, parseBpmn)
}

/**
 * Serializes a model over the document it came from, and reports what it
 * managed to keep.
 *
 * @param original - The file's current contents.
 * @param definitions - The model to write.
 */
export function exportPreservingResult(
	original: string,
	definitions: BpmnDefinitions,
): VerifiedPreserve {
	return preserveBpmnFormatting(original, serializeBpmn(definitions))
}

/**
 * Serializes a model over the document it came from.
 *
 * @param original - The file's current contents.
 * @param definitions - The model to write.
 *
 * @example
 * ```typescript
 * const onDisk = await readFile("order.bpmn", "utf8");
 * await writeFile("order.bpmn", exportPreserving(onDisk, edited));
 * // Renaming one task changes one line, not the whole file.
 * ```
 */
export function exportPreserving(original: string, definitions: BpmnDefinitions): string {
	return exportPreservingResult(original, definitions).xml
}
