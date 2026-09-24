#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::{Result, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub key: i64,
    pub name: String,
    pub correlation_key: String,
    pub time_to_live_ms: i64,
    pub expires_at: DateTime<Utc>,
    pub variables: Value,
    pub state: String,
    pub tenant_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSubscription {
    pub key: i64,
    pub message_name: String,
    pub correlation_key: String,
    pub process_instance_key: i64,
    pub element_instance_key: i64,
    pub state: String,
    pub tenant_id: String,
}

/// A message start event of the latest version of a deployed process.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageStartEventSubscription {
    pub key: i64,
    pub message_name: String,
    pub bpmn_process_id: String,
    pub start_event_id: String,
    pub process_definition_key: i64,
    pub tenant_id: String,
}

/// A process instance a message with a correlation key created through a message start event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageStartCorrelation {
    pub process_instance_key: i64,
    pub message_key: i64,
    pub bpmn_process_id: String,
    pub correlation_key: String,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct MessageRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> MessageRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, msg: &Message) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO messages
               (key, name, correlation_key, time_to_live_ms, expires_at, variables, state, tenant_id, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
        )
        .bind(msg.key)
        .bind(&msg.name)
        .bind(&msg.correlation_key)
        .bind(msg.time_to_live_ms)
        .bind(msg.expires_at)
        .bind(&msg.variables)
        .bind(&msg.state)
        .bind(&msg.tenant_id)
        .bind(msg.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_correlation(
        &self,
        name: &str,
        correlation_key: &str,
        tenant_id: &str,
    ) -> Result<Vec<Message>> {
        let rows = sqlx::query(
            r#"SELECT key, name, correlation_key, time_to_live_ms, expires_at, variables,
                      state, tenant_id, created_at
               FROM messages
               WHERE name = $1 AND correlation_key = $2 AND tenant_id = $3
                 AND state = 'PUBLISHED' AND expires_at > NOW()
               ORDER BY created_at"#,
        )
        .bind(name)
        .bind(correlation_key)
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_message(r)).collect())
    }

    pub async fn expire_old(&self) -> Result<u64> {
        let result = sqlx::query(
            "UPDATE messages SET state = 'EXPIRED' WHERE state = 'PUBLISHED' AND expires_at <= NOW()",
        )
        .execute(self.pool)
        .await?;
        Ok(result.rows_affected())
    }

    pub async fn search(
        &self,
        name: Option<&str>,
        state: Option<&str>,
        tenant_id: Option<&str>,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<Message>> {
        let rows = sqlx::query(
            r#"SELECT key, name, correlation_key, time_to_live_ms, expires_at, variables,
                      state, tenant_id, created_at
               FROM messages
               WHERE ($1::text IS NULL OR name = $1)
                 AND ($2::text IS NULL OR state = $2)
                 AND ($3::text IS NULL OR tenant_id = $3)
                 AND ($4::bigint IS NULL OR key > $4)
               ORDER BY key
               LIMIT $5"#,
        )
        .bind(name)
        .bind(state)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_message(r)).collect())
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_message(r: crate::DbRow) -> Message {
    use sqlx::Row;
    Message {
        key: r.get("key"),
        name: r.get("name"),
        correlation_key: r.get("correlation_key"),
        time_to_live_ms: r.get("time_to_live_ms"),
        expires_at: r.get("expires_at"),
        variables: r.get("variables"),
        state: r.get("state"),
        tenant_id: r.get("tenant_id"),
        created_at: r.get("created_at"),
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct MessageSubscriptionRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> MessageSubscriptionRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, sub: &MessageSubscription) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO message_subscriptions
               (key, message_name, correlation_key, process_instance_key, element_instance_key, state, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
        )
        .bind(sub.key)
        .bind(&sub.message_name)
        .bind(&sub.correlation_key)
        .bind(sub.process_instance_key)
        .bind(sub.element_instance_key)
        .bind(&sub.state)
        .bind(&sub.tenant_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_by_correlation(
        &self,
        message_name: &str,
        correlation_key: &str,
        tenant_id: &str,
    ) -> Result<Vec<MessageSubscription>> {
        let rows = sqlx::query(
            r#"SELECT key, message_name, correlation_key, process_instance_key,
                      element_instance_key, state, tenant_id
               FROM message_subscriptions
               WHERE message_name = $1 AND correlation_key = $2 AND tenant_id = $3
               ORDER BY key"#,
        )
        .bind(message_name)
        .bind(correlation_key)
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_sub(r)).collect())
    }

    pub async fn update_state(&self, key: i64, state: &str) -> Result<()> {
        sqlx::query("UPDATE message_subscriptions SET state = $1 WHERE key = $2")
            .bind(state)
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete(&self, key: i64) -> Result<()> {
        sqlx::query("DELETE FROM message_subscriptions WHERE key = $1")
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<MessageSubscription> {
        let row = sqlx::query(
            r#"SELECT key, message_name, correlation_key, process_instance_key,
                      element_instance_key, state, tenant_id
               FROM message_subscriptions WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_sub(r)),
            None => Err(DbError::NotFound(format!("Message subscription {key}"))),
        }
    }

    pub async fn search(
        &self,
        message_name: Option<&str>,
        state: Option<&str>,
        tenant_id: Option<&str>,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<MessageSubscription>> {
        let rows = sqlx::query(
            r#"SELECT key, message_name, correlation_key, process_instance_key,
                      element_instance_key, state, tenant_id
               FROM message_subscriptions
               WHERE ($1::text IS NULL OR message_name = $1)
                 AND ($2::text IS NULL OR state = $2)
                 AND ($3::text IS NULL OR tenant_id = $3)
                 AND ($4::bigint IS NULL OR key > $4)
               ORDER BY key
               LIMIT $5"#,
        )
        .bind(message_name)
        .bind(state)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| row_to_sub(r)).collect())
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_sub(r: crate::DbRow) -> MessageSubscription {
    use sqlx::Row;
    MessageSubscription {
        key: r.get("key"),
        message_name: r.get("message_name"),
        correlation_key: r.get("correlation_key"),
        process_instance_key: r.get("process_instance_key"),
        element_instance_key: r.get("element_instance_key"),
        state: r.get("state"),
        tenant_id: r.get("tenant_id"),
    }
}
