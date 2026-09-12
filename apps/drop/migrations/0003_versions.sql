-- BPMN Kit Drop — the version log, and somewhere for edits to live.
-- See doc/drop-live-editing-plan.md §2.
--
-- Two rules shape this migration:
--
--   1. `file_content` is never written again after `insertDrop`. The uploaded
--      bytes at rep='original' stay reachable forever, so "the original can
--      never be lost" is a property of the schema rather than a promise. Edits
--      go to `file_current`; that is also why this is not a new `rep` value —
--      `file_content.rep` carries a CHECK constraint, and SQLite cannot alter
--      one without rewriting the table under live data.
--
--   2. History is bounded and can be stated in one sentence: the pinned
--      original, plus at most MAX_MILESTONES (10) rolling milestones. Eleven
--      recoverable states per file, no matter how long anyone edits.

-- The live, edited state of a file. Absent until the file is first edited, so
-- an untouched drop costs exactly what it costs today.
CREATE TABLE file_current (
  file_id      TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,     -- current source, in the file's own format
  json         TEXT NOT NULL,     -- JSON.stringify of the parsed model
  content_hash TEXT NOT NULL,     -- sha256 of `body`; the ban-list and ETag key
  updated_at   INTEGER NOT NULL   -- epoch ms
);

-- The rolling milestones. seq 0 is not stored here: it is the untouched
-- `file_content` row, which is why the ring can be pruned without ever being
-- able to discard the original.
CREATE TABLE file_versions (
  file_id       TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,  -- 1-based, monotonic per file
  bucket        TEXT NOT NULL,     -- "<hourBucket>:<sessionId>" — the collapse key
  body          TEXT NOT NULL,
  content_hash  TEXT NOT NULL,     -- suppresses a milestone that changed nothing
  semantic_hash TEXT NOT NULL,     -- labels it "layout only" vs "model changed"
  op_count      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (file_id, seq)
);

-- One milestone per (hour, editing session): repeated saves inside the same
-- bucket replace that row rather than adding one, and a new session always
-- starts a new milestone so one person's work is never overwritten by the next
-- person's inside the same hour.
CREATE UNIQUE INDEX idx_versions_bucket ON file_versions (file_id, bucket);

-- Retention slides on edit as well as on view.
ALTER TABLE drops ADD COLUMN updated_at INTEGER;
