//! Reebe Server — drop-in REST API replacement for the Zeebe workflow engine.
//!
//! # Usage
//!
//! ```bash
//! reebe-server --config config.toml
//! # or with environment variables:
//! REEBE_DATABASE_URL=postgres://zeebe:zeebe@localhost:5432/zeebe reebe-server
//! ```

mod config;

use std::sync::Arc;
use clap::Parser;
use config::Config;
use tokio::signal;
use tracing::info;

#[derive(Parser)]
#[command(name = "reebe-server", about = "Reebe workflow engine server")]
struct Cli {
    #[arg(short, long, default_value = "config.toml")]
    config: String,
    #[arg(short, long, env = "REEBE_PORT", default_value = "8080")]
    port: u16,
    #[arg(long, env = "REEBE_DATABASE_URL")]
    database_url: Option<String>,
    /// Use a built-in SQLite database stored in the OS app-data directory.
    /// No external database required — great for quick experimentation.
    #[cfg(feature = "embedded")]
    #[arg(long, env = "REEBE_EMBEDDED", default_value = "true")]
    embedded: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("reebe=info".parse()?)
                .add_directive("reebe_server=info".parse()?)
                .add_directive("reebe_engine=info".parse()?)
                .add_directive("reebe_api=info".parse()?),
        )
        .init();

    let cli = Cli::parse();

    info!(
        version = env!("CARGO_PKG_VERSION"),
        "Starting Reebe workflow engine server"
    );

    // Load config from file or defaults
    let mut cfg = load_config(&cli.config);

    // Override with CLI/env
    cfg.server.port = cli.port;

    #[cfg(feature = "embedded")]
    if cli.embedded && cli.database_url.is_none() {
        let data_dir = directories::ProjectDirs::from("", "", "reebe")
            .map(|p| p.data_dir().to_owned())
            .unwrap_or_else(|| std::path::PathBuf::from(".reebe"));
        std::fs::create_dir_all(&data_dir)
            .expect("failed to create embedded database directory");
        let db_path = data_dir.join("reebe.db");
        cfg.database.url = format!("sqlite://{}", db_path.display());
        info!(path = %db_path.display(), "Using embedded SQLite database");
    }

    if let Some(url) = cli.database_url {
        cfg.database.url = url;
    }

    info!(port = cfg.server.port, "Configuration loaded");

    // Connect to database
    let db_config = reebe_db::DbConfig::from(&cfg.database);
    let pool = reebe_db::create_pool(&db_config).await?;
    info!("Connected to database");

    // Connect to read replica if configured.
    let replica_pool: Option<reebe_db::DbPool> = if let Some(ref replica_url) = cfg.database.replica_url {
        match reebe_db::pool::create_replica_pool(&db_config, replica_url).await {
            Ok(p) => {
                info!("Connected to read replica");
                Some(p)
            }
            Err(e) => {
                tracing::warn!("Could not connect to read replica: {}; all reads go to primary", e);
                None
            }
        }
    } else {
        None
    };

    // Run migrations
    reebe_db::pool::run_migrations(&pool).await?;
    info!("Database migrations applied");

    // Create one engine per partition.
    let partition_count = cfg.engine.partition_count as usize;
    let mut engine_handles: Vec<Arc<reebe_engine::EngineHandle>> = Vec::new();

    // Partition IDs are 1-based to match Zeebe's convention and existing seed data.
    let backend = std::sync::Arc::new(reebe_db::SqlxBackend::new(pool.clone()));
    for pid in 1..=(partition_count as i16) {
        reebe_engine::replay::check_and_log_replay_status(&pool, pid).await;
        let (engine, handle) = reebe_engine::Engine::new(backend.clone(), pid, Arc::new(reebe_engine::RealClock));
        let engine = Arc::new(engine);
        let engine_clone = engine.clone();
        tokio::spawn(async move {
            engine_clone.run().await;
        });
        engine_handles.push(Arc::new(handle));
    }

    let primary_engine = engine_handles[0].clone();

    // Start one scheduler per partition.
    for handle in &engine_handles {
        let scheduler = reebe_engine::scheduler::Scheduler::new(
            backend.clone(),
            (**handle).clone(),
            Arc::new(reebe_engine::RealClock),
        );
        tokio::spawn(async move {
            scheduler.run().await;
        });
    }

    // Create HTTP app
    let app = reebe_api::create_app(
        primary_engine.clone(),
        engine_handles,
        partition_count,
        pool.clone(),
        replica_pool,
        cfg.auth,
    ).await;

    // Start gRPC server on port 26500 (Zeebe standard gRPC port)
    let grpc_state = reebe_grpc::GatewayState {
        engine: primary_engine,
        pool,
        partition_count,
    };
    let grpc_host = cfg.server.host.clone();
    tokio::spawn(async move {
        let grpc_addr: std::net::SocketAddr = format!("{}:26500", grpc_host)
            .parse()
            .expect("invalid gRPC address");
        info!(addr = %grpc_addr, "gRPC gateway listening");
        if let Err(e) = reebe_grpc::serve(grpc_state, grpc_addr).await {
            tracing::error!("gRPC server error: {}", e);
        }
    });

    // Start HTTP server
    let addr = format!("{}:{}", cfg.server.host, cfg.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!(addr = %addr, "Listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    tracing::info!("HTTP server stopped, shutdown complete");

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c().await.expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received, starting graceful shutdown");
}

fn load_config(path: &str) -> Config {
    // Try reading config file; fall back to defaults
    match std::fs::read_to_string(path) {
        Ok(content) => {
            toml::from_str::<Config>(&content).unwrap_or_else(|e| {
                tracing::warn!("Could not parse config file {}: {}; using defaults", path, e);
                Config::default()
            })
        }
        Err(_) => {
            tracing::info!("Config file {} not found; using defaults", path);
            Config::default()
        }
    }
}
