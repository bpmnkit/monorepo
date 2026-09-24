-- The element instances and variables tables as on PostgreSQL (004 and 006 there).
-- SQLite had no element_instances table, and a variables table without the
-- partition_id, scope_key and is_preview columns the engine writes, so no process
-- instance could run on the embedded backend. Nothing could be written to the old
-- variables table, so it is replaced.
CREATE TABLE IF NOT EXISTS element_instances (
    key                    INTEGER  PRIMARY KEY,
    partition_id           INTEGER  NOT NULL,
    process_instance_key   INTEGER  NOT NULL REFERENCES process_instances(key) ON DELETE CASCADE,
    process_definition_key INTEGER  NOT NULL,
    bpmn_process_id        TEXT     NOT NULL,
    element_id             TEXT     NOT NULL,
    element_type           TEXT     NOT NULL,
    state                  TEXT     NOT NULL DEFAULT 'ACTIVATING',
    flow_scope_key         INTEGER,
    scope_key              INTEGER,
    incident_key           INTEGER,
    tenant_id              TEXT     NOT NULL DEFAULT '<default>'
);
CREATE INDEX IF NOT EXISTS idx_ei_pi ON element_instances (process_instance_key);
CREATE INDEX IF NOT EXISTS idx_ei_state ON element_instances (state);
CREATE INDEX IF NOT EXISTS idx_ei_element ON element_instances (element_id);

DROP TABLE IF EXISTS variables;
CREATE TABLE variables (
    key                  INTEGER  PRIMARY KEY,
    partition_id         INTEGER  NOT NULL,
    name                 TEXT     NOT NULL,
    value                TEXT     NOT NULL DEFAULT 'null',
    scope_key            INTEGER  NOT NULL,
    process_instance_key INTEGER  NOT NULL,
    tenant_id            TEXT     NOT NULL DEFAULT '<default>',
    is_preview           BOOLEAN  NOT NULL DEFAULT FALSE,
    UNIQUE (scope_key, name)
);
CREATE INDEX IF NOT EXISTS idx_var_scope ON variables (scope_key);
CREATE INDEX IF NOT EXISTS idx_var_pi ON variables (process_instance_key);
