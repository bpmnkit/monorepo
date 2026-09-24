-- The position of the last command the engine processed on each partition. The engine
-- resumes after it on startup instead of re-processing the whole log.
CREATE TABLE processed_positions (
    partition_id SMALLINT PRIMARY KEY,
    position     BIGINT   NOT NULL
);

-- A log written before this migration was processed up to the last command that wrote
-- a follow-up record; resume there rather than replaying it all once more.
INSERT INTO processed_positions (partition_id, position)
SELECT partition_id, MAX(source_position)
FROM partition_records
WHERE source_position IS NOT NULL
GROUP BY partition_id;

-- Process instances created by a message start event with a correlation key: at most one
-- of them is active per key, and a message starts a process at most once.
CREATE TABLE message_start_correlations (
    process_instance_key BIGINT       PRIMARY KEY,
    message_key          BIGINT       NOT NULL,
    bpmn_process_id      VARCHAR(255) NOT NULL,
    correlation_key      VARCHAR(255) NOT NULL,
    tenant_id            VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_msc_process_key ON message_start_correlations(bpmn_process_id, correlation_key, tenant_id);
