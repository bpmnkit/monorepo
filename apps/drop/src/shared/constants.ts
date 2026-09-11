/** Constants shared between the Worker and the browser client. No DOM or Worker APIs. */

/** Supported artifact kinds. */
export type FileKind = "bpmn" | "dmn" | "form"

/** Max size of a single uploaded file, in bytes. Kept below D1's 1 MiB row cap (1,048,576). */
export const MAX_FILE_BYTES = 900_000

/** Max size of any single stored representation (original or JSON) — the D1 row-body guard. */
export const MAX_ROW_BYTES = 950_000

/** Max number of files in one drop. */
export const MAX_FILES_PER_DROP = 20

/** Max total original bytes across a drop. */
export const MAX_DROP_BYTES = 5_000_000

/** Retention: a drop expires this long after it was last viewed or edited. */
export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000

/**
 * How many milestones the version log keeps per file, on top of the pinned
 * original. Eleven recoverable states per file, forever — see
 * `doc/drop-live-editing-plan.md` §2.3.
 */
export const MAX_MILESTONES = 10

/**
 * The window inside which repeated saves collapse into one milestone. An hour
 * of continuous editing leaves one entry, not hundreds.
 */
export const MILESTONE_BUCKET_MS = 60 * 60 * 1000

/**
 * How long the room lets views accumulate before writing them to D1. One write
 * per window per drop, however many people open it in that window.
 */
export const VIEW_FLUSH_MS = 60_000

/** `seq` of the uploaded original. Not a `file_versions` row — it is the untouched `file_content`. */
export const ORIGINAL_SEQ = 0

/** Accepted file extensions in the drop zone. */
export const ACCEPTED_EXTENSIONS = [".bpmn", ".dmn", ".form", ".xml", ".json"] as const

/** Abuse-report categories. */
export const REPORT_REASONS = ["copyright", "malicious", "personal-data", "other"] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

/** Share id of the built-in, in-memory demo drop (never expires, no D1 row). */
export const DEMO_SHARE_ID = "demo-loan-approval"

/** localStorage key holding the AI-review access code (closed beta). */
export const AI_CODE_STORAGE_KEY = "bpmnkit-drop-ai-code"
