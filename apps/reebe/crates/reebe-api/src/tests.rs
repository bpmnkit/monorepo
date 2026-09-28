#[cfg(test)]
mod tests {
    use crate::error::{ApiError, ProblemDetail};
    use crate::pagination::{PageRequest, PageResponse};
    use crate::dto::system::{TopologyResponse, BrokerInfo, PartitionInfo, LicenseResponse, StatusResponse};
    use axum::response::IntoResponse;
    use axum::http::StatusCode;

    // ---- ProblemDetail tests ----

    #[test]
    fn test_problem_detail_not_found() {
        let pd = ProblemDetail::not_found("Process 42 not found", "/v2/process-instances/42");
        assert_eq!(pd.status, 404);
        assert_eq!(pd.title, "NOT_FOUND");
        assert_eq!(pd.detail, "Process 42 not found");
        assert_eq!(pd.instance, "/v2/process-instances/42");
        assert_eq!(pd.problem_type, "about:blank");
    }

    #[test]
    fn test_problem_detail_invalid_argument() {
        let pd = ProblemDetail::invalid_argument("Missing bpmnProcessId", "/v2/process-instances");
        assert_eq!(pd.status, 400);
        assert_eq!(pd.title, "INVALID_ARGUMENT");
        assert_eq!(pd.detail, "Missing bpmnProcessId");
    }

    #[test]
    fn test_problem_detail_internal_error() {
        let pd = ProblemDetail::internal_error("Database unreachable", "/v2/deployments");
        assert_eq!(pd.status, 500);
        assert_eq!(pd.title, "INTERNAL_ERROR");
        assert_eq!(pd.detail, "Database unreachable");
    }

    #[test]
    fn test_problem_detail_serialization() {
        let pd = ProblemDetail::not_found("Not found", "/v2/test");
        let json = serde_json::to_value(&pd).unwrap();
        assert_eq!(json["status"], 404);
        assert_eq!(json["title"], "NOT_FOUND");
        assert_eq!(json["detail"], "Not found");
        assert_eq!(json["type"], "about:blank");
    }

    // ---- ApiError → response status code tests ----

