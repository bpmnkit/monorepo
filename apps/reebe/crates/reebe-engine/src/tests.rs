#[cfg(test)]
mod tests {
    use crate::job_notifier::JobNotifier;
    use crate::error::EngineError;
    use crate::processor::{Writers, EventToWrite, CommandToWrite};
    use std::sync::Arc;

    // ---- JobNotifier tests ----

    #[tokio::test]
    async fn test_job_notifier_creates_entry() {
        let notifier = JobNotifier::new();
        let n1 = notifier.get_or_create("payment-task");
        let n2 = notifier.get_or_create("payment-task");
        // Same job type returns same notifier (same Arc pointer)
        assert!(Arc::ptr_eq(&n1, &n2));
    }

    #[tokio::test]
    async fn test_job_notifier_different_types() {
        let notifier = JobNotifier::new();
        let n1 = notifier.get_or_create("type-a");
        let n2 = notifier.get_or_create("type-b");
        assert!(!Arc::ptr_eq(&n1, &n2));
    }

    #[tokio::test]
    async fn test_job_notifier_notify_wakes_waiter() {
        let notifier = Arc::new(JobNotifier::new());
        let notif = notifier.get_or_create("my-job-type");

        let notif_clone = notif.clone();
        let task = tokio::spawn(async move {
            // Will block until notified
            notif_clone.notified().await;
        });

        // Small delay then notify
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        notifier.notify("my-job-type");

        // Task should complete quickly
        let result = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            task,
        ).await;
        assert!(result.is_ok(), "Task should have been woken up by notify");
    }

    #[tokio::test]
    async fn test_job_notifier_notify_nonexistent_type() {
        let notifier = JobNotifier::new();
        // Should not panic on notifying a type with no waiters
        notifier.notify("nobody-waiting");
    }

    #[test]
    fn test_job_notifier_default() {
        let notifier = JobNotifier::default();
        let n = notifier.get_or_create("test");
        assert!(Arc::strong_count(&n) >= 1);
    }

    // ---- Writers tests ----

    #[test]
    fn test_writers_initial_state() {
        let writers = Writers::new();
        assert!(writers.events.is_empty());
        assert!(writers.commands.is_empty());
        assert!(writers.response.is_none());
        assert!(writers.rejection.is_none());
    }

    #[test]
    fn test_writers_default_matches_new() {
        let w1 = Writers::new();
        let w2 = Writers::default();
        assert!(w1.events.is_empty());
        assert!(w2.events.is_empty());
    }

    #[test]
    fn test_writers_add_event() {
        let mut writers = Writers::new();
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_ACTIVATED".to_string(),
            key: 12345,
            payload: serde_json::json!({ "elementId": "start" }),
        });
        assert_eq!(writers.events.len(), 1);
        assert_eq!(writers.events[0].intent, "ELEMENT_ACTIVATED");
        assert_eq!(writers.events[0].key, 12345);
        assert_eq!(writers.events[0].value_type, "PROCESS_INSTANCE");
    }

    #[test]
    fn test_writers_add_command() {
        let mut writers = Writers::new();
        writers.commands.push(CommandToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ACTIVATE_ELEMENT".to_string(),
            key: 0,
            payload: serde_json::json!({ "elementId": "task1" }),
        });
        assert_eq!(writers.commands.len(), 1);
        assert_eq!(writers.commands[0].intent, "ACTIVATE_ELEMENT");
    }

    #[test]
    fn test_writers_set_response() {
        let mut writers = Writers::new();
        writers.response = Some(serde_json::json!({ "processInstanceKey": "123" }));
        assert!(writers.response.is_some());
        let resp = writers.response.unwrap();
        assert_eq!(resp["processInstanceKey"], "123");
    }

    #[test]
    fn test_writers_set_rejection() {
        let mut writers = Writers::new();
        writers.rejection = Some("Process not found".to_string());
        assert!(writers.rejection.is_some());
        assert_eq!(writers.rejection.as_deref(), Some("Process not found"));
    }

    #[test]
    fn test_writers_multiple_events() {
        let mut writers = Writers::new();
        for i in 0..5 {
            writers.events.push(EventToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: format!("INTENT_{}", i),
                key: i as i64,
                payload: serde_json::Value::Null,
            });
        }
        assert_eq!(writers.events.len(), 5);
    }

    // ---- EngineError tests ----

    #[test]
    fn test_engine_error_not_found_display() {
        let e = EngineError::NotFound("Process definition 42".to_string());
        assert!(e.to_string().contains("Process definition 42"));
        assert!(e.to_string().contains("Not found"));
    }

    #[test]
    fn test_engine_error_invalid_state_display() {
        let e = EngineError::InvalidState("Element not in expected state".to_string());
        assert!(e.to_string().contains("Element not in expected state"));
    }

    #[test]
    fn test_engine_error_bpmn_parse_display() {
        let e = EngineError::BpmnParse("Invalid XML".to_string());
        assert!(e.to_string().contains("Invalid XML"));
    }

    #[test]
    fn test_engine_error_expression_display() {
        let e = EngineError::Expression("Unknown variable".to_string());
        assert!(e.to_string().contains("Unknown variable"));
    }

    #[test]
    fn test_engine_error_internal_display() {
        let e = EngineError::Internal("Something went wrong".to_string());
        assert!(e.to_string().contains("Something went wrong"));
    }

    // ---- evaluate_feel integration tests ----

    #[test]
    fn test_evaluate_feel_condition_true() {
        let vars = serde_json::json!({ "amount": 150 });
        let result = crate::evaluate_feel("=amount > 100", &vars).unwrap();
        assert_eq!(result, serde_json::Value::Bool(true));
    }

    #[test]
    fn test_evaluate_feel_condition_false() {
        let vars = serde_json::json!({ "amount": 50 });
        let result = crate::evaluate_feel("=amount > 100", &vars).unwrap();
        assert_eq!(result, serde_json::Value::Bool(false));
    }

    #[test]
    fn test_evaluate_feel_static_string() {
        let vars = serde_json::json!({});
        // No `=` prefix → treated as string literal
        let result = crate::evaluate_feel("payment-service", &vars).unwrap();
        assert_eq!(result, serde_json::Value::String("payment-service".to_string()));
    }

    #[test]
    fn test_evaluate_feel_variable_reference() {
        let vars = serde_json::json!({ "orderId": "order-123" });
        let result = crate::evaluate_feel("=orderId", &vars).unwrap();
        assert_eq!(result, serde_json::Value::String("order-123".to_string()));
    }

    #[test]
    fn test_evaluate_feel_complex_condition() {
        let vars = serde_json::json!({ "status": "approved", "amount": 500 });
        let result = crate::evaluate_feel("=status = \"approved\" and amount > 100", &vars).unwrap();
        assert_eq!(result, serde_json::Value::Bool(true));
    }

    #[test]
    fn test_evaluate_feel_undefined_variable_is_null() {
        let vars = serde_json::json!({});
        // As in Zeebe, a variable that does not exist is null, and so is arithmetic on it.
        let result = crate::evaluate_feel("=nonexistent + 1", &vars).unwrap();
        assert_eq!(result, serde_json::Value::Null);
    }

    // ---- FEEL integration tests (direct API) ----

    #[test]
    fn test_feel_evaluate_correlation_key() {
        use reebe_feel::{evaluate, FeelContext, FeelValue};
        let mut ctx = FeelContext::new();
        ctx.set("customerId", FeelValue::Integer(42));
        let result = evaluate("string(customerId)", &ctx).unwrap();
        assert_eq!(result, FeelValue::String("42".to_string()));
    }

    #[test]
    fn test_feel_parse_and_evaluate_with_prefix() {
        use reebe_feel::{parse_and_evaluate, FeelContext, FeelValue};
        let mut ctx = FeelContext::new();
        ctx.set("x", FeelValue::Integer(10));
        let result = parse_and_evaluate("=x * 2", &ctx).unwrap();
        assert_eq!(result, FeelValue::Integer(20));
    }

    #[test]
    fn test_feel_parse_and_evaluate_without_prefix() {
        use reebe_feel::{parse_and_evaluate, FeelContext};
        let ctx = FeelContext::new();
        use reebe_feel::FeelValue;
        let result = parse_and_evaluate("literal-value", &ctx).unwrap();
        assert_eq!(result, FeelValue::String("literal-value".to_string()));
    }

    #[test]
    fn test_feel_is_expression() {
        use reebe_feel::is_feel_expression;
        assert!(is_feel_expression("=amount > 0"));
        assert!(!is_feel_expression("my-job-type"));
        assert!(!is_feel_expression(""));
    }

    // ---- BRT + DMN companion flow ----

    #[cfg(feature = "memory")]
    #[tokio::test]
    async fn test_brt_dmn_companion_stores_result_variable() {
        use std::sync::Arc;
        use base64::Engine as Base64Engine;
        use reebe_db::{InMemoryBackend, StateBackend};
        use crate::{EngineState, VirtualClock, JobNotifier};
        use crate::processor::{
            RecordProcessor, Writers,
            DeploymentProcessor, ProcessInstanceCreationProcessor,
            BpmnElementProcessor, JobProcessor,
        };
        use reebe_db::records::DbRecord;

        const BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="validation-proc" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>f1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:businessRuleTask id="brt1" name="Validate Input">
      <bpmn:extensionElements>
        <zeebe:calledDecision decisionId="start_inputValidation" resultVariable="validationErrors"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:businessRuleTask>
    <bpmn:endEvent id="end">
      <bpmn:incoming>f2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="brt1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="brt1" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

        const DMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             namespace="http://camunda.org/schema/1.0/dmn"
             name="DRD"
             id="Definitions_validation">
  <decision id="start_inputValidation" name="Input Validation">
    <decisionTable id="dt1" hitPolicy="COLLECT">
      <input id="i1" label="name">
        <inputExpression id="ie1">
          <text>name</text>
        </inputExpression>
      </input>
      <output id="o1" name="error" typeRef="string"/>
      <rule id="r1">
        <inputEntry id="ie1r1"><text>null</text></inputEntry>
        <outputEntry id="oe1r1"><text>"name is required"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>"#;

        let backend = Arc::new(InMemoryBackend::new());
        let clock = Arc::new(VirtualClock::new(chrono::Utc::now()));
        let state = Arc::new(EngineState {
            backend: backend.clone() as Arc<dyn reebe_db::StateBackend>,
            partition_id: 0,
            process_def_cache: crate::process_def_cache::ProcessDefCache::new(),
            clock: clock.clone(),
        });
        let job_notifier = Arc::new(JobNotifier::new());

        let processors: Vec<Arc<dyn RecordProcessor>> = vec![
            Arc::new(DeploymentProcessor),
            Arc::new(ProcessInstanceCreationProcessor),
            Arc::new(BpmnElementProcessor),
            Arc::new(JobProcessor { job_notifier }),
        ];

        // Helper: submit a command and drain follow-up commands
        let submit_and_drain = {
            let backend = backend.clone();
            let state = state.clone();
            let processors = processors.clone();
            move |value_type: &str, intent: &str, payload: serde_json::Value| {
                let backend = backend.clone();
                let state = state.clone();
                let processors = processors.clone();
                let value_type = value_type.to_string();
                let intent = intent.to_string();
                async move {
                    let (position, key) = backend.next_position_and_key(0).await.unwrap();
                    let record = DbRecord {
                        partition_id: 0,
                        position,
                        record_type: "COMMAND".to_string(),
                        value_type: value_type.clone(),
                        intent: intent.clone(),
                        record_key: key,
                        timestamp_ms: chrono::Utc::now().timestamp_millis(),
                        payload,
                        source_position: None,
                        tenant_id: "<default>".to_string(),
                    };
                    backend.insert_record(&record).await.unwrap();

                    let mut last_pos = position - 1;
                    let mut response: Option<serde_json::Value> = None;

                    loop {
                        let cmds = backend.fetch_commands_from(0, last_pos + 1, 100).await.unwrap();
                        if cmds.is_empty() { break; }
                        for rec in &cmds {
                            last_pos = rec.position;
                            for proc in &processors {
                                if proc.accepts(&rec.value_type, &rec.intent) {
                                    let mut writers = Writers::new();
                                    proc.process(rec, &state, &mut writers).await.unwrap();
                                    if rec.position == position {
                                        response = writers.response.clone();
                                    }
                                    let total = writers.events.len() + writers.commands.len();
                                    if total > 0 {
                                        let first = backend.next_position_batch(0, total).await.unwrap();
                                        let mut recs = Vec::new();
                                        for (i, ev) in writers.events.iter().enumerate() {
                                            recs.push(DbRecord {
                                                partition_id: 0,
                                                position: first + i as i64,
                                                record_type: "EVENT".to_string(),
                                                value_type: ev.value_type.clone(),
                                                intent: ev.intent.clone(),
                                                record_key: ev.key,
                                                timestamp_ms: chrono::Utc::now().timestamp_millis(),
                                                payload: ev.payload.clone(),
                                                source_position: Some(rec.position),
                                                tenant_id: rec.tenant_id.clone(),
                                            });
                                        }
                                        for (i, cmd) in writers.commands.iter().enumerate() {
                                            recs.push(DbRecord {
                                                partition_id: 0,
                                                position: first + writers.events.len() as i64 + i as i64,
                                                record_type: "COMMAND".to_string(),
                                                value_type: cmd.value_type.clone(),
                                                intent: cmd.intent.clone(),
                                                record_key: cmd.key,
                                                timestamp_ms: chrono::Utc::now().timestamp_millis(),
                                                payload: cmd.payload.clone(),
                                                source_position: Some(rec.position),
                                                tenant_id: rec.tenant_id.clone(),
                                            });
                                        }
                                        backend.insert_records_batch(&recs).await.unwrap();
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    response
                }
            }
        };

        // Deploy DMN companion
        let dmn_encoded = base64::engine::general_purpose::STANDARD.encode(DMN.as_bytes());
        submit_and_drain("DEPLOYMENT", "CREATE", serde_json::json!({
            "resources": [{ "name": "validation.dmn", "content": dmn_encoded }]
        })).await;

        // Deploy BPMN
        let bpmn_encoded = base64::engine::general_purpose::STANDARD.encode(BPMN.as_bytes());
        let deploy_resp = submit_and_drain("DEPLOYMENT", "CREATE", serde_json::json!({
            "resources": [{ "name": "process.bpmn", "content": bpmn_encoded }]
        })).await.expect("deploy should return response");

        assert!(
            deploy_resp["deployments"].as_array().map(|a| !a.is_empty()).unwrap_or(false),
            "BPMN deploy should return non-empty deployments: {deploy_resp}"
        );

        // Create process instance with a missing 'name' variable (triggers required rule)
        submit_and_drain("PROCESS_INSTANCE_CREATION", "CREATE", serde_json::json!({
            "bpmnProcessId": "validation-proc",
            "version": -1,
            "variables": {},
        })).await;

        // Check variables
        let vars = backend.list_variables();
        let validation_errors = vars.iter().find(|v| v.name == "validationErrors");
        assert!(
            validation_errors.is_some(),
            "validationErrors variable should be stored; got: {:?}",
            vars.iter().map(|v| &v.name).collect::<Vec<_>>()
        );

        let val = &validation_errors.unwrap().value;
        let arr = val.as_array().expect("validationErrors should be an array");
        assert!(!arr.is_empty(), "validationErrors should have at least one error for missing name");
    }

    /// When all inputs are valid, the COLLECT decision returns [] and the XOR
    /// gateway condition `count(validationErrors) = 0` should take the valid path.
    #[tokio::test]
    #[cfg(feature = "memory")]
    async fn test_brt_dmn_valid_inputs_gateway_takes_valid_path() {
        use std::sync::Arc;
        use base64::Engine as Base64Engine;
        use reebe_db::{InMemoryBackend, StateBackend};
        use crate::{EngineState, VirtualClock, JobNotifier};
        use crate::processor::{
            RecordProcessor, Writers,
            DeploymentProcessor, ProcessInstanceCreationProcessor,
            BpmnElementProcessor, JobProcessor,
        };
        use reebe_db::records::DbRecord;

        // BRT → XOR gateway (condition: count(validationErrors) = 0) → end
        //                                                               ↘ error-end (default)
        const BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="valid-proc" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>f1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:businessRuleTask id="brt1" name="Validate Input">
      <bpmn:extensionElements>
        <zeebe:calledDecision decisionId="start_inputValidation" resultVariable="validationErrors"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:businessRuleTask>
    <bpmn:exclusiveGateway id="gw1" name="Valid?" default="f4">
      <bpmn:incoming>f2</bpmn:incoming>
      <bpmn:outgoing>f3</bpmn:outgoing>
      <bpmn:outgoing>f4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="end-ok">
      <bpmn:incoming>f3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="end-err">
      <bpmn:incoming>f4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="brt1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="brt1" targetRef="gw1"/>
    <bpmn:sequenceFlow id="f3" sourceRef="gw1" targetRef="end-ok">
      <bpmn:conditionExpression>= count(validationErrors) = 0</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f4" sourceRef="gw1" targetRef="end-err"/>
  </bpmn:process>
</bpmn:definitions>"#;

        const DMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             namespace="http://camunda.org/schema/1.0/dmn"
             name="DRD"
             id="Definitions_validation">
  <decision id="start_inputValidation" name="Input Validation">
    <decisionTable id="dt1" hitPolicy="COLLECT">
      <input id="i1" label="name">
        <inputExpression id="ie1">
          <text>name</text>
        </inputExpression>
      </input>
      <output id="o1" name="error" typeRef="string"/>
      <rule id="r1">
        <inputEntry id="ie1r1"><text>null</text></inputEntry>
        <outputEntry id="oe1r1"><text>"name is required"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>"#;

        let backend = Arc::new(InMemoryBackend::new());
        let clock = Arc::new(VirtualClock::new(chrono::Utc::now()));
        let state = Arc::new(EngineState {
            backend: backend.clone() as Arc<dyn reebe_db::StateBackend>,
            partition_id: 0,
            process_def_cache: crate::process_def_cache::ProcessDefCache::new(),
            clock: clock.clone(),
        });
        let job_notifier = Arc::new(JobNotifier::new());

        let processors: Vec<Arc<dyn RecordProcessor>> = vec![
            Arc::new(DeploymentProcessor),
            Arc::new(ProcessInstanceCreationProcessor),
            Arc::new(BpmnElementProcessor),
            Arc::new(JobProcessor { job_notifier }),
        ];

        let submit_and_drain = {
            let backend = backend.clone();
            let state = state.clone();
            let processors = processors.clone();
            move |value_type: &str, intent: &str, payload: serde_json::Value| {
                let backend = backend.clone();
                let state = state.clone();
                let processors = processors.clone();
                let value_type = value_type.to_string();
                let intent = intent.to_string();
                async move {
                    let (position, key) = backend.next_position_and_key(0).await.unwrap();
                    let record = DbRecord {
                        partition_id: 0, position,
                        record_type: "COMMAND".to_string(),
                        value_type: value_type.clone(),
                        intent: intent.clone(),
                        record_key: key,
                        timestamp_ms: chrono::Utc::now().timestamp_millis(),
                        payload,
                        source_position: None,
                        tenant_id: "<default>".to_string(),
                    };
                    backend.insert_record(&record).await.unwrap();
                    let mut last_pos = position - 1;
                    loop {
                        let cmds = backend.fetch_commands_from(0, last_pos + 1, 100).await.unwrap();
                        if cmds.is_empty() { break; }
                        for rec in &cmds {
                            last_pos = rec.position;
                            for proc in &processors {
                                if proc.accepts(&rec.value_type, &rec.intent) {
                                    let mut writers = Writers::new();
                                    proc.process(rec, &state, &mut writers).await.unwrap();
                                    let total = writers.events.len() + writers.commands.len();
                                    if total > 0 {
                                        let first = backend.next_position_batch(0, total).await.unwrap();
                                        let mut recs = Vec::new();
                                        for (i, ev) in writers.events.iter().enumerate() {
                                            recs.push(DbRecord {
                                                partition_id: 0, position: first + i as i64,
                                                record_type: "EVENT".to_string(),
                                                value_type: ev.value_type.clone(),
                                                intent: ev.intent.clone(),
                                                record_key: ev.key,
                                                timestamp_ms: chrono::Utc::now().timestamp_millis(),
                                                payload: ev.payload.clone(),
                                                source_position: Some(rec.position),
                                                tenant_id: rec.tenant_id.clone(),
                                            });
                                        }
                                        for (i, cmd) in writers.commands.iter().enumerate() {
                                            recs.push(DbRecord {
                                                partition_id: 0,
                                                position: first + writers.events.len() as i64 + i as i64,
                                                record_type: "COMMAND".to_string(),
                                                value_type: cmd.value_type.clone(),
                                                intent: cmd.intent.clone(),
                                                record_key: cmd.key,
                                                timestamp_ms: chrono::Utc::now().timestamp_millis(),
                                                payload: cmd.payload.clone(),
                                                source_position: Some(rec.position),
                                                tenant_id: rec.tenant_id.clone(),
                                            });
                                        }
                                        backend.insert_records_batch(&recs).await.unwrap();
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        };

        // Deploy DMN then BPMN
        let dmn_encoded = base64::engine::general_purpose::STANDARD.encode(DMN.as_bytes());
        submit_and_drain("DEPLOYMENT", "CREATE", serde_json::json!({
            "resources": [{ "name": "validation.dmn", "content": dmn_encoded }]
        })).await;

        let bpmn_encoded = base64::engine::general_purpose::STANDARD.encode(BPMN.as_bytes());
        submit_and_drain("DEPLOYMENT", "CREATE", serde_json::json!({
            "resources": [{ "name": "process.bpmn", "content": bpmn_encoded }]
        })).await;

        // Create instance WITH a valid 'name' variable — no validation errors expected
        submit_and_drain("PROCESS_INSTANCE_CREATION", "CREATE", serde_json::json!({
            "bpmnProcessId": "valid-proc",
            "version": -1,
            "variables": { "name": "John" },
        })).await;

        // validationErrors should be an empty array (no rules fired)
        let vars = backend.list_variables();
        let ve = vars.iter().find(|v| v.name == "validationErrors");
        assert!(ve.is_some(), "validationErrors variable must be set; got: {:?}",
            vars.iter().map(|v| &v.name).collect::<Vec<_>>());
        let arr = ve.unwrap().value.as_array().expect("validationErrors must be array");
        assert!(arr.is_empty(), "validationErrors should be empty when inputs are valid; got: {arr:?}");

        let element_instances = backend.list_element_instances();

        // The process should have reached 'end-ok' (COMPLETED), not 'end-err'
        let end_ok = element_instances.iter().find(|ei| ei.element_id == "end-ok");
        let end_err = element_instances.iter().find(|ei| ei.element_id == "end-err");
        assert!(end_ok.is_some(), "end-ok element instance should exist (valid path taken)");
        assert!(end_err.is_none(), "end-err must NOT be reached when inputs are valid");
    }

    // ---- BPMN + FEEL integration ----

    #[test]
    fn test_bpmn_condition_expression_evaluates() {
        // Build process model with conditions directly (parser doesn't support inline conditionExpression
        // in non-self-closing sequenceFlow elements).
        use reebe_bpmn::model::{BpmnProcess, SequenceFlow};
        use reebe_feel::{parse_and_evaluate, FeelContext, FeelValue};

        let mut process = BpmnProcess::new("p");
        process.sequence_flows.push(SequenceFlow {
            id: "high".to_string(),
            name: None,
            source_ref: "gw".to_string(),
            target_ref: "end".to_string(),
            condition_expression: Some("=priority = \"high\"".to_string()),
            is_default: false,
        });
        process.sequence_flows.push(SequenceFlow {
            id: "low".to_string(),
            name: None,
            source_ref: "gw".to_string(),
            target_ref: "end".to_string(),
            condition_expression: Some("=priority != \"high\"".to_string()),
            is_default: false,
        });

        // Get condition from "high" flow
        let high_flow = process.sequence_flows.iter().find(|f| f.id == "high").unwrap();
        let condition = high_flow.condition_expression.as_ref().unwrap();

        let mut ctx = FeelContext::new();
        ctx.set("priority", FeelValue::String("high".to_string()));
        let result = parse_and_evaluate(condition, &ctx).unwrap();
        assert_eq!(result, FeelValue::Bool(true));

        ctx.set("priority", FeelValue::String("low".to_string()));
        let result = parse_and_evaluate(condition, &ctx).unwrap();
        assert_eq!(result, FeelValue::Bool(false));
    }

    /// When the default flow (f4, no condition, marked with `default="f4"`) appears
    /// before the conditioned flow (f3) in the sequenceFlow document order, the
    /// gateway must still take the conditioned path when its condition is true.
    /// The default flow must only be taken when no conditioned flow matches.
    #[tokio::test]
    #[cfg(feature = "memory")]
    async fn test_xor_gateway_conditioned_flow_wins_over_unconditioned_default() {
        use std::sync::Arc;
        use base64::Engine as Base64Engine;
        use reebe_db::{InMemoryBackend, StateBackend};
        use crate::{EngineState, VirtualClock, JobNotifier};
        use crate::processor::{
            RecordProcessor, Writers,
            DeploymentProcessor, ProcessInstanceCreationProcessor,
            BpmnElementProcessor, JobProcessor,
        };
        use reebe_db::records::DbRecord;

        // f4 (no condition, intended as default) comes BEFORE f3 (conditioned) in the XML.
        // Without the fix the engine would pick f4 (wrong path) because None => true.
        const BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="gw-order-proc" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>f1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:exclusiveGateway id="gw1" name="Check" default="f4">
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f3</bpmn:outgoing>
      <bpmn:outgoing>f4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="end-ok">
      <bpmn:incoming>f3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="end-err">
      <bpmn:incoming>f4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="gw1"/>
    <!-- f4 (no condition) intentionally listed FIRST to expose the ordering bug -->
    <bpmn:sequenceFlow id="f4" sourceRef="gw1" targetRef="end-err"/>
    <bpmn:sequenceFlow id="f3" sourceRef="gw1" targetRef="end-ok">
      <bpmn:conditionExpression>= ok = true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
  </bpmn:process>
</bpmn:definitions>"#;

        let backend = Arc::new(InMemoryBackend::new());
        let clock = Arc::new(VirtualClock::new(chrono::Utc::now()));
        let state = Arc::new(EngineState {
            backend: backend.clone() as Arc<dyn reebe_db::StateBackend>,
            partition_id: 0,
            process_def_cache: crate::process_def_cache::ProcessDefCache::new(),
            clock: clock.clone(),
        });
        let job_notifier = Arc::new(JobNotifier::new());
        let processors: Vec<Arc<dyn RecordProcessor>> = vec![
            Arc::new(DeploymentProcessor),
            Arc::new(ProcessInstanceCreationProcessor),
            Arc::new(BpmnElementProcessor),
            Arc::new(JobProcessor { job_notifier }),
        ];

        let submit_and_drain = {
            let backend = backend.clone();
            let state = state.clone();
            let processors = processors.clone();
            move |value_type: &str, intent: &str, payload: serde_json::Value| {
                let backend = backend.clone();
                let state = state.clone();
                let processors = processors.clone();
                let value_type = value_type.to_string();
                let intent = intent.to_string();
                async move {
                    let (position, key) = backend.next_position_and_key(0).await.unwrap();
                    let record = DbRecord {
                        partition_id: 0, position,
                        record_type: "COMMAND".to_string(),
                        value_type: value_type.clone(),
                        intent: intent.clone(),
                        record_key: key,
                        timestamp_ms: chrono::Utc::now().timestamp_millis(),
                        payload,
                        source_position: None,
                        tenant_id: "<default>".to_string(),
                    };
                    backend.insert_record(&record).await.unwrap();
                    let mut last_pos = position - 1;
                    loop {
                        let cmds = backend.fetch_commands_from(0, last_pos + 1, 100).await.unwrap();
                        if cmds.is_empty() { break; }
                        for rec in &cmds {
                            last_pos = rec.position;
                            for proc in &processors {
                                if proc.accepts(&rec.value_type, &rec.intent) {
                                    let mut writers = Writers::new();
                                    proc.process(rec, &state, &mut writers).await.unwrap();
                                    let total = writers.events.len() + writers.commands.len();
                                    if total > 0 {
                                        let first = backend.next_position_batch(0, total).await.unwrap();
                                        let mut recs = Vec::new();
                                        for (i, ev) in writers.events.iter().enumerate() {
                                            recs.push(DbRecord {
                                                partition_id: 0, position: first + i as i64,
                                                record_type: "EVENT".to_string(),
                                                value_type: ev.value_type.clone(),
                                                intent: ev.intent.clone(),
                                                record_key: ev.key,
                                                timestamp_ms: chrono::Utc::now().timestamp_millis(),
                                                payload: ev.payload.clone(),
                                                source_position: Some(rec.position),
                                                tenant_id: rec.tenant_id.clone(),
                                            });
                                        }
                                        for (i, cmd) in writers.commands.iter().enumerate() {
                                            recs.push(DbRecord {
                                                partition_id: 0,
                                                position: first + writers.events.len() as i64 + i as i64,
                                                record_type: "COMMAND".to_string(),
                                                value_type: cmd.value_type.clone(),
                                                intent: cmd.intent.clone(),
                                                record_key: cmd.key,
                                                timestamp_ms: chrono::Utc::now().timestamp_millis(),
                                                payload: cmd.payload.clone(),
                                                source_position: Some(rec.position),
                                                tenant_id: rec.tenant_id.clone(),
                                            });
                                        }
                                        backend.insert_records_batch(&recs).await.unwrap();
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        };

        let bpmn_encoded = base64::engine::general_purpose::STANDARD.encode(BPMN.as_bytes());
        submit_and_drain("DEPLOYMENT", "CREATE", serde_json::json!({
            "resources": [{ "name": "process.bpmn", "content": bpmn_encoded }]
        })).await;

        // ok=true → conditioned flow f3 should win even though f4 (unconditioned) comes first
        submit_and_drain("PROCESS_INSTANCE_CREATION", "CREATE", serde_json::json!({
            "bpmnProcessId": "gw-order-proc",
            "version": -1,
            "variables": { "ok": true },
        })).await;

        let element_instances = backend.list_element_instances();
        let end_ok = element_instances.iter().find(|ei| ei.element_id == "end-ok");
        let end_err = element_instances.iter().find(|ei| ei.element_id == "end-err");
        assert!(end_ok.is_some(), "end-ok must be reached when ok=true");
        assert!(end_err.is_none(), "end-err must NOT be reached when ok=true");
    }

    #[test]
    fn test_eval_flow_condition_without_equals_prefix() {
        // Condition expressions without a leading `=` must still be evaluated as FEEL.
        use reebe_feel::{evaluate, FeelContext, FeelValue};

        let mut ctx = FeelContext::new();
        ctx.set("validationErrors", FeelValue::List(vec![]));

        // Without `=` prefix — should evaluate to true
        let result = evaluate("count(validationErrors) = 0", &ctx).unwrap();
        assert_eq!(result, FeelValue::Bool(true));

        // With errors — should evaluate to false
        ctx.set("validationErrors", FeelValue::List(vec![FeelValue::String("name is required".to_string())]));
        let result = evaluate("count(validationErrors) = 0", &ctx).unwrap();
        assert_eq!(result, FeelValue::Bool(false));
    }
}
