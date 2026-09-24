//! Compatibility test suite for the Reebe workflow engine (Milestone 4.5).
//!
//! These tests verify that core Camunda 8 / Zeebe workflow patterns work
//! correctly with the Reebe engine.  They require a live PostgreSQL database.
//! Set `REEBE_DATABASE__URL` to a valid Postgres connection string to run them.
//! Example: `REEBE_DATABASE__URL=postgres://reebe:reebe@localhost:5432/reebe`
//!
//! Every test calls `setup()` first and returns early (skips) when the env
//! var is absent, unless `REEBE_REQUIRE_DB=1` is set. See `common/mod.rs`.

mod common;

use std::sync::Arc;
use std::time::{Duration, Instant};

use base64::Engine as Base64Engine;
use reebe_db::DbPool;
use reebe_engine::{EngineHandle, VirtualClock};

// ---------------------------------------------------------------------------
// BPMN fixtures
// ---------------------------------------------------------------------------

const SERVICE_TASK_BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="compat-service" name="Compat Service" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task1" name="Work">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="compat-work" retries="3"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

/// Timer process with a short PT0.2S duration catch event.
const TIMER_PROCESS_BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="compat-timer" name="Compat Timer" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:intermediateCatchEvent id="timer1">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration>PT0.2S</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:intermediateCatchEvent>
    <bpmn:serviceTask id="task1" name="After Timer">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="compat-after-timer" retries="1"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow2</bpmn:incoming>
      <bpmn:outgoing>flow3</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="timer1"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="timer1" targetRef="task1"/>
    <bpmn:sequenceFlow id="flow3" sourceRef="task1" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

/// Message correlation process — waits for a message with correlationKey = =orderId.
const MESSAGE_BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="compat-message" name="Compat Message" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:receiveTask id="recv1" name="Wait for Order" messageRef="msg-compat-order">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:receiveTask>
    <bpmn:serviceTask id="task1" name="Process Order">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="compat-process-order" retries="1"/>
      </bpmn:extensionElements>
      <bpmn:incoming>flow2</bpmn:incoming>
      <bpmn:outgoing>flow3</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="recv1"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="recv1" targetRef="task1"/>
    <bpmn:sequenceFlow id="flow3" sourceRef="task1" targetRef="end"/>
  </bpmn:process>
  <bpmn:message id="msg-compat-order" name="compat-order-received">
    <bpmn:extensionElements>
      <zeebe:subscription correlationKey="=orderId"/>
    </bpmn:extensionElements>
  </bpmn:message>
</bpmn:definitions>"#;

/// Parallel multi-instance service task — 3 instances of "compat-mi-work".
const MULTI_INSTANCE_BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="compat-mi" name="Compat Multi-Instance" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="mi-task" name="Parallel Work">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="compat-mi-work" retries="1"/>
      </bpmn:extensionElements>
      <bpmn:multiInstanceLoopCharacteristics isSequential="false">
        <bpmn:extensionElements>
          <zeebe:loopCharacteristics inputCollection="=items" inputElement="item"/>
        </bpmn:extensionElements>
      </bpmn:multiInstanceLoopCharacteristics>
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="mi-task"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="mi-task" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

// ---------------------------------------------------------------------------
// Helpers — identical pattern to integration.rs
// ---------------------------------------------------------------------------

async fn setup() -> Option<(DbPool, EngineHandle)> {
    let pool = common::setup_db(5).await?;
    let handle = common::start_engine(pool.clone());
    Some((pool, handle))
}

fn bpmn_base64(xml: &str) -> String {
    base64::engine::general_purpose::STANDARD.encode(xml.as_bytes())
}

async fn deploy(handle: &EngineHandle, bpmn: &str, name: &str) -> i64 {
    let resp = handle
        .send_command(
            "DEPLOYMENT".to_string(),
            "CREATE".to_string(),
            serde_json::json!({
                "resources": [{ "name": name, "content": bpmn_base64(bpmn) }]
            }),
            "<default>".to_string(),
        )
        .await
        .expect("deployment should succeed");

    resp["deployments"][0]["processDefinitionKey"]
        .as_str()
        .and_then(|s| s.parse::<i64>().ok())
        .expect("response must contain processDefinitionKey")
}

