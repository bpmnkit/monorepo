//! Deployed DMN decision requirements graphs (DRGs) and their decisions, versioned as
//! Zeebe versions them.

#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use serde::{Deserialize, Serialize};
use crate::Result;

/// A deployed DMN resource: its `definitions` (the decision requirements graph).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionRequirements {
    pub key: i64,
    /// The `id` of the DMN `definitions`.
    pub drg_id: String,
    pub name: Option<String>,
    pub version: i32,
    pub tenant_id: String,
    pub deployment_key: i64,
    pub resource_name: String,
    pub dmn_xml: String,
}

/// A deployed decision of a decision requirements graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionDefinition {
    pub key: i64,
    pub decision_id: String,
    pub name: Option<String>,
    pub version: i32,
    pub decision_requirements_key: i64,
    /// The `drg_id` of its decision requirements graph.
    pub decision_requirements_id: String,
    pub tenant_id: String,
    pub deployment_key: i64,
    pub resource_name: String,
    /// The DMN of its decision requirements graph.
    pub dmn_xml: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct DecisionRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
const DECISION_COLUMNS: &str = "d.key, d.decision_id, d.name, d.version, d.decision_requirements_key, \
     r.drg_id, d.tenant_id, d.deployment_key, d.resource_name, d.dmn_xml";

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> DecisionRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert_requirements(&self, drg: &DecisionRequirements) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO decision_requirements
               (key, drg_id, name, version, tenant_id, deployment_key, resource_name, dmn_xml)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
        )
        .bind(drg.key)
        .bind(&drg.drg_id)
        .bind(&drg.name)
        .bind(drg.version)
        .bind(&drg.tenant_id)
        .bind(drg.deployment_key)
        .bind(&drg.resource_name)
        .bind(&drg.dmn_xml)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn latest_requirements(&self, drg_id: &str, tenant_id: &str) -> Result<Option<DecisionRequirements>> {
        use sqlx::Row;
        let row = sqlx::query(
            r#"SELECT key, drg_id, name, version, tenant_id, deployment_key, resource_name, dmn_xml
               FROM decision_requirements WHERE drg_id = $1 AND tenant_id = $2
               ORDER BY version DESC LIMIT 1"#,
        )
        .bind(drg_id)
        .bind(tenant_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row.map(|r| DecisionRequirements {
            key: r.get("key"),
            drg_id: r.get("drg_id"),
            name: r.get("name"),
            version: r.get("version"),
            tenant_id: r.get("tenant_id"),
            deployment_key: r.get("deployment_key"),
            resource_name: r.get("resource_name"),
            dmn_xml: r.get("dmn_xml"),
        }))
    }

    pub async fn insert_decision(&self, decision: &DecisionDefinition) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO decision_definitions
               (key, decision_id, decision_requirements_key, name, version, tenant_id, deployment_key, resource_name, dmn_xml)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
        )
        .bind(decision.key)
        .bind(&decision.decision_id)
        .bind(decision.decision_requirements_key)
        .bind(&decision.name)
        .bind(decision.version)
        .bind(&decision.tenant_id)
        .bind(decision.deployment_key)
        .bind(&decision.resource_name)
        .bind(&decision.dmn_xml)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn latest_decision(&self, decision_id: &str, tenant_id: &str) -> Result<Option<DecisionDefinition>> {
        let row = sqlx::query(&format!(
            "SELECT {DECISION_COLUMNS} FROM decision_definitions d \
             LEFT JOIN decision_requirements r ON r.key = d.decision_requirements_key \
             WHERE d.decision_id = $1 AND d.tenant_id = $2 ORDER BY d.version DESC LIMIT 1"
        ))
        .bind(decision_id)
        .bind(tenant_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row.map(row_to_decision))
    }

    pub async fn decision_by_key(&self, key: i64) -> Result<Option<DecisionDefinition>> {
        let row = sqlx::query(&format!(
            "SELECT {DECISION_COLUMNS} FROM decision_definitions d \
             LEFT JOIN decision_requirements r ON r.key = d.decision_requirements_key \
             WHERE d.key = $1"
        ))
        .bind(key)
        .fetch_optional(self.pool)
        .await?;
        Ok(row.map(row_to_decision))
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_decision(r: crate::DbRow) -> DecisionDefinition {
    use sqlx::Row;
    DecisionDefinition {
        key: r.get("key"),
        decision_id: r.get("decision_id"),
        name: r.get("name"),
        version: r.get("version"),
        decision_requirements_key: r.get::<Option<i64>, _>("decision_requirements_key").unwrap_or(-1),
        decision_requirements_id: r.get::<Option<String>, _>("drg_id").unwrap_or_default(),
        tenant_id: r.get("tenant_id"),
        deployment_key: r.get("deployment_key"),
        resource_name: r.get("resource_name"),
        dmn_xml: r.get("dmn_xml"),
    }
}
