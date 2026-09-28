-- Tokens waiting at a joining parallel or inclusive gateway, per flow scope and incoming
-- sequence flow, as Zeebe counts taken sequence flows. They replace gateway_tokens, which
-- counted per process instance and gateway only and so could not tell which flows a
-- token came from, nor which flow scope it waits in.
DROP TABLE IF EXISTS gateway_tokens;
CREATE TABLE join_tokens (
    process_instance_key BIGINT       NOT NULL,
    flow_scope_key       BIGINT       NOT NULL,
    gateway_id           VARCHAR(255) NOT NULL,
    sequence_flow_id     VARCHAR(255) NOT NULL,
    token_count          INT          NOT NULL,
    PRIMARY KEY (flow_scope_key, gateway_id, sequence_flow_id)
);
CREATE INDEX idx_join_tokens_pi ON join_tokens(process_instance_key);