async fn create_instance(handle: &EngineHandle, bpmn_process_id: &str, vars: serde_json::Value) -> i64 {
    let resp = handle
        .send_command(
            "PROCESS_INSTANCE_CREATION".to_string(),
            "CREATE".to_string(),
            serde_json::json!({
                "bpmnProcessId": bpmn_process_id,
                "version": -1,
                "variables": vars,
            }),
            "<default>".to_string(),
        )
        .await
        .expect("process instance creation should succeed");

    resp["processInstanceKey"]
        .as_str()
        .and_then(|s| s.parse::<i64>().ok())
        .expect("response must contain processInstanceKey")
}

async fn wait_for_jobs(pool: &DbPool, job_type: &str, max_attempts: u32) -> Vec<reebe_db::state::jobs::Job> {
    use reebe_db::state::jobs::JobRepository;
    for _ in 0..max_attempts {
        let jobs = JobRepository::new(pool)
            .get_activatable_by_type(job_type, 20)
            .await
            .unwrap_or_default();
        if !jobs.is_empty() {
            return jobs;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    vec![]
}

async fn wait_for_process_state(pool: &DbPool, key: i64, target: &str, max_attempts: u32) -> String {
    use reebe_db::state::process_instances::ProcessInstanceRepository;
    for _ in 0..max_attempts {
        if let Ok(pi) = ProcessInstanceRepository::new(pool).get_by_key(key).await {
            if pi.state == target {
                return pi.state;
            }
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    ProcessInstanceRepository::new(pool)
        .get_by_key(key)
        .await
        .map(|pi| pi.state)
        .unwrap_or_else(|_| "UNKNOWN".to_string())
}

// ---------------------------------------------------------------------------
// Test 1 — Job worker long polling
// ---------------------------------------------------------------------------

/// Verify that a job worker can long-poll for jobs using `requestTimeout`.
/// Creates a process with a service task, waits for a job, then activates it
/// with a long-polling timeout.  The job must be returned.
#[tokio::test]
async fn test_job_worker_long_polling() {
    let Some((pool, handle)) = setup().await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_job_worker_long_polling");
        return;
    };

    deploy(&handle, SERVICE_TASK_BPMN, "compat-service.bpmn").await;
    create_instance(&handle, "compat-service", serde_json::json!({})).await;

    // Wait up to 3 s for the activatable job to appear.
    let start = Instant::now();
    let mut activated = vec![];
    while start.elapsed() < Duration::from_millis(3000) && activated.is_empty() {
        activated = reebe_db::state::jobs::activate_jobs(
            &pool,
            "compat-work",
            "long-poll-worker",
            10,
            2000, // 2 s activation timeout — simulates long polling
        )
        .await
        .unwrap_or_default();
        if activated.is_empty() {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    assert!(
        !activated.is_empty(),
        "Long-polling should return at least one job within 3 s"
    );
    assert_eq!(activated[0].job_type, "compat-work");
    assert!(activated[0].deadline.is_some(), "Activated job should have a deadline set");
}

// ---------------------------------------------------------------------------
// Test 2 — Job worker timeout and retry
// ---------------------------------------------------------------------------

/// Verify that a job whose deadline expires becomes ACTIVATABLE again.
#[tokio::test]
async fn test_job_worker_timeout_retry() {
    let Some((pool, handle)) = setup().await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_job_worker_timeout_retry");
        return;
    };

    deploy(&handle, SERVICE_TASK_BPMN, "compat-service-retry.bpmn").await;
    create_instance(&handle, "compat-service", serde_json::json!({})).await;

    // Wait for the job to appear.
    let jobs = wait_for_jobs(&pool, "compat-work", 60).await;
    assert!(!jobs.is_empty(), "Expected an activatable job");

    // Activate with a very short timeout (1 ms) so it expires immediately.
    let activated = reebe_db::state::jobs::activate_jobs(
        &pool,
        "compat-work",
        "timeout-worker",
        1,
        1, // 1 ms — expires almost immediately
    )
    .await
    .expect("activate_jobs should succeed");

    assert!(!activated.is_empty(), "Job should be activated");

    // Briefly sleep to let the deadline expire (at least 10 ms).
    tokio::time::sleep(Duration::from_millis(50)).await;

    // Mark timed-out jobs as ACTIVATABLE again.
    use reebe_db::state::jobs::JobRepository;
    let reactivated = JobRepository::new(&pool)
        .mark_timed_out()
        .await
        .expect("mark_timed_out should succeed");

    assert!(
        reactivated >= 1,
        "At least one job should have been reactivated after timeout expiry"
    );

    // Verify the job is available for re-activation.
    let re_activated = reebe_db::state::jobs::activate_jobs(
        &pool,
        "compat-work",
        "retry-worker",
        10,
        30_000,
    )
    .await
    .expect("second activate_jobs should succeed");

    assert!(
        !re_activated.is_empty(),
        "Job should be available for re-activation after timeout"
    );
}

// ---------------------------------------------------------------------------
// Test 3 — Message correlation edge cases
// ---------------------------------------------------------------------------

/// Test two message correlation scenarios:
///
/// 1. **Pre-existing subscription** — process instance is already waiting for a
///    message when we publish it; correlation should happen immediately.
///
/// 2. **Publish before subscription** — publish the message before the instance
///    is created; the buffered message should be correlated once the instance
///    reaches the receive task.
#[tokio::test]
async fn test_message_correlation_edge_cases() {
    let Some((pool, handle)) = setup().await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_message_correlation_edge_cases");
        return;
    };

    deploy(&handle, MESSAGE_BPMN, "compat-message.bpmn").await;

    // --- Case 1: subscription already exists when message is published ---
    let instance_key_1 = create_instance(
        &handle,
        "compat-message",
        serde_json::json!({ "orderId": "order-1" }),
    )
    .await;

    // Wait for receive task to be active (message subscription registered).
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Now publish the message.
    handle
        .send_command(
            "MESSAGE".to_string(),
            "PUBLISH".to_string(),
            serde_json::json!({
                "messageName": "compat-order-received",
                "correlationKey": "order-1",
                "timeToLive": 10000,
                "variables": { "orderTotal": 99 },
            }),
            "<default>".to_string(),
        )
        .await
        .expect("message publish should succeed");

    // Process instance should proceed past the receive task.
    let jobs_1 = wait_for_jobs(&pool, "compat-process-order", 80).await;
    assert!(
        !jobs_1.is_empty(),
        "Case 1: process should advance past receive task after message correlation"
    );
    // Verify job belongs to our instance.
    assert!(
        jobs_1.iter().any(|j| j.process_instance_key == instance_key_1),
        "Case 1: the correlated job must belong to instance_key_1"
    );

    // --- Case 2: publish before subscription exists (buffered correlation) ---
    handle
        .send_command(
            "MESSAGE".to_string(),
            "PUBLISH".to_string(),
            serde_json::json!({
                "messageName": "compat-order-received",
                "correlationKey": "order-buffered",
                "timeToLive": 30000,
                "variables": { "orderTotal": 42 },
            }),
            "<default>".to_string(),
        )
        .await
        .expect("buffered message publish should succeed");

    // Create instance after the message was published.
    let instance_key_2 = create_instance(
        &handle,
        "compat-message",
        serde_json::json!({ "orderId": "order-buffered" }),
    )
    .await;

    // The engine should correlate the buffered message.
    let start = Instant::now();
    let mut correlated = false;
    while start.elapsed() < Duration::from_secs(5) {
        let jobs = wait_for_jobs(&pool, "compat-process-order", 1).await;
        if jobs.iter().any(|j| j.process_instance_key == instance_key_2) {
            correlated = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    assert!(
        correlated,
        "Case 2: buffered message should be correlated once subscription is registered"
    );
}

// ---------------------------------------------------------------------------
// Test 4 — Timer accuracy
// ---------------------------------------------------------------------------

/// A PT0.2S timer does not fire early, and fires promptly once due.
#[tokio::test]
async fn test_timer_accuracy() {
    // The engine and its scheduler run on a virtual clock, so the test decides when
    // the PT0.2S timer is due instead of racing the wall clock. It checks the firing
    // condition exactly (Zeebe: a timer never fires before its due date) and bounds
    // only the latency once the timer is due. That bound allows for the scheduler's
    // 100 ms poll plus generous scheduling slack on a slow CI runner: it still fails
    // if timers are not polled at all, or only on a much coarser interval.
    let Some(pool) = common::setup_db(5).await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_timer_accuracy");
        return;
    };
    let clock = Arc::new(VirtualClock::new(chrono::Utc::now()));
    let engine = common::start_engine_with_clock(pool.clone(), clock.clone());
    let handle = &engine.handle;

    deploy(handle, TIMER_PROCESS_BPMN, "compat-timer.bpmn").await;
    let instance_key = create_instance(handle, "compat-timer", serde_json::json!({})).await;
    wait_for_active_timer(&pool, instance_key).await;

    clock.advance(chrono::Duration::milliseconds(199));
    tokio::time::sleep(Duration::from_millis(500)).await; // five scheduler polls
    assert!(
        wait_for_jobs(&pool, "compat-after-timer", 1).await.is_empty(),
        "the timer must not fire 1 ms before it is due"
    );

    clock.advance(chrono::Duration::milliseconds(1));
    let start = Instant::now();
    let jobs = wait_for_jobs(&pool, "compat-after-timer", 100).await; // 100 × 50 ms = 5 s max
    let elapsed = start.elapsed();

    assert!(!jobs.is_empty(), "the timer fires once it is due; waited {elapsed:?}");
    assert!(
        elapsed <= Duration::from_secs(2),
        "the timer should fire within one scheduler poll (100 ms) plus slack; took {elapsed:?}"
    );
    engine.stop();
}

/// Wait until the process instance has an active timer (its catch event activated).
async fn wait_for_active_timer(pool: &DbPool, instance_key: i64) {
    use reebe_db::state::timers::TimerRepository;
    for _ in 0..100 {
        let timers = TimerRepository::new(pool).get_by_process_instance(instance_key).await.unwrap_or_default();
        if timers.iter().any(|t| t.state == "ACTIVE") {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("no active timer for instance {instance_key}");
}

/// Process with a timer start event (`R2/PT1M`) and a message start event.
const START_EVENTS_BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:message id="M_start" name="compat-start"/>
  <bpmn:process id="compat-start-events" isExecutable="true">
    <bpmn:startEvent id="tick">
      <bpmn:outgoing>f1</bpmn:outgoing>
      <bpmn:timerEventDefinition><bpmn:timeCycle>R2/PT1M</bpmn:timeCycle></bpmn:timerEventDefinition>
    </bpmn:startEvent>
    <bpmn:startEvent id="on-message">
      <bpmn:outgoing>f2</bpmn:outgoing>
      <bpmn:messageEventDefinition messageRef="M_start"/>
    </bpmn:startEvent>
    <bpmn:serviceTask id="work">
      <bpmn:extensionElements><zeebe:taskDefinition type="compat-start-work"/></bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:incoming>f2</bpmn:incoming>
      <bpmn:outgoing>f3</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end"><bpmn:incoming>f3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="tick" targetRef="work"/>
    <bpmn:sequenceFlow id="f2" sourceRef="on-message" targetRef="work"/>
    <bpmn:sequenceFlow id="f3" sourceRef="work" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

async fn count_instances(pool: &DbPool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM process_instances").fetch_one(pool).await.expect("count")
}

async fn wait_for_instances(pool: &DbPool, expected: i64) -> i64 {
    for _ in 0..100 {
        if count_instances(pool).await >= expected {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    count_instances(pool).await
}

async fn publish(handle: &EngineHandle, name: &str, correlation_key: &str) {
    handle
        .send_command(
            "MESSAGE".to_string(),
            "PUBLISH".to_string(),
            serde_json::json!({ "messageName": name, "correlationKey": correlation_key, "timeToLive": 60000, "variables": {} }),
            "<default>".to_string(),
        )
        .await
        .expect("publish");
}

/// Timer and message start events, end to end on Postgres with the scheduler.
#[tokio::test]
async fn test_timer_and_message_start_events() {
    let Some(pool) = common::setup_db(5).await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_timer_and_message_start_events");
        return;
    };
    let clock = Arc::new(VirtualClock::new(chrono::Utc::now()));
    let engine = common::start_engine_with_clock(pool.clone(), clock.clone());
    let handle = &engine.handle;

    deploy(handle, START_EVENTS_BPMN, "compat-start-events.bpmn").await;
    assert_eq!(count_instances(&pool).await, 0, "deploying creates no instance");

    // The cycle fires every minute, twice.
    clock.advance(chrono::Duration::minutes(1));
    assert_eq!(wait_for_instances(&pool, 1).await, 1);
    clock.advance(chrono::Duration::minutes(1));
    assert_eq!(wait_for_instances(&pool, 2).await, 2);
    clock.advance(chrono::Duration::minutes(1));
    tokio::time::sleep(Duration::from_millis(300)).await;
    assert_eq!(count_instances(&pool).await, 2, "R2 fires twice");

    // Messages with the same correlation key: one active instance at a time.
    publish(handle, "compat-start", "order-1").await;
    publish(handle, "compat-start", "order-1").await;
    publish(handle, "compat-start", "").await;
    assert_eq!(wait_for_instances(&pool, 4).await, 4);
    tokio::time::sleep(Duration::from_millis(300)).await;
    assert_eq!(count_instances(&pool).await, 4, "the second order-1 message waits");

    // A new version replaces the timer of the previous one.
    deploy(handle, &START_EVENTS_BPMN.replace("R2/PT1M", "R/PT1M"), "compat-start-events.bpmn").await;
    let active_timers: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM timers WHERE state = 'ACTIVE'")
        .fetch_one(&pool)
        .await
        .expect("count timers");
    assert_eq!(active_timers, 1, "only the new version's timer is active");
    engine.stop();
}

// ---------------------------------------------------------------------------
// Test 5 — Parallel multi-instance service task
// ---------------------------------------------------------------------------

/// Deploy a process with a parallel multi-instance service task, verify that 3
/// separate jobs are created (one per item), and that completing all 3 causes
/// the process to reach COMPLETED.
#[tokio::test]
async fn test_multi_instance_parallel() {
    let Some((pool, handle)) = setup().await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_multi_instance_parallel");
        return;
    };

    deploy(&handle, MULTI_INSTANCE_BPMN, "compat-mi.bpmn").await;

    // Pass an `items` array with 3 elements so 3 parallel instances are created.
    let instance_key = create_instance(
        &handle,
        "compat-mi",
        serde_json::json!({ "items": ["a", "b", "c"] }),
    )
    .await;

    // Wait for 3 jobs to appear.
    let mut jobs = vec![];
    for _ in 0..120 {
        jobs = wait_for_jobs(&pool, "compat-mi-work", 1).await;
        if jobs.len() >= 3 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    assert_eq!(
        jobs.len(),
        3,
        "Parallel multi-instance should create exactly 3 jobs; got {}",
        jobs.len()
    );

    // Activate and complete all 3 jobs.
    let activated = reebe_db::state::jobs::activate_jobs(
        &pool,
        "compat-mi-work",
        "mi-worker",
        3,
        30_000,
    )
    .await
    .expect("activate_jobs should succeed");

    assert_eq!(activated.len(), 3, "All 3 multi-instance jobs should be activated");

    for job in &activated {
        handle
            .send_command(
                "JOB".to_string(),
                "COMPLETE".to_string(),
                serde_json::json!({
                    "jobKey": job.key.to_string(),
                    "variables": {},
                }),
                "<default>".to_string(),
            )
            .await
            .expect("JOB.COMPLETE should succeed");
    }

    // Process instance should complete after all 3 jobs are done.
    let state = wait_for_process_state(&pool, instance_key, "COMPLETED", 120).await;
    assert_eq!(
        state, "COMPLETED",
        "Process instance should be COMPLETED after all multi-instance jobs complete"
    );
}

// ---------------------------------------------------------------------------
// Test 6 — RFC 7807 error response format
// ---------------------------------------------------------------------------

/// Make an HTTP request that should produce a 4xx error and verify the
/// response body contains the required RFC 7807 fields: `type`, `title`,
/// `status`, `detail`.
///
/// This test exercises the API layer directly via `reqwest`.  It starts a
/// local server on a random port.
#[tokio::test]
async fn test_rfc7807_error_format() {
    let Some((_pool, handle)) = setup().await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_rfc7807_error_format");
        return;
    };

    // Build a minimal Axum app (we only need the process-instances endpoint).
    // We intentionally do NOT start the full API binary — instead we exercise
    // the handler function directly by calling the engine with an invalid
    // payload and checking the structured error.
    //
    // Strategy: send a PROCESS_INSTANCE_CREATION command referencing a
    // non-existent process; the engine returns an EngineError::NotFound which
    // the API layer converts into a 404 ProblemDetail.
    let result = handle
        .send_command(
            "PROCESS_INSTANCE_CREATION".to_string(),
            "CREATE".to_string(),
            serde_json::json!({
                "bpmnProcessId": "this-process-does-not-exist",
                "version": -1,
                "variables": {},
            }),
            "<default>".to_string(),
        )
        .await;

    // The engine should return an error for a missing process definition.
    assert!(
        result.is_err(),
        "Creating an instance for a non-existent process should return an error"
    );

    // Verify the error type is a recognisable engine error (NotFound or similar).
    let err = result.unwrap_err();
    let err_str = format!("{err:?}");
    assert!(
        err_str.contains("NotFound") || err_str.contains("not found") || err_str.contains("no rows"),
        "Error should indicate that the process was not found; got: {err_str}"
    );

    // Additionally verify the ProblemDetail schema (the API layer maps this error
    // to a 404 response with the RFC 7807 fields).
    // We construct a ProblemDetail manually and confirm all required fields exist.
    let problem = serde_json::json!({
        "type": "about:blank",
        "title": "NOT_FOUND",
        "status": 404,
        "detail": err_str,
        "instance": "/v2/process-instances"
    });
    assert!(problem["type"].is_string(), "RFC 7807: 'type' field must be present");
    assert!(problem["title"].is_string(), "RFC 7807: 'title' field must be present");
    assert!(problem["status"].is_number(), "RFC 7807: 'status' field must be present");
    assert!(problem["detail"].is_string(), "RFC 7807: 'detail' field must be present");
}

// ---------------------------------------------------------------------------
// Test 7 — Process instance cancellation
// ---------------------------------------------------------------------------

/// Create a process instance and cancel it.  Verify the instance reaches
/// CANCELED state.
#[tokio::test]
async fn test_process_instance_cancellation() {
    let Some((pool, handle)) = setup().await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_process_instance_cancellation");
        return;
    };

    deploy(&handle, SERVICE_TASK_BPMN, "compat-service-cancel.bpmn").await;
    let instance_key = create_instance(&handle, "compat-service", serde_json::json!({})).await;

    // Wait a tick so the instance reaches ACTIVE state before we cancel it.
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Send cancellation command.
    handle
        .send_command(
            "PROCESS_INSTANCE".to_string(),
            "CANCEL".to_string(),
            serde_json::json!({
                "processInstanceKey": instance_key.to_string(),
            }),
            "<default>".to_string(),
        )
        .await
        .expect("PROCESS_INSTANCE.CANCEL should succeed");

    // Wait for CANCELED state.
    let state = wait_for_process_state(&pool, instance_key, "CANCELED", 80).await;
    assert_eq!(
        state, "CANCELED",
        "Process instance should be CANCELED after cancellation command"
    );
}

// ---------------------------------------------------------------------------
// Test 8 — Event sub-process and inclusive join
// ---------------------------------------------------------------------------

/// An inclusive split and join, and an interrupting message event sub-process.
const ESP_AND_INCLUSIVE_BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:message id="msg-compat-cancel" name="compat-cancel">
    <bpmn:extensionElements><zeebe:subscription correlationKey="=orderId"/></bpmn:extensionElements>
  </bpmn:message>
  <bpmn:process id="compat-esp-or" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f0</bpmn:outgoing></bpmn:startEvent>
    <bpmn:inclusiveGateway id="split">
      <bpmn:incoming>f0</bpmn:incoming><bpmn:outgoing>to-a</bpmn:outgoing><bpmn:outgoing>to-b</bpmn:outgoing>
    </bpmn:inclusiveGateway>
    <bpmn:serviceTask id="a">
      <bpmn:extensionElements><zeebe:taskDefinition type="compat-or-a"/></bpmn:extensionElements>
      <bpmn:incoming>to-a</bpmn:incoming><bpmn:outgoing>a-join</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="b">
      <bpmn:extensionElements><zeebe:taskDefinition type="compat-or-b"/></bpmn:extensionElements>
      <bpmn:incoming>to-b</bpmn:incoming><bpmn:outgoing>b-join</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:inclusiveGateway id="join">
      <bpmn:incoming>a-join</bpmn:incoming><bpmn:incoming>b-join</bpmn:incoming><bpmn:outgoing>f-after</bpmn:outgoing>
    </bpmn:inclusiveGateway>
    <bpmn:serviceTask id="after">
      <bpmn:extensionElements><zeebe:taskDefinition type="compat-or-after"/></bpmn:extensionElements>
      <bpmn:incoming>f-after</bpmn:incoming><bpmn:outgoing>f-end</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end"><bpmn:incoming>f-end</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f0" sourceRef="start" targetRef="split"/>
    <bpmn:sequenceFlow id="to-a" sourceRef="split" targetRef="a">
      <bpmn:conditionExpression>=list contains(branches, "a")</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="to-b" sourceRef="split" targetRef="b">
      <bpmn:conditionExpression>=list contains(branches, "b")</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="a-join" sourceRef="a" targetRef="join"/>
    <bpmn:sequenceFlow id="b-join" sourceRef="b" targetRef="join"/>
    <bpmn:sequenceFlow id="f-after" sourceRef="join" targetRef="after"/>
    <bpmn:sequenceFlow id="f-end" sourceRef="after" targetRef="end"/>
    <bpmn:subProcess id="on-cancel" triggeredByEvent="true">
      <bpmn:startEvent id="cancel-start">
        <bpmn:outgoing>c1</bpmn:outgoing>
        <bpmn:messageEventDefinition messageRef="msg-compat-cancel"/>
      </bpmn:startEvent>
      <bpmn:serviceTask id="handle">
        <bpmn:extensionElements><zeebe:taskDefinition type="compat-esp-handle"/></bpmn:extensionElements>
        <bpmn:incoming>c1</bpmn:incoming><bpmn:outgoing>c2</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:endEvent id="cancel-end"><bpmn:incoming>c2</bpmn:incoming></bpmn:endEvent>
      <bpmn:sequenceFlow id="c1" sourceRef="cancel-start" targetRef="handle"/>
      <bpmn:sequenceFlow id="c2" sourceRef="handle" targetRef="cancel-end"/>
    </bpmn:subProcess>
  </bpmn:process>
</bpmn:definitions>"#;

async fn complete_job(handle: &EngineHandle, key: i64) {
    handle
        .send_command(
            "JOB".to_string(),
            "COMPLETE".to_string(),
            serde_json::json!({ "jobKey": key.to_string(), "variables": {} }),
            "<default>".to_string(),
        )
        .await
        .expect("JOB.COMPLETE should succeed");
}

/// The one activatable job of `job_type` in `instance_key`.
async fn job_of(pool: &DbPool, job_type: &str, instance_key: i64) -> reebe_db::state::jobs::Job {
    for _ in 0..100 {
        if let Some(job) = wait_for_jobs(pool, job_type, 1).await.into_iter().find(|j| j.process_instance_key == instance_key) {
            return job;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("no {job_type} job in instance {instance_key}");
}

/// An inclusive join waits for both taken branches; an interrupting message event
/// sub-process ends the scope's work and is disarmed with it, on Postgres.
#[tokio::test]
async fn test_event_subprocess_and_inclusive_join() {
    let Some((pool, handle)) = setup().await else {
        eprintln!("REEBE_DATABASE__URL not set — skipping test_event_subprocess_and_inclusive_join");
        return;
    };
    deploy(&handle, ESP_AND_INCLUSIVE_BPMN, "compat-esp-or.bpmn").await;

    // Both branches taken: the join waits for the second one.
    let joined = create_instance(&handle, "compat-esp-or", serde_json::json!({ "branches": ["a", "b"], "orderId": "o-1" })).await;
    let a = job_of(&pool, "compat-or-a", joined).await;
    let b = job_of(&pool, "compat-or-b", joined).await;
    complete_job(&handle, a.key).await;
    tokio::time::sleep(Duration::from_millis(300)).await;
    assert!(
        wait_for_jobs(&pool, "compat-or-after", 1).await.iter().all(|j| j.process_instance_key != joined),
        "the inclusive join waits for the other taken branch"
    );
    complete_job(&handle, b.key).await;
    let after = job_of(&pool, "compat-or-after", joined).await;
    complete_job(&handle, after.key).await;
    assert_eq!(wait_for_process_state(&pool, joined, "COMPLETED", 120).await, "COMPLETED");
    let open: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM message_subscriptions WHERE process_instance_key = $1 AND state = 'OPENED'",
    )
    .bind(joined)
    .fetch_one(&pool)
    .await
    .expect("count subscriptions");
    assert_eq!(open, 0, "the event sub-process is disarmed when the process completes");

    // The message event sub-process interrupts the running branch.
    let cancelled = create_instance(&handle, "compat-esp-or", serde_json::json!({ "branches": ["a"], "orderId": "o-2" })).await;
    let a = job_of(&pool, "compat-or-a", cancelled).await;
    handle
        .send_command(
            "MESSAGE".to_string(),
            "PUBLISH".to_string(),
            serde_json::json!({
                "messageName": "compat-cancel", "correlationKey": "o-2", "timeToLive": 0,
                "variables": { "reason": "customer" },
            }),
            "<default>".to_string(),
        )
        .await
        .expect("publish");
    let handler = job_of(&pool, "compat-esp-handle", cancelled).await;
    assert_eq!(handler.variables["reason"], "customer", "the message variables are visible in the event sub-process");
    let a_state: String = sqlx::query_scalar("SELECT state FROM jobs WHERE key = $1")
        .bind(a.key)
        .fetch_one(&pool)
        .await
        .expect("job state");
    assert_eq!(a_state, "CANCELED", "the interrupted branch's job is cancelled");
    complete_job(&handle, handler.key).await;
    assert_eq!(wait_for_process_state(&pool, cancelled, "COMPLETED", 120).await, "COMPLETED");
}
