//! Throughput benchmark: measures process instance creation rate.
//!
//! Requires a live PostgreSQL database via `REEBE_DATABASE__URL`.
//! Run with:
//!   REEBE_DATABASE__URL=postgres://reebe:reebe@localhost:5432/reebe \
//!     cargo bench -p reebe-engine --bench throughput
//!
//! The benchmark deploys a minimal start→end BPMN (no service tasks) and
//! measures how many process instances per second the engine can sustain.

use std::sync::Arc;

use base64::Engine as Base64Engine;
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use reebe_db::{create_pool, DbConfig, DbPool, SqlxBackend};
use reebe_engine::{Engine, EngineHandle, RealClock};

// ---------------------------------------------------------------------------
// Minimal BPMN: StartEvent → EndEvent, no tasks, completes immediately.
// ---------------------------------------------------------------------------
const INSTANT_PROCESS_BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="bench-instant" name="Bench Instant" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow1</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn bpmn_base64(xml: &str) -> String {
    base64::engine::general_purpose::STANDARD.encode(xml.as_bytes())
}

async fn setup() -> Option<(DbPool, EngineHandle)> {
    let url = std::env::var("REEBE_DATABASE__URL").ok()?;
    let pool = create_pool(&DbConfig {
        url,
        max_connections: 20,
        min_connections: 2,
        connection_timeout_secs: 5,
    })
    .await
    .ok()?;
    reebe_db::pool::run_migrations(&pool).await.ok()?;

    let (engine, handle) = Engine::new(Arc::new(SqlxBackend::new(pool.clone())), 1, Arc::new(RealClock));
    tokio::spawn(Arc::new(engine).run());

    // Deploy the benchmark process once.
    handle
        .send_command(
            "DEPLOYMENT".to_string(),
            "CREATE".to_string(),
            serde_json::json!({
                "resources": [{"name": "bench-instant.bpmn", "content": bpmn_base64(INSTANT_PROCESS_BPMN)}]
            }),
            "<default>".to_string(),
        )
        .await
        .ok()?;

    Some((pool, handle))
}

// ---------------------------------------------------------------------------
// Benchmark: create N instances sequentially and measure latency per instance
// ---------------------------------------------------------------------------
fn bench_sequential(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let Some((_pool, handle)) = rt.block_on(setup()) else {
        eprintln!("REEBE_DATABASE__URL not set — skipping throughput benchmark");
        return;
    };

    let mut group = c.benchmark_group("process_instance_creation");
    group.throughput(Throughput::Elements(1));
    group.sample_size(200);

    group.bench_function("sequential", |b| {
        b.to_async(&rt).iter(|| async {
            handle
                .send_command(
                    "PROCESS_INSTANCE_CREATION".to_string(),
                    "CREATE".to_string(),
                    serde_json::json!({
                        "bpmnProcessId": "bench-instant",
                        "version": -1,
                        "variables": {},
                    }),
                    "<default>".to_string(),
                )
                .await
                .expect("create instance")
        });
    });

    group.finish();
}

// ---------------------------------------------------------------------------
// Benchmark: create batches of concurrent instances and measure batch throughput
// ---------------------------------------------------------------------------
fn bench_concurrent(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let Some((_pool, handle)) = rt.block_on(setup()) else {
        eprintln!("REEBE_DATABASE__URL not set — skipping throughput benchmark");
        return;
    };

    let mut group = c.benchmark_group("process_instance_burst");

    for batch_size in [10u64, 50, 100, 500, 1000] {
        group.throughput(Throughput::Elements(batch_size));
        group.sample_size(20);

        group.bench_with_input(
            BenchmarkId::new("concurrent", batch_size),
            &batch_size,
            |b, &n| {
                b.to_async(&rt).iter(|| {
                    let handle = handle.clone();
                    async move {
                        let futs: Vec<_> = (0..n)
                            .map(|_| {
                                let h = handle.clone();
                                tokio::spawn(async move {
                                    h.send_command(
                                        "PROCESS_INSTANCE_CREATION".to_string(),
                                        "CREATE".to_string(),
                                        serde_json::json!({
                                            "bpmnProcessId": "bench-instant",
                                            "version": -1,
                                            "variables": {},
                                        }),
                                        "<default>".to_string(),
                                    )
                                    .await
                                    .expect("create instance")
                                })
                            })
                            .collect();
                        for f in futs {
                            f.await.expect("task join");
                        }
                    }
                });
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_sequential, bench_concurrent);
criterion_main!(benches);
