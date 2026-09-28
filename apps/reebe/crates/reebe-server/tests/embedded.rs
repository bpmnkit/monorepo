//! The embedded SQLite backend runs DMN: decisions deploy, version and evaluate.
//!
//! Only compiled with the `embedded` feature:
//! `cargo test -p reebe-server --no-default-features --features embedded --test embedded`.
#![cfg(feature = "embedded")]

use std::sync::Arc;

use base64::Engine as _;
use reebe_db::{DbConfig, SqlxBackend, StateBackend};
use reebe_engine::{Engine, EngineHandle, RealClock};
use serde_json::{json, Value};

fn greeting_dmn(greeting: &str) -> String {
    format!(r#"<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="greetings" name="Greetings" namespace="t">
  <decision id="greet" name="Greet">
    <literalExpression><text>"{greeting} " + name</text></literalExpression>
  </decision>
</definitions>"#)
}

const PROCESS: &str = r#"<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" targetNamespace="t">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:businessRuleTask id="decide">
      <bpmn:extensionElements><zeebe:calledDecision decisionId="greet" resultVariable="greeting"/></bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:businessRuleTask>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="decide"/>
    <bpmn:sequenceFlow id="f2" sourceRef="decide" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

async fn command(engine: &EngineHandle, value_type: &str, intent: &str, payload: Value) -> Value {
    engine
        .send_command(value_type.to_string(), intent.to_string(), payload, "<default>".to_string())
        .await
        .unwrap_or_else(|e| panic!("{value_type} {intent}: {e}"))
}

async fn deploy(engine: &EngineHandle, name: &str, xml: &str) -> Value {
    let content = base64::engine::general_purpose::STANDARD.encode(xml);
    command(engine, "DEPLOYMENT", "CREATE", json!({ "resources": [{ "name": name, "content": content }] })).await
}

#[tokio::test]
async fn dmn_deploys_versions_and_evaluates_on_sqlite() {
    let path = std::env::temp_dir().join(format!("reebe-embedded-{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    let config = DbConfig {
        url: format!("sqlite://{}", path.display()),
        max_connections: 4,
        min_connections: 1,
        connection_timeout_secs: 10,
    };
    let pool = reebe_db::create_pool(&config).await.expect("SQLite pool");
    reebe_db::pool::run_migrations(&pool).await.expect("SQLite migrations");
    let backend = Arc::new(SqlxBackend::new(pool));
    let (engine, handle) = Engine::new(backend.clone(), 1, Arc::new(RealClock));
    let running = tokio::spawn(Arc::new(engine).run());

    let v1 = deploy(&handle, "greet.dmn", &greeting_dmn("Hello")).await;
    assert_eq!(v1["decisions"][0]["version"], 1);
    let duplicate = deploy(&handle, "greet.dmn", &greeting_dmn("Hello")).await;
    assert_eq!(duplicate["decisions"][0]["decisionKey"], v1["decisions"][0]["decisionKey"]);
    let v2 = deploy(&handle, "greet.dmn", &greeting_dmn("Hi")).await;
    assert_eq!(v2["decisions"][0]["version"], 2);
    assert_eq!(v2["decisionRequirements"][0]["version"], 2);

    let by_id = command(&handle, "DECISION_EVALUATION", "EVALUATE", json!({ "decisionId": "greet", "variables": { "name": "Ada" } })).await;
    assert_eq!(by_id["decisionOutput"], r#""Hi Ada""#);
    let by_key = command(&handle, "DECISION_EVALUATION", "EVALUATE", json!({
        "decisionKey": v1["decisions"][0]["decisionKey"], "variables": { "name": "Ada" },
    })).await;
    assert_eq!(by_key["decisionOutput"], r#""Hello Ada""#);
    assert_eq!(by_key["decisionRequirementsId"], "greetings");

    // A business rule task evaluates the latest version.
    deploy(&handle, "proc.bpmn", PROCESS).await;
    let created = command(&handle, "PROCESS_INSTANCE_CREATION", "CREATE", json!({
        "bpmnProcessId": "proc", "version": -1, "variables": { "name": "Ada" },
    })).await;
    let pi: i64 = created["processInstanceKey"].as_str().unwrap().parse().unwrap();
    let mut greeting = None;
    for _ in 0..100 {
        greeting = backend.get_variables_by_scope(pi).await.unwrap().into_iter().find(|v| v.name == "greeting").map(|v| v.value);
        if greeting.is_some() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    assert_eq!(greeting, Some(json!("Hi Ada")));

    running.abort();
    let _ = std::fs::remove_file(&path);
}
