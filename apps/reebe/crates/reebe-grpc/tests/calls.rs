//! gRPC calls against a running engine on PostgreSQL: `ModifyProcessInstance`.
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
use reebe_db::{SqlxBackend, StateBackend};
use reebe_grpc::service::proto::gateway_protocol::gateway_server::Gateway;
use reebe_grpc::service::proto::gateway_protocol::*;
use reebe_grpc::{GatewayService, GatewayState};
use serde_json::json;
use tonic::{Code, Request};

/// start → a → sp[ sp-start → b ] → end.
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
    <bpmn:endEvent id="end"><bpmn:incoming>f3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="a"/>
    <bpmn:sequenceFlow id="f2" sourceRef="a" targetRef="sp"/>
    <bpmn:sequenceFlow id="f3" sourceRef="sp" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

struct Setup {
    service: GatewayService,
    backend: SqlxBackend,
    engine: Arc<reebe_engine::EngineHandle>,
}

async fn setup() -> Option<Setup> {
    let pool = common::setup_db(5).await?;
    let engine = Arc::new(common::start_engine(pool.clone()));
    let service = GatewayService::new(GatewayState { engine: engine.clone(), pool: pool.clone(), partition_count: 1 });
    Some(Setup { service, backend: SqlxBackend::new(pool), engine })
}

impl Setup {
    async fn deploy_with_engine(&self, name: &str, xml: &str) {
        self.engine
            .send_command(
                "DEPLOYMENT".to_string(),
                "CREATE".to_string(),
                json!({ "resources": [{ "name": name, "content": base64::engine::general_purpose::STANDARD.encode(xml) }] }),
                "<default>".to_string(),
            )
            .await
            .expect("deployment");
    }

    async fn start(&self) -> i64 {
        self.service
            .create_process_instance(Request::new(CreateProcessInstanceRequest {
                bpmn_process_id: "proc".into(),
                version: -1,
                ..Default::default()
            }))
            .await
            .expect("CreateProcessInstance")
            .into_inner()
            .process_instance_key
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
async fn modify_process_instance_activates_terminates_and_moves() {
    let Some(s) = setup().await else { return };
    s.deploy_with_engine("proc.bpmn", PROCESS).await;
    let pi = s.start().await;
    let a = s.element(pi, "a", "ACTIVATED").await;

    s.service
        .modify_process_instance(Request::new(ModifyProcessInstanceRequest {
            process_instance_key: pi,
            activate_instructions: vec![ActivateInstruction {
                element_id: "b".into(),
                ancestor_element_instance_key: 0,
                variable_instructions: vec![VariableInstruction { variables: r#"{"inB":1}"#.into(), scope_id: "b".into() }],
            }],
            terminate_instructions: vec![TerminateInstruction { element_instance_key: a.key, element_id: String::new() }],
            ..Default::default()
        }))
        .await
        .expect("ModifyProcessInstance");
    s.element(pi, "a", "TERMINATED").await;
    s.element(pi, "sp", "ACTIVATED").await;
    let b = s.element(pi, "b", "ACTIVATED").await;
    let in_b = s.backend.get_variables_by_scope(b.key).await.unwrap();
    assert!(in_b.iter().any(|v| v.name == "inB" && v.value == json!(1)), "{in_b:?}");

    // Zeebe 8.9's move instruction, by source element id; the sub-process and then the
    // process instance are left with nothing to do and terminated.
    s.service
        .modify_process_instance(Request::new(ModifyProcessInstanceRequest {
            process_instance_key: pi,
            move_instructions: vec![MoveInstruction {
                source_element_id: "b".into(),
                target_element_id: "end".into(),
                infer_ancestor_scope_from_source_hierarchy: true,
                ..Default::default()
            }],
            ..Default::default()
        }))
        .await
        .expect("ModifyProcessInstance with a move instruction");
    s.element(pi, "b", "TERMINATED").await;
    s.element(pi, "sp", "TERMINATED").await;
    s.element(pi, "end", "COMPLETED").await;
}

#[tokio::test]
async fn modify_process_instance_rejects_as_zeebe_does() {
    let Some(s) = setup().await else { return };
    s.deploy_with_engine("proc.bpmn", PROCESS).await;
    let pi = s.start().await;
    s.element(pi, "a", "ACTIVATED").await;

    let missing = s.service
        .modify_process_instance(Request::new(ModifyProcessInstanceRequest { process_instance_key: 42, ..Default::default() }))
        .await
        .unwrap_err();
    assert_eq!(missing.code(), Code::NotFound, "{missing:?}");
    assert_eq!(missing.message(), "Expected to modify process instance but no process instance found with key '42'");

    let unsupported = s.service
        .modify_process_instance(Request::new(ModifyProcessInstanceRequest {
            process_instance_key: pi,
            activate_instructions: vec![ActivateInstruction { element_id: "sp-start".into(), ..Default::default() }],
            ..Default::default()
        }))
        .await
        .unwrap_err();
    assert_eq!(unsupported.code(), Code::InvalidArgument, "{unsupported:?}");
    assert!(unsupported.message().starts_with(
        "Expected to modify instance of process 'proc' but it contains one or more activate instructions \
         for elements that are unsupported: 'sp-start'. The activation of elements with type 'START_EVENT' is not supported."
    ), "{unsupported:?}");
}
