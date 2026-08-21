-- BPMN Kit Drop — AI process review (closed beta).
-- See doc/drop-v2-spec.md §2.4 / §2.5.

-- Cache the AI narrative by content hash, so identical diagrams never re-spend neurons.
CREATE TABLE ai_reviews (
  content_hash TEXT PRIMARY KEY,   -- same hash as files.content_hash
  model        TEXT NOT NULL,
  review       TEXT NOT NULL,      -- JSON: { summary, suggestions: [...] }
  neurons_est  INTEGER,            -- estimated cost, for the ledger
  created_at   INTEGER NOT NULL
);

-- One row per UTC day: neurons spent, for the daily budget guard.
CREATE TABLE ai_budget (
  day    TEXT PRIMARY KEY,         -- 'YYYY-MM-DD'
  spent  INTEGER NOT NULL DEFAULT 0
);

-- Failed passcode attempts per IP-hash per hour, for brute-force rate limiting.
CREATE TABLE ai_unlock_attempts (
  ip_hash TEXT NOT NULL,
  hour    INTEGER NOT NULL,        -- floor(epoch_ms / 3600000)
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, hour)
);
