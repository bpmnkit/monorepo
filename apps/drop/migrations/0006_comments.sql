-- BPMN Kit Drop — review comments.
--
-- A comment is anchored by *name*, not by position: the file it is on and,
-- for a BPMN file, the id of the element. Edits move and delete elements, and
-- an id is the one thing about an element that survives a move — so a comment
-- outlives the edit, and one whose element has gone is shown as "on a removed
-- element" rather than silently dropped. `element_label` is the element's name
-- when the comment was made, so that message can still say which one it was.
--
-- There are no accounts. `author_hash` is the sha256 of a random per-drop
-- author token the browser keeps; it is what makes "your own comment" mean
-- something, and the token itself is never stored.

CREATE TABLE comments (
  id            TEXT PRIMARY KEY,              -- base58, 12 chars
  drop_id       TEXT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  element_id    TEXT,                          -- NULL = the file as a whole
  element_label TEXT,
  parent_id     TEXT,                          -- NULL = a thread; else the thread it replies to
  author_name   TEXT NOT NULL,
  author_hash   TEXT NOT NULL,
  body          TEXT NOT NULL,                 -- emptied on delete
  mentions      TEXT NOT NULL DEFAULT '[]',    -- JSON array of names
  created_at    INTEGER NOT NULL,
  edited_at     INTEGER,
  deleted_at    INTEGER,                       -- a tombstone keeps its replies' thread
  resolved_at   INTEGER,                       -- threads only
  resolved_by   TEXT
);

CREATE INDEX idx_comments_drop ON comments (drop_id, created_at);

-- The author tokens this drop has issued. A token earns its row by passing the
-- same challenge an edit claim does, once; after that the browser comments
-- without being asked again.
CREATE TABLE comment_authors (
  drop_id     TEXT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (drop_id, token_hash)
);

-- Comment writes per address per hour — the same shape as ai_unlock_attempts.
CREATE TABLE comment_writes (
  ip_hash TEXT NOT NULL,
  hour    INTEGER NOT NULL,                    -- floor(epoch_ms / 3600000)
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, hour)
);
