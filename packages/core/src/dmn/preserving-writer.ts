/**
 * The BPMN preserving writer's counterpart for decision documents.
 *
 * Same problem, same shape, one difference worth naming: **DMN rule order is
 * meaning**, not layout. A table with hit policy `FIRST` returns the first rule
 * that matches, so moving a rule up changes what the decision decides. The
 * strategy that keeps the file's own sibling order would quietly undo exactly
 * that edit — which is why every strategy is checked against a plain write
 * before it is used, and why this is a wrapper over the same verified ladder
 * rather than a second implementation of it.
 *
 * @packageDocumentation
 */

import { type VerifiedPreserve, preserveFormattingVerified } from "../xml/xml-patch.js"
import type { DmnDefinitions } from "./dmn-model.js"
import { parseDmn } from "./dmn-parser.js"
import { serializeDmn } from "./dmn-serializer.js"

/**
 * Rewrites a decision document to say what a freshly serialized one says,
 * keeping the original's formatting wherever a DMN reader cannot tell.
 *
 * @param original - The file's current contents.
 * @param updated - The document as the serializer would write it now.
 */
export function preserveDmnFormatting(original: string, updated: string): VerifiedPreserve {
	return preserveFormattingVerified(original, updated, parseDmn)
}

/**
 * Serializes a decision model over the document it came from.
 *
 * @param original - The file's current contents.
 * @param definitions - The model to write.
 */
export function exportDmnPreserving(original: string, definitions: DmnDefinitions): string {
	return preserveDmnFormatting(original, serializeDmn(definitions)).xml
}
