#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::Result;
use serde::{Deserialize, Serialize};

/// A completed activity that has a compensation handler, as Zeebe records one: the
/// handler runs if a compensation throw event of its scope is reached later.
/// `throw_event_instance_key` is set once a throw event invoked the handler, and
/// `compensation_handler_instance_key` once the handler activated.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompensationSubscription {
    pub key: i64,
    pub process_instance_key: i64,
    pub compensable_activity_id: String,
    pub compensable_activity_instance_key: i64,
    /// The flow scope the activity completed in.
    pub compensable_activity_scope_key: i64,
    pub compensation_handler_id: String,
    pub throw_event_instance_key: Option<i64>,
    pub compensation_handler_instance_key: Option<i64>,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct CompensationSubscriptionRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> CompensationSubscriptionRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn upsert(&self, sub: &CompensationSubscription) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO compensation_subscriptions
               (key, process_instance_key, compensable_activity_id, compensable_activity_instance_key,
                compensable_activity_scope_key, compensation_handler_id, throw_event_instance_key,
                compensation_handler_instance_key, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (key) DO UPDATE SET
                 throw_event_instance_key = EXCLUDED.throw_event_instance_key,
                 compensation_handler_instance_key = EXCLUDED.compensation_handler_instance_key"#,
        )
        .bind(sub.key)
        .bind(sub.process_instance_key)
        .bind(&sub.compensable_activity_id)
        .bind(sub.compensable_activity_instance_key)
        .bind(sub.compensable_activity_scope_key)
        .bind(&sub.compensation_handler_id)
        .bind(sub.throw_event_instance_key)
        .bind(sub.compensation_handler_instance_key)
        .bind(&sub.tenant_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_process_instance(&self, process_instance_key: i64) -> Result<Vec<CompensationSubscription>> {
        let rows = sqlx::query(
            r#"SELECT key, process_instance_key, compensable_activity_id, compensable_activity_instance_key,
                      compensable_activity_scope_key, compensation_handler_id, throw_event_instance_key,
                      compensation_handler_instance_key, tenant_id
               FROM compensation_subscriptions WHERE process_instance_key = $1 ORDER BY key"#,
        )
        .bind(process_instance_key)
        .fetch_all(self.pool)
        .await?;
        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| CompensationSubscription {
                key: r.get("key"),
                process_instance_key: r.get("process_instance_key"),
                compensable_activity_id: r.get("compensable_activity_id"),
                compensable_activity_instance_key: r.get("compensable_activity_instance_key"),
                compensable_activity_scope_key: r.get("compensable_activity_scope_key"),
                compensation_handler_id: r.get("compensation_handler_id"),
                throw_event_instance_key: r.get("throw_event_instance_key"),
                compensation_handler_instance_key: r.get("compensation_handler_instance_key"),
                tenant_id: r.get("tenant_id"),
            })
            .collect())
    }

    pub async fn delete(&self, key: i64) -> Result<()> {
        sqlx::query("DELETE FROM compensation_subscriptions WHERE key = $1")
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
