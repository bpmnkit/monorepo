/**
 * Writing a form back over the file it came from, changing as little as
 * possible.
 *
 * The BPMN and DMN writers' counterpart, and the simpler of the two because a
 * form is JSON. There is no schema question to get wrong: object key order is
 * not information and array order always is, both by RFC 8259, so
 * {@link preserveJsonFormatting} checks itself and this needs to supply
 * nothing.
 *
 * What it buys is larger than it sounds. `exportForm` writes
 * `JSON.stringify(…, null, 2)` in its own key order, so a form indented with
 * tabs — or with four spaces, or minified — came back with **every line
 * rewritten** the first time anyone touched it. Now it comes back with the line
 * they touched.
 *
 * @packageDocumentation
 */

import { type PreservedJson, preserveJsonFormatting } from "../json/json-patch.js"
import type { FormDefinition } from "./form-model.js"
import { exportForm } from "./form-serializer.js"

export type { PreservedJson }

/**
 * Rewrites a form document to say what a freshly serialized one says, keeping
 * the original's formatting wherever JSON cannot tell the difference.
 *
 * Takes both sides as text, for a caller holding a serialized document rather
 * than a model — an editor's schema, say.
 *
 * @param original - The file's current contents.
 * @param updated - The form as the serializer would write it now.
 */
export function preserveFormFormatting(original: string, updated: string): PreservedJson {
	return preserveJsonFormatting(original, updated)
}

/**
 * Serializes a form over the document it came from.
 *
 * @param original - The file's current contents.
 * @param form - The form to write.
 *
 * @example
 * ```typescript
 * const onDisk = await readFile("approval.form", "utf8");
 * await writeFile("approval.form", exportFormPreserving(onDisk, edited));
 * // Renaming one label changes one line, whatever indentation the file uses.
 * ```
 */
export function exportFormPreserving(original: string, form: FormDefinition): string {
	return preserveFormFormatting(original, exportForm(form)).json
}