    #[test]
    fn test_api_error_not_found_status() {
        let err = ApiError::NotFound {
            resource: "process-instance".to_string(),
            key: "12345".to_string(),
        };
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_api_error_invalid_request_status() {
        let err = ApiError::InvalidRequest("Missing required field".to_string());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_api_error_conflict_status() {
        let err = ApiError::Conflict("Resource already exists".to_string());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::CONFLICT);
    }

    #[test]
    fn test_api_error_internal_error_status() {
        let err = ApiError::InternalError("Unexpected failure".to_string());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn test_api_error_from_engine_not_found() {
        use reebe_engine::EngineError;
        let engine_err = EngineError::NotFound("Process definition 99".to_string());
        let api_err = ApiError::from(engine_err);
        let response = api_err.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_api_error_from_engine_invalid_state() {
        use reebe_engine::EngineError;
        let engine_err = EngineError::InvalidState("Element already completed".to_string());
        let api_err = ApiError::from(engine_err);
        let response = api_err.into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_api_error_from_engine_internal() {
        use reebe_engine::EngineError;
        let engine_err = EngineError::Internal("Unexpected engine error".to_string());
        let api_err = ApiError::from(engine_err);
        let response = api_err.into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn test_api_error_from_engine_bpmn_parse() {
        use reebe_engine::EngineError;
        let engine_err = EngineError::BpmnParse("Invalid XML structure".to_string());
        let api_err = ApiError::EngineError(engine_err);
        let response = api_err.into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    // ---- Pagination tests ----

    #[test]
    fn test_page_request_default_page_size() {
        let req = PageRequest::default();
        assert_eq!(req.page_size_or_default(), 20);
    }

    #[test]
    fn test_page_request_custom_page_size() {
        let req = PageRequest {
            page_size: Some(50),
            search_after: None,
        };
        assert_eq!(req.page_size_or_default(), 50);
    }

    #[test]
    fn test_page_request_clamped_to_max() {
        let req = PageRequest {
            page_size: Some(9999),
            search_after: None,
        };
        assert_eq!(req.page_size_or_default(), 1000);
    }

    #[test]
    fn test_page_request_clamped_to_min() {
        let req = PageRequest {
            page_size: Some(0),
            search_after: None,
        };
        assert_eq!(req.page_size_or_default(), 1);
    }

    #[test]
    fn test_page_request_after_key_none() {
        let req = PageRequest::default();
        assert!(req.after_key().is_none());
    }

    #[test]
    fn test_page_request_after_key_some() {
        let req = PageRequest {
            page_size: None,
            search_after: Some(vec![serde_json::json!(42)]),
        };
        assert_eq!(req.after_key(), Some(42));
    }

    #[test]
    fn test_page_response_empty() {
        let resp: PageResponse<String> = PageResponse::empty();
        assert!(resp.items.is_empty());
        assert_eq!(resp.page.total_items, 0);
        assert!(resp.page.first_sort_values.is_empty());
        assert!(resp.page.last_sort_values.is_empty());
    }

    #[test]
    fn test_page_response_with_items() {
        let items = vec!["a".to_string(), "b".to_string(), "c".to_string()];
        let resp = PageResponse::new(items, Some(1), Some(3));
        assert_eq!(resp.page.total_items, 3);
        assert!(!resp.page.first_sort_values.is_empty());
        assert!(!resp.page.last_sort_values.is_empty());
    }

    #[test]
    fn test_page_response_serialization() {
        let items = vec![serde_json::json!({"key": 1})];
        let resp = PageResponse::new(items, Some(1), Some(1));
        let json = serde_json::to_value(&resp).unwrap();
        assert!(json["items"].is_array());
        assert!(json["page"]["totalItems"].is_number());
    }

    // ---- DTO serialization tests ----

    #[test]
    fn test_topology_response_serialization() {
        let resp = TopologyResponse {
            brokers: vec![BrokerInfo {
                node_id: 0,
                host: "localhost".to_string(),
                port: 26501,
                partitions: vec![PartitionInfo {
                    partition_id: 1,
                    role: "LEADER".to_string(),
                    health: "HEALTHY".to_string(),
                }],
                version: "1.0.0".to_string(),
            }],
            cluster_size: 1,
            partitions_count: 1,
            replication_factor: 1,
            gateway_version: "1.0.0".to_string(),
        };

        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["clusterSize"], 1);
        assert_eq!(json["partitionsCount"], 1);
        assert_eq!(json["replicationFactor"], 1);
        assert!(json["brokers"].is_array());
        let broker = &json["brokers"][0];
        assert_eq!(broker["nodeId"], 0);
        assert_eq!(broker["host"], "localhost");
        assert_eq!(broker["port"], 26501);
    }

    #[test]
    fn test_license_response_serialization() {
        let resp = LicenseResponse {
            license_type: "production".to_string(),
            is_valid_license: true,
            expires_at: None,
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["licenseType"], "production");
        assert_eq!(json["isValidLicense"], true);
        assert!(json["expiresAt"].is_null());
    }

    #[test]
    fn test_status_response_serialization() {
        let resp = StatusResponse {
            health: "HEALTHY".to_string(),
            version: "1.0.0".to_string(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["health"], "HEALTHY");
        assert_eq!(json["version"], "1.0.0");
    }

    #[test]
    fn test_create_process_instance_request_deserialization() {
        use crate::dto::process_instances::CreateProcessInstanceRequest;
        let json = r#"{"bpmnProcessId":"order-process","version":1,"variables":{"amount":100}}"#;
        let req: CreateProcessInstanceRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.bpmn_process_id.as_deref(), Some("order-process"));
        assert_eq!(req.version, Some(1));
        let vars = req.variables.unwrap();
        assert_eq!(vars["amount"], 100);
    }

    #[test]
    fn test_create_process_instance_request_empty_deserialization() {
        use crate::dto::process_instances::CreateProcessInstanceRequest;
        let json = r#"{}"#;
        let req: CreateProcessInstanceRequest = serde_json::from_str(json).unwrap();
        assert!(req.bpmn_process_id.is_none());
        assert!(req.process_definition_key.is_none());
        assert!(req.variables.is_none());
    }

    #[test]
    fn test_activate_jobs_request_deserialization() {
        use crate::dto::jobs::ActivateJobsRequest;
        let json = r#"{"type":"payment-service","worker":"my-worker","maxJobsToActivate":10,"timeout":30000}"#;
        let req: ActivateJobsRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.job_type, "payment-service");
        assert_eq!(req.worker, Some("my-worker".to_string()));
        assert_eq!(req.max_jobs_to_activate, 10);
    }

    #[test]
    fn test_complete_job_request_deserialization_empty() {
        use crate::dto::jobs::CompleteJobRequest;
        let json = r#"{}"#;
        let req: CompleteJobRequest = serde_json::from_str(json).unwrap();
        assert!(req.variables.is_none());
    }

    #[test]
    fn test_complete_job_request_deserialization_with_variables() {
        use crate::dto::jobs::CompleteJobRequest;
        let json = r#"{"variables":{"result":"done","count":5}}"#;
        let req: CompleteJobRequest = serde_json::from_str(json).unwrap();
        let vars = req.variables.unwrap();
        assert_eq!(vars["result"], "done");
        assert_eq!(vars["count"], 5);
    }

    #[test]
    fn test_fail_job_request_deserialization() {
        use crate::dto::jobs::FailJobRequest;
        let json = r#"{"retries":2,"errorMessage":"Worker timeout"}"#;
        let req: FailJobRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.retries, 2);
        assert_eq!(req.error_message.as_deref(), Some("Worker timeout"));
    }

    #[test]
    fn test_problem_detail_rfc7807_field_name() {
        // RFC 7807 requires "type" not "problem_type"
        let pd = ProblemDetail::not_found("test", "/v2/test");
        let json = serde_json::to_value(&pd).unwrap();
        assert!(json.get("type").is_some(), "RFC 7807 requires 'type' field");
        assert!(json.get("problem_type").is_none(), "Should not have snake_case field");
    }

    #[test]
    fn test_ad_hoc_activation_request_maps_to_the_engine_command() {
        use crate::dto::element_instances::ActivateAdHocActivitiesRequest;
        use crate::handlers::element_instances::ad_hoc_activation_payload;
        let req: ActivateAdHocActivitiesRequest = serde_json::from_str(
            r#"{"elements":[{"elementId":"search","variables":{"q":"x"}},{"elementId":"ask"}],"cancelRemainingInstances":true}"#,
        ).unwrap();
        let payload = ad_hoc_activation_payload("42", req).unwrap();
        assert_eq!(payload, serde_json::json!({
            "adHocSubProcessInstanceKey": "42",
            "elements": [
                { "elementId": "search", "variables": { "q": "x" } },
                { "elementId": "ask", "variables": {} },
            ],
            "cancelRemainingInstances": true,
        }));

        // cancelRemainingInstances defaults to false; elements and elementId are required.
        let req: ActivateAdHocActivitiesRequest = serde_json::from_str(r#"{"elements":[]}"#).unwrap();
        assert_eq!(ad_hoc_activation_payload("1", req).unwrap()["cancelRemainingInstances"], false);
        for body in [r#"{}"#, r#"{"elements":[{"variables":{}}]}"#] {
            let req: ActivateAdHocActivitiesRequest = serde_json::from_str(body).unwrap();
            let status = ad_hoc_activation_payload("1", req).unwrap_err().into_response().status();
            assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
        }
    }

    #[test]
    fn test_ad_hoc_activation_rejections_map_to_the_specified_statuses() {
        use reebe_engine::EngineError;
        // Not found, not an ad-hoc sub-process, or an element it cannot activate: 404.
        let not_found = ApiError::EngineError(EngineError::NotFound("no ad-hoc sub-process".into()));
        assert_eq!(not_found.into_response().status(), StatusCode::NOT_FOUND);
        let not_active = ApiError::EngineError(EngineError::InvalidState("not active".into()));
        assert_eq!(not_active.into_response().status(), StatusCode::BAD_REQUEST);
    }
}
