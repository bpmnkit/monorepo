#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::Result;

/// Tokens waiting at a joining parallel or inclusive gateway: `count` tokens that
/// arrived on `sequence_flow_id` in the flow scope `flow_scope_key` and wait for
/// the gateway to activate. Zeebe counts taken sequence flows the same way.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JoinToken {
    pub process_instance_key: i64,
    pub flow_scope_key: i64,
    pub gateway_id: String,
    pub sequence_flow_id: String,
    pub count: i32,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct JoinTokenRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> JoinTokenRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    /// Record one more token on `sequence_flow_id`.
    pub async fn add(
        &self,
        process_instance_key: i64,
        flow_scope_key: i64,
        gateway_id: &str,
        sequence_flow_id: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO join_tokens (process_instance_key, flow_scope_key, gateway_id, sequence_flow_id, token_count)
               VALUES ($1, $2, $3, $4, 1)
               ON CONFLICT (flow_scope_key, gateway_id, sequence_flow_id)
               DO UPDATE SET token_count = join_tokens.token_count + 1"#,
        )
        .bind(process_instance_key)
        .bind(flow_scope_key)
        .bind(gateway_id)
        .bind(sequence_flow_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Consume one token on `sequence_flow_id`.
    pub async fn take(&self, flow_scope_key: i64, gateway_id: &str, sequence_flow_id: &str) -> Result<()> {
        sqlx::query(
            "UPDATE join_tokens SET token_count = token_count - 1
             WHERE flow_scope_key = $1 AND gateway_id = $2 AND sequence_flow_id = $3",
        )
        .bind(flow_scope_key)
        .bind(gateway_id)
        .bind(sequence_flow_id)
        .execute(self.pool)
        .await?;
        sqlx::query("DELETE FROM join_tokens WHERE flow_scope_key = $1 AND token_count <= 0")
            .bind(flow_scope_key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_by_process_instance(&self, process_instance_key: i64) -> Result<Vec<JoinToken>> {
        let rows = sqlx::query(
            "SELECT process_instance_key, flow_scope_key, gateway_id, sequence_flow_id, token_count
             FROM join_tokens WHERE process_instance_key = $1
             ORDER BY flow_scope_key, gateway_id, sequence_flow_id",
        )
        .bind(process_instance_key)
        .fetch_all(self.pool)
        .await?;
        use sqlx::Row;
        Ok(rows
            .into_iter()
            .map(|r| JoinToken {
                process_instance_key: r.get("process_instance_key"),
                flow_scope_key: r.get("flow_scope_key"),
                gateway_id: r.get("gateway_id"),
                sequence_flow_id: r.get("sequence_flow_id"),
                count: r.get("token_count"),
            })
            .collect())
    }

    pub async fn delete_by_flow_scope(&self, flow_scope_key: i64) -> Result<()> {
        sqlx::query("DELETE FROM join_tokens WHERE flow_scope_key = $1")
            .bind(flow_scope_key)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
