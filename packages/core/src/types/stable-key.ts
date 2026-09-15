/**
 * Deterministic tokens derived from what an entity *is*, never from where it
 * sits or when it was generated.
 *
 * Generated documents are rebuilt constantly and reviewed as a diff, so the one
 * property that matters is that an unchanged model produces byte-identical
 * output. The two obvious sources both fail it: an incrementing counter moves
 * the moment generation order or array order changes, and `crypto` moves on
 * every run. Hashing a composite key assembled only from the entity's own
 * identity moves when — and only when — that identity does.
 *
 * The key reads `scope:type:identity`, with any further segments distinguishing
 * several tokens derived for one entity — an id *and* a row, say, which must
 * not come out equal. `scope` is the enclosing document or container, so the
 * same field key in two different forms does not collide.
 */
import { sha256Hex } from "../bpmn/sha256.js"

/** Hex digits kept from the digest: 48 bits, far past collision at document scale. */
const TOKEN_LENGTH = 12

/**
 * Escapes the separator, so `["a:b", "c"]` and `["a", "b:c"]` cannot assemble
 * the same key. Without it the composite is ambiguous and two entities that
 * share nothing can still hash alike.
 */
function escapeSegment(segment: string): string {
	return segment.replace(/\\/g, "\\\\").replace(/:/g, "\\:")
}

/**
 * Assembles the composite key {@link stableToken} hashes.
 *
 * Exported so callers that group or count by key — numbering entities that are
 * genuinely indistinguishable, say — use the same escaping the hash does rather
 * than a second, subtly different join.
 */
export function compositeKey(segments: readonly string[]): string {
	return segments.map(escapeSegment).join(":")
}

/**
 * Derives a stable token from an entity's identity.
 *
 * @param prefix - The kind of thing named, e.g. `"Field"` or `"Row"`. It also
 *   keeps the result a valid NCName, which a bare digest — free to start with a
 *   digit — is not.
 * @param segments - The composite key, most general first: the scope, the
 *   entity's type, its own identity, and then any namespace separating this
 *   token from another derived for the same entity.
 */
export function stableToken(prefix: string, segments: readonly string[]): string {
	return `${prefix}_${sha256Hex(compositeKey(segments)).slice(0, TOKEN_LENGTH)}`
}
