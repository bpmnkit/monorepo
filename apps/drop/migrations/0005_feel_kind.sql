-- BPMN Kit Drop — FEEL statements are a kind of thing you can drop.
--
-- `files.kind` carries a CHECK constraint, and SQLite cannot widen one in
-- place: the table has to be rebuilt. Migration 0003 avoided exactly this by
-- not adding a `rep` value; here there is nothing to avoid, because a FEEL
-- statement really is a fourth kind of file rather than a fourth view of one.
--
-- The rebuild is ordered so that it is safe whether or not foreign keys are
-- enforced. `file_content`, `file_current` and `file_versions` all reference
-- `files(id) ON DELETE CASCADE`, and `DROP TABLE files` performs an implicit
-- DELETE — which, with foreign keys on, would cascade and wipe every body in
-- the database. So the children are copied and dropped *first*: by the time
-- `files` goes, nothing references it and the cascade has nothing to delete.
--
-- Renaming `files_new` to `files` before the children are renamed is also
-- deliberate: SQLite rewrites REFERENCES clauses that point at a renamed
-- table, so the copied children end up pointing at `files` again on their own.

-- 1. The new shape. Identical to 0001 except for the widened CHECK.
CREATE TABLE files_new (
  id              TEXT PRIMARY KEY,
  drop_id         TEXT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('bpmn', 'dmn', 'form', 'feel')),
  filename        TEXT NOT NULL,
  name            TEXT,
  content_hash    TEXT NOT NULL,
  size_original   INTEGER NOT NULL,
  size_json       INTEGER NOT NULL,
  meta            TEXT NOT NULL,
  UNIQUE (drop_id, filename)
);

CREATE TABLE file_content_new (
  file_id  TEXT NOT NULL REFERENCES files_new(id) ON DELETE CASCADE,
  rep      TEXT NOT NULL CHECK (rep IN ('original', 'json')),
  body     TEXT NOT NULL,
  PRIMARY KEY (file_id, rep)
);

CREATE TABLE file_current_new (
  file_id      TEXT PRIMARY KEY REFERENCES files_new(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  json         TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE file_versions_new (
  file_id       TEXT NOT NULL REFERENCES files_new(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  bucket        TEXT NOT NULL,
  body          TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  semantic_hash TEXT NOT NULL,
  op_count      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (file_id, seq)
);

-- 2. Carry everything across.
INSERT INTO files_new SELECT * FROM files;
INSERT INTO file_content_new SELECT * FROM file_content;
INSERT INTO file_current_new SELECT * FROM file_current;
INSERT INTO file_versions_new SELECT * FROM file_versions;

-- 3. Children first, so the parent's implicit DELETE cascades to nothing.
DROP TABLE file_content;
DROP TABLE file_current;
DROP TABLE file_versions;
DROP TABLE files;

-- 4. Parent first, so the children's REFERENCES follow it.
ALTER TABLE files_new RENAME TO files;
ALTER TABLE file_content_new RENAME TO file_content;
ALTER TABLE file_current_new RENAME TO file_current;
ALTER TABLE file_versions_new RENAME TO file_versions;

-- 5. Indexes went with their tables; put them back exactly as they were.
CREATE INDEX idx_files_drop ON files (drop_id, position);
CREATE INDEX idx_files_hash ON files (content_hash);
CREATE UNIQUE INDEX idx_versions_bucket ON file_versions (file_id, bucket);
