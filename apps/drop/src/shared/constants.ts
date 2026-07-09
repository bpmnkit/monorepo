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

/** Retention: a drop expires this long after it was last viewed. */
export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000

/** Accepted file extensions in the drop zone. */
export const ACCEPTED_EXTENSIONS = [".bpmn", ".dmn", ".form", ".xml", ".json"] as const

/** Abuse-report categories. */
export const REPORT_REASONS = ["copyright", "malicious", "personal-data", "other"] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
