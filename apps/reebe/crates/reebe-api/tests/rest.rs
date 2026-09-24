//! REST endpoints against a running engine on PostgreSQL: process instance
//! modification.
//!
//! These tests need PostgreSQL, like the engine's `integration` and `compatibility`
//! suites: they skip themselves unless `REEBE_DATABASE__URL` is set (see
//! `reebe-engine/tests/common/mod.rs`).

// The engine suites' Postgres setup; this suite does not stop or restart engines.
#[path = "../../reebe-engine/tests/common/mod.rs"]
#[allow(dead_code)]
mod common;

use std::sync::Arc;
use std::time::Duration;

use base64::Engine as _;
use reebe_api::auth::AuthConfig;
use reebe_db::{SqlxBackend, StateBackend};
use serde_json::{json, Value};

/// start → a → sp[ sp-start → b ] → after → end.
const PROCESS: &str = r#"<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" targetNamespace="t">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="a"><bpmn:extensionElements><zeebe:taskDefinition type="a"/></bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:subProcess id="sp"><bpmn:incoming>f2</bpmn:incoming><bpmn:outgoing>f3</bpmn:outgoing>
      <bpmn:startEvent id="sp-start"><bpmn:outgoing>s1</bpmn:outgoing></bpmn:startEvent>
      <bpmn:serviceTask id="b"><bpmn:extensionElements><zeebe:taskDefinition type="b"/></bpmn:extensionElements>
        <bpmn:incoming>s1</bpmn:incoming></bpmn:serviceTask>
      <bpmn:sequenceFlow id="s1" sourceRef="sp-start" targetRef="b"/>
    </bpmn:subProcess>
    <bpmn:serviceTask id="after"><bpmn:extensionElements><zeebe:taskDefinition type="after"/></bpmn:extensionElements>
      <bpmn:incoming>f3</bpmn:incoming><bpmn:outgoing>f4</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:endEvent id="end"><bpmn:incoming>f4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="a"/>
    <bpmn:sequenceFlow id="f2" sourceRef="a" targetRef="sp"/>
    <bpmn:sequenceFlow id="f3" sourceRef="sp" targetRef="after"/>
    <bpmn:sequenceFlow id="f4" sourceRef="after" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

struct Setup {
    base: String,
    client: reqwest::Client,
    backend: SqlxBackend,
    engine: Arc<reebe_engine::EngineHandle>,
}

async fn setup() -> Option<Setup> {
    let pool = common::setup_db(5).await?;
    let engine = Arc::new(common::start_engine(pool.clone()));
    let app = reebe_api::create_app(engine.clone(), vec![engine.clone()], 1, pool.clone(), None, AuthConfig::default()).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    Some(Setup { base, client: reqwest::Client::new(), backend: SqlxBackend::new(pool), engine })
}

impl Setup {
    async fn deploy(&self, name: &str, xml: &str) -> Value {
        self.engine
            .send_command(
                "DEPLOYMENT".to_string(),
                "CREATE".to_string(),
                json!({ "resources": [{ "name": name, "content": base64::engine::general_purpose::STANDARD.encode(xml) }] }),
                "<default>".to_string(),
            )
            .await
            .expect("deployment")
    }

    async fn post(&self, path: &str, body: Value) -> (u16, Value) {
        let response = self.client.post(format!("{}{path}", self.base)).json(&body).send().await.unwrap();
        let status = response.status().as_u16();
        let text = response.text().await.unwrap();
        (status, serde_json::from_str(&text).unwrap_or(Value::String(text)))
    }

    async fn start(&self) -> i64 {
        let (status, body) = self.post("/v2/process-instances", json!({ "bpmnProcessId": "proc" })).await;
        assert!(status < 300, "{status} {body}");
        body["processInstanceKey"].as_str().and_then(|k| k.parse().ok()).or_else(|| body["processInstanceKey"].as_i64()).unwrap()
    }

