//! Every gRPC call that carries a `variables` JSON document hands it to the engine as
//! variables, and rejects a document that is not a JSON object as Zeebe's gateway does.
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
use reebe_db::{DbPool, SqlxBackend, StateBackend};
use reebe_grpc::service::proto::gateway_protocol::gateway_server::Gateway;
use reebe_grpc::service::proto::gateway_protocol::*;
use reebe_grpc::{GatewayService, GatewayState};
use serde_json::{json, Value};
use tonic::{Code, Request};

const DEFINITIONS: &str = r#"<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" targetNamespace="t">"#;

/// start → work (job `work`, error boundary `failed` → end-failed) → wait for message
/// `go` (correlation key `=orderId`) → wait for signal `ping` → end.
fn process() -> String {
    format!(r#"{DEFINITIONS}
  <bpmn:message id="go" name="go"><bpmn:extensionElements><zeebe:subscription correlationKey="=orderId"/></bpmn:extensionElements></bpmn:message>
  <bpmn:signal id="ping" name="ping"/>
  <bpmn:error id="err" errorCode="BROKEN"/>
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="work">
      <bpmn:extensionElements><zeebe:taskDefinition type="work"/></bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="failed" attachedToRef="work"><bpmn:outgoing>f5</bpmn:outgoing>
      <bpmn:errorEventDefinition errorRef="err"/></bpmn:boundaryEvent>
    <bpmn:endEvent id="end-failed"><bpmn:incoming>f5</bpmn:incoming></bpmn:endEvent>
    <bpmn:intermediateCatchEvent id="wait-go"><bpmn:incoming>f2</bpmn:incoming><bpmn:outgoing>f3</bpmn:outgoing>
      <bpmn:messageEventDefinition messageRef="go"/></bpmn:intermediateCatchEvent>
    <bpmn:intermediateCatchEvent id="wait-ping"><bpmn:incoming>f3</bpmn:incoming><bpmn:outgoing>f4</bpmn:outgoing>
      <bpmn:signalEventDefinition signalRef="ping"/></bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="end"><bpmn:incoming>f4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="work"/>
    <bpmn:sequenceFlow id="f2" sourceRef="work" targetRef="wait-go"/>
    <bpmn:sequenceFlow id="f3" sourceRef="wait-go" targetRef="wait-ping"/>
    <bpmn:sequenceFlow id="f4" sourceRef="wait-ping" targetRef="end"/>
    <bpmn:sequenceFlow id="f5" sourceRef="failed" targetRef="end-failed"/>
  </bpmn:process>
</bpmn:definitions>"#)
}

const DECISION: &str = r#"<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="d" name="d" namespace="t">
  <decision id="greet" name="Greet">
    <literalExpression><text>"Hello " + name</text></literalExpression>
  </decision>
</definitions>"#;

struct Setup {
    service: GatewayService,
    pool: DbPool,
    backend: SqlxBackend,
}

async fn setup() -> Option<Setup> {
    let pool = common::setup_db(5).await?;
    let engine = common::start_engine(pool.clone());
    let service = GatewayService::new(GatewayState {
        engine: Arc::new(engine.clone()),
        pool: pool.clone(),
        partition_count: 1,
    });
    let backend = SqlxBackend::new(pool.clone());
    for (name, xml) in [("proc.bpmn", process()), ("greet.dmn", DECISION.to_string())] {
        engine
            .send_command(
                "DEPLOYMENT".to_string(),
                "CREATE".to_string(),
                json!({ "resources": [{ "name": name, "content": base64::engine::general_purpose::STANDARD.encode(xml) }] }),
                "<default>".to_string(),
            )
            .await
            .expect("deployment");
    }
    Some(Setup { service, pool, backend })
}

impl Setup {
    async fn start(&self, variables: &str) -> i64 {
        self.service
            .create_process_instance(Request::new(CreateProcessInstanceRequest {
                bpmn_process_id: "proc".into(),
                version: -1,
                variables: variables.into(),
                ..Default::default()
            }))
            .await
            .expect("CreateProcessInstance")
            .into_inner()
            .process_instance_key
    }

    /// The variables of scope `key`, by name.
    async fn variables(&self, key: i64) -> serde_json::Map<String, Value> {
        self.backend
            .get_variables_by_scope(key)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|v| (v.name, v.value))
            .collect()
    }

    /// Wait until `check` holds for the variables of scope `key`.
    async fn wait_for(&self, key: i64, check: impl Fn(&serde_json::Map<String, Value>) -> bool) -> serde_json::Map<String, Value> {
        for _ in 0..100 {
            let variables = self.variables(key).await;
            if check(&variables) {
                return variables;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        self.variables(key).await
    }

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

    async fn job(&self) -> reebe_db::state::jobs::Job {
        for _ in 0..100 {
            let jobs = reebe_db::state::jobs::JobRepository::new(&self.pool)
                .get_activatable_by_type("work", 10)
                .await
                .unwrap_or_default();
            if let Some(job) = jobs.into_iter().next() {
                return job;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("no job");
    }

    /// Complete the job so that the instance waits for the message.
    async fn to_message(&self, pi: i64) {
        let job = self.job().await;
        self.service
            .complete_job(Request::new(CompleteJobRequest { job_key: job.key, variables: String::new(), result: None }))
            .await
            .expect("CompleteJob");
        self.element(pi, "wait-go", "ACTIVATED").await;
    }
}

fn assert_invalid(status: tonic::Status, message: &str) {
    assert_eq!(status.code(), Code::InvalidArgument, "{status:?}");
    assert_eq!(status.message(), message);
}

const NOT_JSON: &str = "{not json";
const NOT_AN_OBJECT: &str = "Property 'variables' is invalid: Expected document to be a root level object, but was 'ARRAY'";

#[tokio::test]
async fn create_process_instance_sets_its_variables() {
    let Some(s) = setup().await else { return };
    let pi = s.start(r#"{"orderId":"o-1","amount":5}"#).await;
    assert!(pi > 0, "the response carries the instance key");
    let variables = s.wait_for(pi, |v| v.contains_key("orderId")).await;
    assert_eq!(variables["orderId"], json!("o-1"));
    assert_eq!(variables["amount"], json!(5));

    let request = |variables: &str| CreateProcessInstanceRequest {
        bpmn_process_id: "proc".into(),
        version: -1,
        variables: variables.into(),
        ..Default::default()
    };
    let with_result = CreateProcessInstanceWithResultRequest { request: Some(request(NOT_JSON)), ..Default::default() };
    assert_invalid(s.service.create_process_instance_with_result(Request::new(with_result)).await.unwrap_err(), "Invalid JSON value: {not json");
    assert_invalid(s.service.create_process_instance(Request::new(request("[1]"))).await.unwrap_err(), NOT_AN_OBJECT);
    assert_invalid(
        s.service.create_process_instance(Request::new(request("7"))).await.unwrap_err(),
        "Property 'variables' is invalid: Expected document to be a root level object, but was 'INTEGER'",
    );
    // `null`, like an empty document, is no variables.
    assert!(s.service.create_process_instance(Request::new(request("null"))).await.is_ok());
}

#[tokio::test]
async fn create_process_instance_with_result_sets_its_variables() {
    let Some(s) = setup().await else { return };
    let request = CreateProcessInstanceWithResultRequest {
        request: Some(CreateProcessInstanceRequest {
            bpmn_process_id: "proc".into(),
            version: -1,
            variables: r#"{"orderId":"o-2"}"#.into(),
            ..Default::default()
        }),
        request_timeout: 200,
        ..Default::default()
    };
    let pi = s.service.create_process_instance_with_result(Request::new(request)).await.unwrap().into_inner().process_instance_key;
    assert_eq!(s.wait_for(pi, |v| v.contains_key("orderId")).await["orderId"], json!("o-2"));
}

#[tokio::test]
async fn publish_message_hands_its_variables_to_the_catch_event() {
    let Some(s) = setup().await else { return };
    let pi = s.start(r#"{"orderId":"o-3"}"#).await;
    s.to_message(pi).await;
    let request = |variables: &str| PublishMessageRequest {
        name: "go".into(),
        correlation_key: "o-3".into(),
        variables: variables.into(),
        ..Default::default()
    };
    assert_invalid(s.service.publish_message(Request::new(request(NOT_JSON))).await.unwrap_err(), "Invalid JSON value: {not json");
    assert_invalid(s.service.publish_message(Request::new(request("[1]"))).await.unwrap_err(), NOT_AN_OBJECT);
    let response = s.service.publish_message(Request::new(request(r#"{"approved":true}"#))).await.unwrap().into_inner();
    assert!(response.key > 0);
    assert_eq!(s.wait_for(pi, |v| v.contains_key("approved")).await["approved"], json!(true));
}

#[tokio::test]
async fn broadcast_signal_hands_its_variables_to_the_catch_event() {
    let Some(s) = setup().await else { return };
    let pi = s.start(r#"{"orderId":"o-4"}"#).await;
    s.to_message(pi).await;
    s.service
        .publish_message(Request::new(PublishMessageRequest { name: "go".into(), correlation_key: "o-4".into(), ..Default::default() }))
        .await
        .unwrap();
    s.element(pi, "wait-ping", "ACTIVATED").await;
    let request = |variables: &str| BroadcastSignalRequest { signal_name: "ping".into(), variables: variables.into(), ..Default::default() };
    assert_invalid(s.service.broadcast_signal(Request::new(request(NOT_JSON))).await.unwrap_err(), "Invalid JSON value: {not json");
    assert_invalid(s.service.broadcast_signal(Request::new(request("[1]"))).await.unwrap_err(), NOT_AN_OBJECT);
    let response = s.service.broadcast_signal(Request::new(request(r#"{"pinged":"yes"}"#))).await.unwrap().into_inner();
    assert!(response.key > 0);
    assert_eq!(s.wait_for(pi, |v| v.contains_key("pinged")).await["pinged"], json!("yes"));
}

#[tokio::test]
async fn set_variables_sets_them_locally_or_propagates_them() {
    let Some(s) = setup().await else { return };
    let pi = s.start(r#"{"orderId":"o-5"}"#).await;
    let work = s.element(pi, "work", "ACTIVATED").await;
    let request = |key: i64, variables: &str, local: bool| SetVariablesRequest {
        element_instance_key: key,
        variables: variables.into(),
        local,
    };
    assert_invalid(s.service.set_variables(Request::new(request(pi, NOT_JSON, false))).await.unwrap_err(), "Invalid JSON value: {not json");
    assert_invalid(s.service.set_variables(Request::new(request(pi, "[1]", false))).await.unwrap_err(), NOT_AN_OBJECT);

    // On the process instance.
    s.service.set_variables(Request::new(request(pi, r#"{"orderId":"o-6","note":"hi"}"#, false))).await.unwrap();
    let root = s.variables(pi).await;
    assert_eq!((&root["orderId"], &root["note"]), (&json!("o-6"), &json!("hi")));
    // Local to the task.
    s.service.set_variables(Request::new(request(work.key, r#"{"attempt":2}"#, true))).await.unwrap();
    assert_eq!(s.variables(work.key).await["attempt"], json!(2));
    assert!(!s.variables(pi).await.contains_key("attempt"));
    // Propagated from the task: to the scope that has the variable, else the process.
    s.service.set_variables(Request::new(request(work.key, r#"{"attempt":3,"fresh":1}"#, false))).await.unwrap();
    assert_eq!(s.variables(work.key).await["attempt"], json!(3));
    assert_eq!(s.variables(pi).await["fresh"], json!(1));
}

#[tokio::test]
async fn fail_job_sets_its_variables_on_the_task() {
    let Some(s) = setup().await else { return };
    let pi = s.start("").await;
    let job = s.job().await;
    let request = |variables: &str| FailJobRequest {
        job_key: job.key,
        retries: 2,
        error_message: "try again".into(),
        variables: variables.into(),
        ..Default::default()
    };
    assert_invalid(s.service.fail_job(Request::new(request(NOT_JSON))).await.unwrap_err(), "Invalid JSON value: {not json");
    assert_invalid(s.service.fail_job(Request::new(request("[1]"))).await.unwrap_err(), NOT_AN_OBJECT);
    s.service.fail_job(Request::new(request(r#"{"lastError":"timeout"}"#))).await.unwrap();
    assert_eq!(s.variables(job.element_instance_key).await["lastError"], json!("timeout"));
    assert!(!s.variables(pi).await.contains_key("lastError"), "local to the task");
}

#[tokio::test]
async fn throw_error_hands_its_variables_to_the_catch_event() {
    let Some(s) = setup().await else { return };
    let pi = s.start("").await;
    let job = s.job().await;
    let request = |variables: &str| ThrowErrorRequest {
        job_key: job.key,
        error_code: "BROKEN".into(),
        error_message: "broken".into(),
        variables: variables.into(),
    };
    assert_invalid(s.service.throw_error(Request::new(request(NOT_JSON))).await.unwrap_err(), "Invalid JSON value: {not json");
    assert_invalid(s.service.throw_error(Request::new(request("[1]"))).await.unwrap_err(), NOT_AN_OBJECT);
    s.service.throw_error(Request::new(request(r#"{"reason":"out of stock"}"#))).await.unwrap();
    assert_eq!(s.wait_for(pi, |v| v.contains_key("reason")).await["reason"], json!("out of stock"));
    s.element(pi, "end-failed", "COMPLETED").await;
}

#[tokio::test]
async fn complete_job_sets_its_variables() {
    let Some(s) = setup().await else { return };
    let pi = s.start("").await;
    let job = s.job().await;
    let request = |variables: &str| CompleteJobRequest { job_key: job.key, variables: variables.into(), result: None };
    assert_invalid(s.service.complete_job(Request::new(request(NOT_JSON))).await.unwrap_err(), "Invalid JSON value: {not json");
    s.service.complete_job(Request::new(request(r#"{"done":true}"#))).await.unwrap();
    assert_eq!(s.wait_for(pi, |v| v.contains_key("done")).await["done"], json!(true));
}

#[tokio::test]
async fn evaluate_decision_evaluates_with_its_variables() {
    let Some(s) = setup().await else { return };
    let request = |variables: &str| EvaluateDecisionRequest {
        decision_id: "greet".into(),
        variables: variables.into(),
        ..Default::default()
    };
    assert_invalid(s.service.evaluate_decision(Request::new(request(NOT_JSON))).await.unwrap_err(), "Invalid JSON value: {not json");
    assert_invalid(s.service.evaluate_decision(Request::new(request("[1]"))).await.unwrap_err(), NOT_AN_OBJECT);
    let response = s.service.evaluate_decision(Request::new(request(r#"{"name":"Ada"}"#))).await.unwrap().into_inner();
    assert_eq!(response.decision_id, "greet");
    assert_eq!(response.decision_name, "Greet");
    assert_eq!(response.decision_output, r#""Hello Ada""#);
    assert_eq!(response.failure_message, "");
    let missing = s.service
        .evaluate_decision(Request::new(EvaluateDecisionRequest { decision_id: "nope".into(), ..Default::default() }))
        .await
        .unwrap_err();
    assert_eq!(missing.code(), Code::NotFound);
}

#[tokio::test]
async fn modify_process_instance_checks_the_variables_of_its_instructions() {
    let Some(s) = setup().await else { return };
    let request = |variables: &str| ModifyProcessInstanceRequest {
        process_instance_key: 1,
        activate_instructions: vec![ActivateInstruction {
            element_id: "work".into(),
            ancestor_element_instance_key: -1,
            variable_instructions: vec![VariableInstruction { variables: variables.into(), scope_id: String::new() }],
        }],
        ..Default::default()
    };
    assert_invalid(s.service.modify_process_instance(Request::new(request(NOT_JSON))).await.unwrap_err(), "Invalid JSON value: {not json");
    assert_invalid(s.service.modify_process_instance(Request::new(request("[1]"))).await.unwrap_err(), NOT_AN_OBJECT);
}
