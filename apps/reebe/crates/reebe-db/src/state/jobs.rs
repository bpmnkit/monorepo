#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::pool::DbPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::{Result, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub key: i64,
    pub partition_id: i16,
    pub job_type: String,
    pub state: String,
    pub process_instance_key: i64,
    pub element_instance_key: i64,
    pub process_definition_key: i64,
    pub bpmn_process_id: String,
    pub element_id: String,
    pub retries: i32,
    pub worker: Option<String>,
    pub deadline: Option<DateTime<Utc>>,
    pub retry_back_off_at: Option<DateTime<Utc>>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub custom_headers: Value,
    pub variables: Value,
    pub created_at: DateTime<Utc>,
    pub tenant_id: String,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct JobRepository<'a> {
    pool: &'a DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl<'a> JobRepository<'a> {
    pub fn new(pool: &'a DbPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, job: &Job) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO jobs
               (key, partition_id, job_type, state, process_instance_key, element_instance_key,
                process_definition_key, bpmn_process_id, element_id, retries, worker, deadline,
                retry_back_off_at, error_code, error_message, custom_headers, variables, created_at, tenant_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)"#,
        )
        .bind(job.key)
        .bind(job.partition_id)
        .bind(&job.job_type)
        .bind(&job.state)
        .bind(job.process_instance_key)
        .bind(job.element_instance_key)
        .bind(job.process_definition_key)
        .bind(&job.bpmn_process_id)
        .bind(&job.element_id)
        .bind(job.retries)
        .bind(&job.worker)
        .bind(job.deadline)
        .bind(job.retry_back_off_at)
        .bind(&job.error_code)
        .bind(&job.error_message)
        .bind(&job.custom_headers)
        .bind(&job.variables)
        .bind(job.created_at)
        .bind(&job.tenant_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn complete(&self, key: i64, variables: Option<Value>) -> Result<()> {
        let vars = variables.unwrap_or_else(|| Value::Object(Default::default()));
        sqlx::query(
            "UPDATE jobs SET state = 'COMPLETED', variables = $1 WHERE key = $2",
        )
        .bind(&vars)
        .bind(key)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn fail(
        &self,
        key: i64,
        retries: i32,
        error_message: Option<&str>,
        error_code: Option<&str>,
        retry_back_off_ms: Option<i64>,
    ) -> Result<()> {
        let new_state = if retries <= 0 { "FAILED" } else { "ACTIVATABLE" };
        let retry_back_off_at = retry_back_off_ms
            .filter(|&ms| ms > 0)
            .map(|ms| chrono::Utc::now() + chrono::Duration::milliseconds(ms));
        sqlx::query(
            r#"UPDATE jobs SET state = $1, retries = $2, error_message = $3,
               error_code = $4, worker = NULL, deadline = NULL, retry_back_off_at = $6 WHERE key = $5"#,
        )
        .bind(new_state)
        .bind(retries)
        .bind(error_message)
        .bind(error_code)
        .bind(key)
        .bind(retry_back_off_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_retries(&self, key: i64, retries: i32) -> Result<()> {
        sqlx::query(
            "UPDATE jobs SET retries = $1, state = CASE WHEN state = 'FAILED' AND $1 > 0 THEN 'ACTIVATABLE' ELSE state END WHERE key = $2",
        )
        .bind(retries)
        .bind(key)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_deadline(&self, key: i64, deadline: chrono::DateTime<chrono::Utc>) -> Result<()> {
        sqlx::query("UPDATE jobs SET deadline = $1 WHERE key = $2")
            .bind(deadline)
            .bind(key)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_by_key(&self, key: i64) -> Result<Job> {
        let row = sqlx::query(
            r#"SELECT key, partition_id, job_type, state, process_instance_key,
                      element_instance_key, process_definition_key, bpmn_process_id, element_id,
                      retries, worker, deadline, retry_back_off_at, error_code, error_message,
                      custom_headers, variables, created_at, tenant_id
               FROM jobs WHERE key = $1"#,
        )
        .bind(key)
        .fetch_optional(self.pool)
        .await?;

        match row {
            Some(r) => Ok(row_to_job(r)),
            None => Err(DbError::NotFound(format!("Job {key}"))),
        }
    }

    pub async fn search(
        &self,
        state_filter: Option<&str>,
        job_type: Option<&str>,
        process_instance_key: Option<i64>,
        tenant_id: Option<&str>,
        page_size: i64,
        after_key: Option<i64>,
    ) -> Result<Vec<Job>> {
        let rows = sqlx::query(
            r#"SELECT key, partition_id, job_type, state, process_instance_key,
                      element_instance_key, process_definition_key, bpmn_process_id, element_id,
                      retries, worker, deadline, retry_back_off_at, error_code, error_message,
                      custom_headers, variables, created_at, tenant_id
               FROM jobs
               WHERE ($1::text IS NULL OR state = $1)
                 AND ($2::text IS NULL OR job_type = $2)
                 AND ($3::bigint IS NULL OR process_instance_key = $3)
                 AND ($4::text IS NULL OR tenant_id = $4)
                 AND ($5::bigint IS NULL OR key > $5)
               ORDER BY key
               LIMIT $6"#,
        )
        .bind(state_filter)
        .bind(job_type)
        .bind(process_instance_key)
        .bind(tenant_id)
        .bind(after_key)
        .bind(page_size)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(row_to_job).collect())
    }

    pub async fn get_activatable_by_type(
        &self,
        job_type: &str,
        limit: i64,
    ) -> Result<Vec<Job>> {
        let now = chrono::Utc::now();
        let rows = sqlx::query(
            r#"SELECT key, partition_id, job_type, state, process_instance_key,
                      element_instance_key, process_definition_key, bpmn_process_id, element_id,
                      retries, worker, deadline, retry_back_off_at, error_code, error_message,
                      custom_headers, variables, created_at, tenant_id
               FROM jobs
               WHERE job_type = $1 AND state = 'ACTIVATABLE'
                 AND (retry_back_off_at IS NULL OR retry_back_off_at <= $3)
               ORDER BY created_at
               LIMIT $2"#,
        )
        .bind(job_type)
        .bind(limit)
        .bind(now)
        .fetch_all(self.pool)
        .await?;

        Ok(rows.into_iter().map(row_to_job).collect())
    }

    pub async fn mark_timed_out(&self) -> Result<u64> {
        let now = chrono::Utc::now();
        let result = sqlx::query(
            r#"UPDATE jobs SET state = 'ACTIVATABLE', worker = NULL, deadline = NULL
               WHERE state = 'ACTIVATED' AND deadline < $1"#,
        )
        .bind(now)
        .execute(self.pool)
        .await?;
        Ok(result.rows_affected())
    }

    pub async fn count_active_by_type(&self) -> Result<Vec<(String, i64)>> {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT job_type, COUNT(*) AS cnt FROM jobs WHERE state NOT IN ('COMPLETED', 'FAILED', 'CANCELED', 'ERROR') GROUP BY job_type"
        )
        .fetch_all(self.pool)
        .await?;
        Ok(rows.into_iter().map(|r| (r.get::<String, _>("job_type"), r.get::<i64, _>("cnt"))).collect())
    }
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub async fn activate_jobs(
    pool: &DbPool,
    job_type: &str,
    worker: &str,
    max_jobs: i64,
    timeout_ms: i64,
) -> Result<Vec<Job>> {
    let mut txn = pool.begin().await?;
    let deadline = chrono::Utc::now()
        + chrono::Duration::milliseconds(timeout_ms);

    let rows = {
        #[cfg(feature = "postgres")]
        {
            sqlx::query(r#"
                WITH to_activate AS (
                    SELECT key FROM jobs
                    WHERE job_type = $1 AND state = 'ACTIVATABLE'
                      AND (retry_back_off_at IS NULL OR retry_back_off_at <= NOW())
                    ORDER BY created_at
                    LIMIT $2
                    FOR UPDATE SKIP LOCKED
                )
                UPDATE jobs SET
                    state = 'ACTIVATED',
                    worker = $3,
                    deadline = $4,
                    retry_back_off_at = NULL
                WHERE key IN (SELECT key FROM to_activate)
                RETURNING key, partition_id, job_type, state, process_instance_key,
                          element_instance_key, process_definition_key, bpmn_process_id, element_id,
                          retries, worker, deadline, retry_back_off_at, error_code, error_message,
                          custom_headers, variables, created_at, tenant_id
            "#)
            .bind(job_type)
            .bind(max_jobs)
            .bind(worker)
            .bind(deadline)
            .fetch_all(&mut *txn)
            .await?
        }
        #[cfg(feature = "sqlite")]
        {
            // SQLite does not support FOR UPDATE SKIP LOCKED; single-process so no contention
            let now = chrono::Utc::now();
            sqlx::query(r#"
                UPDATE jobs SET
                    state = 'ACTIVATED',
                    worker = $3,
                    deadline = $4,
                    retry_back_off_at = NULL
                WHERE key IN (
                    SELECT key FROM jobs
                    WHERE job_type = $1 AND state = 'ACTIVATABLE'
                      AND (retry_back_off_at IS NULL OR retry_back_off_at <= $5)
                    ORDER BY created_at
                    LIMIT $2
                )
                RETURNING key, partition_id, job_type, state, process_instance_key,
                          element_instance_key, process_definition_key, bpmn_process_id, element_id,
                          retries, worker, deadline, retry_back_off_at, error_code, error_message,
                          custom_headers, variables, created_at, tenant_id
            "#)
            .bind(job_type)
            .bind(max_jobs)
            .bind(worker)
            .bind(deadline)
            .bind(now)
            .fetch_all(&mut *txn)
            .await?
        }
    };

    txn.commit().await?;
    Ok(rows.into_iter().map(row_to_job).collect())
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub async fn cancel_jobs_by_process_instance(pool: &DbPool, process_instance_key: i64) -> Result<u64> {
    let result = sqlx::query(
        r#"UPDATE jobs SET state = 'CANCELED', worker = NULL, deadline = NULL
           WHERE process_instance_key = $1 AND state IN ('ACTIVATABLE', 'ACTIVATED')"#,
    )
    .bind(process_instance_key)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub async fn cancel_jobs_by_element_instance(pool: &DbPool, element_instance_key: i64) -> Result<u64> {
    let result = sqlx::query(
        r#"UPDATE jobs SET state = 'CANCELED', worker = NULL, deadline = NULL
           WHERE element_instance_key = $1 AND state IN ('ACTIVATABLE', 'ACTIVATED')"#,
    )
    .bind(element_instance_key)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
fn row_to_job(r: crate::DbRow) -> Job {
    use sqlx::Row;
    Job {
        key: r.get("key"),
        partition_id: r.get("partition_id"),
        job_type: r.get("job_type"),
        state: r.get("state"),
        process_instance_key: r.get("process_instance_key"),
        element_instance_key: r.get("element_instance_key"),
        process_definition_key: r.get("process_definition_key"),
        bpmn_process_id: r.get("bpmn_process_id"),
        element_id: r.get("element_id"),
        retries: r.get("retries"),
        worker: r.get("worker"),
        deadline: r.get("deadline"),
        retry_back_off_at: r.get("retry_back_off_at"),
        error_code: r.get("error_code"),
        error_message: r.get("error_message"),
        custom_headers: r.get("custom_headers"),
        variables: r.get("variables"),
        created_at: r.get("created_at"),
        tenant_id: r.get("tenant_id"),
    }
}
