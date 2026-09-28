-- The position of the last command the engine processed on each partition. The engine
-- resumes after it on startup instead of re-processing the whole log.
CREATE TABLE IF NOT EXISTS processed_positions (
    partition_id INTEGER PRIMARY KEY,
    position     INTEGER NOT NULL
);

-- A log written before this migration was processed up to the last command that wrote
-- a follow-up record; resume there rather than replaying it all once more.
INSERT OR IGNORE INTO processed_positions (partition_id, position)
SELECT partition_id, MAX(source_position)
FROM partition_records
WHERE source_position IS NOT NULL
GROUP BY partition_id;

-- The SQLite timers table lacked columns the engine writes (process_definition_key,
-- repetitions), so no timer could be stored and the table is empty. A timer start event's
-- timer also has no process or element instance.
DROP TABLE IF EXISTS timers;
CREATE TABLE timers (
    key                    INTEGER  PRIMARY KEY,
    process_instance_key   INTEGER,
    process_definition_key INTEGER,
    element_instance_key   INTEGER,
    element_id             TEXT     NOT NULL,
    due_date               TEXT     NOT NULL,
    repetitions            INTEGER  NOT NULL DEFAULT 1,
    state                  TEXT     NOT NULL DEFAULT 'ACTIVE',
    tenant_id              TEXT     NOT NULL DEFAULT '<default>'
);
CREATE INDEX IF NOT EXISTS idx_timers_due ON timers (due_date, state);
CREATE INDEX IF NOT EXISTS idx_timers_pi ON timers (process_instance_key);

CREATE TABLE IF NOT EXISTS message_start_event_subscriptions (
    key                    INTEGER  PRIMARY KEY,
    message_name           TEXT     NOT NULL,
    bpmn_process_id        TEXT     NOT NULL,
    start_event_id         TEXT     NOT NULL,
    process_definition_key INTEGER  NOT NULL,
    tenant_id              TEXT     NOT NULL DEFAULT '<default>',
    UNIQUE (message_name, bpmn_process_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_mse_name ON message_start_event_subscriptions(message_name);

-- Process instances created by a message start event with a correlation key: at most one
-- of them is active per key, and a message starts a process at most once.
CREATE TABLE IF NOT EXISTS message_start_correlations (
    process_instance_key INTEGER  PRIMARY KEY,
    message_key          INTEGER  NOT NULL,
    bpmn_process_id      TEXT     NOT NULL,
    correlation_key      TEXT     NOT NULL,
    tenant_id            TEXT     NOT NULL DEFAULT '<default>'
);
CREATE INDEX IF NOT EXISTS idx_msc_process_key ON message_start_correlations(bpmn_process_id, correlation_key, tenant_id);
