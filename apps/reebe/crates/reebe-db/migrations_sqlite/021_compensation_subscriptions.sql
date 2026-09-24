-- Completed activities with a compensation handler, as Zeebe records them: a compensation
-- throw event of their scope runs the handler and waits for it.
CREATE TABLE IF NOT EXISTS compensation_subscriptions (
    key                               INTEGER  PRIMARY KEY,
    process_instance_key              INTEGER  NOT NULL,
    compensable_activity_id           TEXT     NOT NULL,
    compensable_activity_instance_key INTEGER  NOT NULL,
    compensable_activity_scope_key    INTEGER  NOT NULL,
    compensation_handler_id           TEXT     NOT NULL,
    throw_event_instance_key          INTEGER,
    compensation_handler_instance_key INTEGER,
    tenant_id                         TEXT     NOT NULL DEFAULT '<default>'
);
CREATE INDEX IF NOT EXISTS idx_compensation_subscriptions_pi ON compensation_subscriptions(process_instance_key);
