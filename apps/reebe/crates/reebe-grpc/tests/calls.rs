//! gRPC calls against a running engine on PostgreSQL: `ModifyProcessInstance`,
//! `DeployResource` and `DeployProcess` of BPMN and DMN, and `EvaluateDecision` by
//! id and by key.
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

/// A DRG `greetings` with the literal decision `greet`, which says `{greeting} {name}`.
fn greeting_dmn(greeting: &str) -> String {
    format!(r#"<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="greetings" name="Greetings" namespace="t">
  <decision id="greet" name="Greet">
    <literalExpression><text>"{greeting} " + name</text></literalExpression>
  </decision>
</definitions>"#)
}

/// start → decide (business rule task calling `greet` into `greeting`) → end.
const DECIDING_PROCESS: &str = r#"<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" targetNamespace="t">
  <bpmn:process id="decide-proc" isExecutable="true">
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

#[tokio::test]
async fn deploy_resource_deploys_bpmn_and_dmn_that_then_run() {
    let Some(s) = setup().await else { return };
    let deployed = s.service
        .deploy_resource(Request::new(DeployResourceRequest {
            resources: vec![
                Resource { name: "greet.dmn".into(), content: greeting_dmn("Hello").into_bytes() },
                Resource { name: "decide.bpmn".into(), content: DECIDING_PROCESS.as_bytes().to_vec() },
            ],
            tenant_id: String::new(),
        }))
        .await
        .expect("DeployResource")
        .into_inner();
    assert!(deployed.key > 0);
    assert_eq!(deployed.tenant_id, "<default>");
    let mut process = None;
    let mut decision = None;
    let mut requirements = None;
    for d in deployed.deployments {
        match d.metadata {
            Some(deployment::Metadata::Process(p)) => process = Some(p),
            Some(deployment::Metadata::Decision(d)) => decision = Some(d),
            Some(deployment::Metadata::DecisionRequirements(r)) => requirements = Some(r),
            other => panic!("unexpected {other:?}"),
        }
    }
    let process = process.expect("the process");
    assert_eq!((process.bpmn_process_id.as_str(), process.version, process.resource_name.as_str()), ("decide-proc", 1, "decide.bpmn"));
    assert!(process.process_definition_key > 0);
    let decision = decision.expect("the decision");
    assert_eq!((decision.dmn_decision_id.as_str(), decision.dmn_decision_name.as_str(), decision.version), ("greet", "Greet", 1));
    assert_eq!(decision.dmn_decision_requirements_id, "greetings");
    let requirements = requirements.expect("the decision requirements");
    assert_eq!((requirements.dmn_decision_requirements_id.as_str(), requirements.version), ("greetings", 1));
    assert_eq!(requirements.decision_requirements_key, decision.decision_requirements_key);

    // The deployed process runs, and its business rule task evaluates the decision.
    let pi = s.service
        .create_process_instance(Request::new(CreateProcessInstanceRequest {
            process_definition_key: process.process_definition_key,
            variables: r#"{"name":"Ada"}"#.into(),
            ..Default::default()
        }))
        .await
        .expect("CreateProcessInstance")
        .into_inner()
        .process_instance_key;
    s.element(pi, "end", "COMPLETED").await;
    let variables = s.backend.get_variables_by_scope(pi).await.unwrap();
    assert!(variables.iter().any(|v| v.name == "greeting" && v.value == json!("Hello Ada")), "{variables:?}");

    // EvaluateDecision by key and by id; a new version is what the id names.
    let deployed_again = s.service
        .deploy_resource(Request::new(DeployResourceRequest {
            resources: vec![Resource { name: "greet.dmn".into(), content: greeting_dmn("Hi").into_bytes() }],
            tenant_id: String::new(),
        }))
        .await
        .expect("DeployResource")
        .into_inner();
    let Some(deployment::Metadata::Decision(v2)) = deployed_again.deployments.into_iter().find_map(|d| match d.metadata {
        Some(m @ deployment::Metadata::Decision(_)) => Some(Some(m)),
        _ => None,
    }).flatten() else { panic!("no decision") };
    assert_eq!(v2.version, 2);
    let evaluate = |request: EvaluateDecisionRequest| s.service.evaluate_decision(Request::new(request));
    let by_key = evaluate(EvaluateDecisionRequest { decision_key: decision.decision_key, variables: r#"{"name":"Ada"}"#.into(), ..Default::default() })
        .await
        .expect("EvaluateDecision by key")
        .into_inner();
    assert_eq!((by_key.decision_output.as_str(), by_key.decision_version, by_key.decision_key), (r#""Hello Ada""#, 1, decision.decision_key));
    assert_eq!((by_key.decision_requirements_id.as_str(), by_key.decision_requirements_key), ("greetings", decision.decision_requirements_key));
    assert!(by_key.decision_evaluation_key > 0);
    let by_id = evaluate(EvaluateDecisionRequest { decision_id: "greet".into(), variables: r#"{"name":"Ada"}"#.into(), ..Default::default() })
        .await
        .expect("EvaluateDecision by id")
        .into_inner();
    assert_eq!((by_id.decision_output.as_str(), by_id.decision_version, by_id.decision_key), (r#""Hi Ada""#, 2, v2.decision_key));

    let missing = evaluate(EvaluateDecisionRequest { decision_key: 424242, ..Default::default() }).await.unwrap_err();
    assert_eq!(missing.code(), Code::NotFound, "{missing:?}");
    assert_eq!(missing.message(), "Expected to evaluate decision '424242', but no decision found for key '424242'");
}

#[tokio::test]
async fn deploy_process_deploys_bpmn() {
    let Some(s) = setup().await else { return };
    let deployed = s.service
        .deploy_process(Request::new(DeployProcessRequest {
            processes: vec![ProcessRequestObject { name: "proc.bpmn".into(), definition: PROCESS.as_bytes().to_vec() }],
        }))
        .await
        .expect("DeployProcess")
        .into_inner();
    assert!(deployed.key > 0);
    assert_eq!(deployed.processes.len(), 1);
    assert_eq!((deployed.processes[0].bpmn_process_id.as_str(), deployed.processes[0].version), ("proc", 1));
    let pi = s.start().await;
    s.element(pi, "a", "ACTIVATED").await;

    // A deployment the engine rejects is INVALID_ARGUMENT, as in Zeebe.
    let rejected = s.service
        .deploy_process(Request::new(DeployProcessRequest {
            processes: vec![ProcessRequestObject { name: "bad.bpmn".into(), definition: b"<nope".to_vec() }],
        }))
        .await
        .unwrap_err();
    assert_eq!(rejected.code(), Code::InvalidArgument, "{rejected:?}");
}