    /// Wait until the element instance of `element_id` is in `state`.
    async fn element(&self, pi: i64, element_id: &str, state: &str) -> reebe_db::state::element_instances::ElementInstance {
        for _ in 0..100 {
            let found = self.backend.get_element_instances_by_process_instance(pi).await.unwrap_or_default()
                .into_iter()
                .find(|e| e.element_id == element_id && e.state == state);
            if let Some(found) = found {
                return found;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("{element_id} never reached {state}");
    }
}

#[tokio::test]
async fn modification_activates_and_terminates_over_rest() {
    let Some(s) = setup().await else { return };
    s.deploy("proc.bpmn", PROCESS).await;
    let pi = s.start().await;
    let a = s.element(pi, "a", "ACTIVATED").await;

    let (status, body) = s.post(&format!("/v2/process-instances/{pi}/modification"), json!({
        "activateInstructions": [{
            "elementId": "b",
            "variableInstructions": [{ "scopeId": "sp", "variables": { "inSp": 1 } }, { "variables": { "global": 2 } }],
        }],
        "terminateInstructions": [{ "elementInstanceKey": a.key.to_string() }],
    })).await;
    assert_eq!(status, 204, "{body}");
    s.element(pi, "a", "TERMINATED").await;
    let sp = s.element(pi, "sp", "ACTIVATED").await;
    s.element(pi, "b", "ACTIVATED").await;
    let in_sp = s.backend.get_variables_by_scope(sp.key).await.unwrap();
    assert!(in_sp.iter().any(|v| v.name == "inSp" && v.value == json!(1)), "{in_sp:?}");
    let global = s.backend.get_variables_by_scope(pi).await.unwrap();
    assert!(global.iter().any(|v| v.name == "global" && v.value == json!(2)), "{global:?}");

    // The 8.9 move instruction: b moves out of the sub-process, which is left with
    // nothing to do and terminated.
    let (status, body) = s.post(&format!("/v2/process-instances/{pi}/modification"), json!({
        "moveInstructions": [{
            "sourceElementInstruction": { "sourceType": "byId", "sourceElementId": "b" },
            "targetElementId": "after",
            "ancestorScopeInstruction": { "ancestorScopeType": "inferred" },
        }],
    })).await;
    assert_eq!(status, 204, "{body}");
    s.element(pi, "b", "TERMINATED").await;
    s.element(pi, "sp", "TERMINATED").await;
    s.element(pi, "after", "ACTIVATED").await;
}

#[tokio::test]
async fn modification_rejections_over_rest() {
    let Some(s) = setup().await else { return };
    s.deploy("proc.bpmn", PROCESS).await;
    let pi = s.start().await;
    s.element(pi, "a", "ACTIVATED").await;

    let (status, body) = s.post("/v2/process-instances/12345/modification", json!({ "activateInstructions": [{ "elementId": "b" }] })).await;
    assert_eq!(status, 404, "{body}");
    assert_eq!(body["detail"], "Expected to modify process instance but no process instance found with key '12345'");

    let (status, body) = s.post(&format!("/v2/process-instances/{pi}/modification"), json!({ "activateInstructions": [{ "elementId": "ghost" }] })).await;
    assert_eq!(status, 400, "{body}");
    assert_eq!(
        body["detail"],
        "Expected to modify instance of process 'proc' but it contains one or more activate instructions with an element that could not be found: 'ghost'",
    );

    // The gateway's own checks, as Zeebe's ProcessInstanceRequestValidator makes them (it
    // joins them with ". " and adds a "." when the last does not end with one).
    let (status, body) = s.post(&format!("/v2/process-instances/{pi}/modification"), json!({
        "activateInstructions": [{ "variableInstructions": [{ "variables": {} }] }],
        "terminateInstructions": [{ "elementInstanceKey": "not-a-key" }],
    })).await;
    assert_eq!(status, 400, "{body}");
    assert_eq!(
        body["detail"],
        "No elementId provided. No variables provided. The provided elementInstanceKey 'not-a-key' is not a valid key. \
         Expected a numeric value. Did you pass an entity id instead of an entity key?.",
    );
    s.element(pi, "a", "ACTIVATED").await;
}
