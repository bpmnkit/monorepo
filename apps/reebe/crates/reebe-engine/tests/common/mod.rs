//! Postgres setup shared by the `integration` and `compatibility` suites.
//!
//! Each test gets its own freshly created database. The engine replays every
//! command on its partition from position 1 when it starts, so tests that
//! share a database re-execute each other's commands, and rows left by
//! earlier runs pile up without bound.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use reebe_db::{create_pool, DbConfig, DbPool, SqlxBackend};
use reebe_engine::scheduler::Scheduler;
use reebe_engine::{Engine, EngineHandle, RealClock};
use sqlx::Executor;

/// Connect to a fresh, migrated database, or return `None` to skip the test.
///
/// Skips only when `REEBE_DATABASE__URL` is unset. It panics instead when
/// `REEBE_REQUIRE_DB=1` is set (as in CI), and whenever the URL is set but the
/// database cannot be reached, so a misconfigured run cannot pass by skipping.
pub async fn setup_db(max_connections: u32) -> Option<DbPool> {
    let Ok(base_url) = std::env::var("REEBE_DATABASE__URL") else {
        assert!(
            std::env::var("REEBE_REQUIRE_DB").as_deref() != Ok("1"),
            "REEBE_REQUIRE_DB=1 but REEBE_DATABASE__URL is not set"
        );
        return None;
    };

    let admin = create_pool(&config(base_url.clone(), 1))
        .await
        .unwrap_or_else(|e| panic!("cannot connect to REEBE_DATABASE__URL: {e}"));
    let name = unique_db_name();
    admin
        .execute(format!(r#"CREATE DATABASE "{name}""#).as_str())
        .await
        .unwrap_or_else(|e| panic!("cannot create test database {name}: {e}"));
    admin.close().await;

    let pool = create_pool(&config(with_database(&base_url, &name), max_connections))
        .await
        .unwrap_or_else(|e| panic!("cannot connect to test database {name}: {e}"));
    reebe_db::pool::run_migrations(&pool)
        .await
        .unwrap_or_else(|e| panic!("migrations failed on {name}: {e}"));
    Some(pool)
}

/// Start the engine and its scheduler (timers, job timeouts) as the server does.
pub fn start_engine(pool: DbPool) -> EngineHandle {
    let backend = Arc::new(SqlxBackend::new(pool));
    let (engine, handle) = Engine::new(backend.clone(), 1, Arc::new(RealClock));
    tokio::spawn(Arc::new(engine).run());
    let scheduler = Scheduler::new(backend, handle.clone());
    tokio::spawn(async move { scheduler.run().await });
    handle
}

fn config(url: String, max_connections: u32) -> DbConfig {
    DbConfig {
        url,
        max_connections,
        min_connections: 1,
        connection_timeout_secs: 5,
    }
}

fn unique_db_name() -> String {
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    format!(
        "reebe_test_{}_{}_{}",
        std::process::id(),
        nanos,
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

/// Replace the database name in a `postgres://…/<db>[?params]` URL.
fn with_database(url: &str, db: &str) -> String {
    let (base, query) = match url.split_once('?') {
        Some((b, q)) => (b, Some(q)),
        None => (url, None),
    };
    let authority_end = base.find("://").map_or(0, |i| i + 3);
    let prefix = match base[authority_end..].find('/') {
        Some(i) => &base[..authority_end + i],
        None => base,
    };
    match query {
        Some(q) => format!("{prefix}/{db}?{q}"),
        None => format!("{prefix}/{db}"),
    }
}
