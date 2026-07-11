-- BPMN Kit Drop — initial schema.
-- Content is split across `files`/`file_content` so each representation stays
-- under D1's 1 MiB per-row limit (see doc/drop-spec.md §5).

CREATE TABLE drops (
  id              TEXT PRIMARY KEY,          -- shareId (base58, ~64 bits)
  file_count      INTEGER NOT NULL,
  size_total      INTEGER NOT NULL,          -- sum of original bytes
  tos_version     TEXT NOT NULL,             -- Terms version acknowledged at upload
  created_at      INTEGER NOT NULL,          -- epoch ms
  last_viewed_at  INTEGER NOT NULL,          -- epoch ms
  view_count      INTEGER NOT NULL DEFAULT 0,
  expires_at      INTEGER                    -- epoch ms; NULL = admin-pinned, never expires
);

CREATE TABLE files (
  id              TEXT PRIMARY KEY,          -- random short id
  drop_id         TEXT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,          -- upload order == tab order
  kind            TEXT NOT NULL CHECK (kind IN ('bpmn', 'dmn', 'form')),
  filename        TEXT NOT NULL,             -- sanitized, unique within the drop
  name            TEXT,                      -- model name (process/decision/form)
  content_hash    TEXT NOT NULL,             -- sha256 hex of original bytes
  size_original   INTEGER NOT NULL,
  size_json       INTEGER NOT NULL,
  meta            TEXT NOT NULL,             -- JSON: element counts, ids, platform
  UNIQUE (drop_id, filename)
);

CREATE TABLE file_content (
  file_id  TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  rep      TEXT NOT NULL CHECK (rep IN ('original', 'json')),
  body     TEXT NOT NULL,
  PRIMARY KEY (file_id, rep)
);

CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  drop_id     TEXT NOT NULL,                 -- no FK: report outlives drop deletion (audit)
  reason      TEXT NOT NULL CHECK (reason IN ('copyright', 'malicious', 'personal-data', 'other')),
  details     TEXT,
  reporter    TEXT,                          -- salted sha256 of reporter IP (dedup/rate-limit)
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at  INTEGER NOT NULL
);

CREATE TABLE banned_hashes (
  content_hash TEXT PRIMARY KEY,
  reason       TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX idx_files_drop     ON files (drop_id, position);
CREATE INDEX idx_files_hash     ON files (content_hash);
CREATE INDEX idx_drops_expires  ON drops (expires_at);
CREATE INDEX idx_reports_status ON reports (status, created_at);
CREATE UNIQUE INDEX idx_reports_dedup ON reports (drop_id, reporter) WHERE status = 'open' AND reporter IS NOT NULL;
