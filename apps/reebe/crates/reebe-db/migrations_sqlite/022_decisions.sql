-- DMN decision requirements graphs and their decisions, as on PostgreSQL
-- (003_deployments.sql there), so that DMN deploys and evaluates on SQLite.
CREATE TABLE IF NOT EXISTS decision_requirements (
    key             INTEGER  PRIMARY KEY,
    drg_id          TEXT     NOT NULL,
    name            TEXT,
    version         INTEGER  NOT NULL,
    tenant_id       TEXT     NOT NULL DEFAULT '<default>',
    deployment_key  INTEGER  NOT NULL REFERENCES deployments(key),
    resource_name   TEXT     NOT NULL,
    dmn_xml         TEXT     NOT NULL,
    UNIQUE (drg_id, version, tenant_id)
);
CREATE TABLE IF NOT EXISTS decision_definitions (
    key                       INTEGER  PRIMARY KEY,
    decision_id               TEXT     NOT NULL,
    decision_requirements_key INTEGER,
    name                      TEXT,
    version                   INTEGER  NOT NULL,
    tenant_id                 TEXT     NOT NULL DEFAULT '<default>',
    deployment_key            INTEGER  NOT NULL REFERENCES deployments(key),
    resource_name             TEXT     NOT NULL,
    dmn_xml                   TEXT     NOT NULL,
    UNIQUE (decision_id, version, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_decision_definitions_id ON decision_definitions (decision_id, tenant_id);
