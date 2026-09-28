-- Completed activities with a compensation handler, as Zeebe records them: a compensation
-- throw event of their scope runs the handler and waits for it.
CREATE TABLE compensation_subscriptions (
    key                               BIGINT       PRIMARY KEY,
    process_instance_key              BIGINT       NOT NULL,
    compensable_activity_id           VARCHAR(255) NOT NULL,
    compensable_activity_instance_key BIGINT       NOT NULL,
    compensable_activity_scope_key    BIGINT       NOT NULL,
    compensation_handler_id           VARCHAR(255) NOT NULL,
    throw_event_instance_key          BIGINT,
    compensation_handler_instance_key BIGINT,
    tenant_id                         VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_compensation_subscriptions_pi ON compensation_subscriptions(process_instance_key);
