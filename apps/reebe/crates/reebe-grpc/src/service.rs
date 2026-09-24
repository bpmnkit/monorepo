//! Implementation of the Zeebe Gateway gRPC service.

use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use tokio_stream::wrappers::ReceiverStream;
use tokio_stream::Stream;
use tonic::{Request, Response, Status};

use reebe_engine::EngineHandle;
use reebe_db::DbPool;

pub mod proto {
    pub mod gateway_protocol {
        tonic::include_proto!("gateway_protocol");
    }
}

use proto::gateway_protocol::gateway_server::Gateway;
use proto::gateway_protocol::*;

/// Shared state passed to every gRPC handler.
#[derive(Clone)]
pub struct GatewayState {
    pub engine: Arc<EngineHandle>,
    pub pool: DbPool,
    pub partition_count: usize,
}

pub struct GatewayService {
    state: GatewayState,
}

impl GatewayService {
    pub fn new(state: GatewayState) -> Self {
        Self { state }
    }
}

// Helper: map engine error to gRPC Status
fn engine_err(e: reebe_engine::error::EngineError) -> Status {
    Status::internal(e.to_string())
}

// Helper: convert a DB Job to proto ActivatedJob
fn job_to_proto(job: reebe_db::state::jobs::Job) -> ActivatedJob {
    let deadline_ms = job
        .deadline
        .map(|d| d.timestamp_millis())
        .unwrap_or(0);
    ActivatedJob {
        key: job.key,
        r#type: job.job_type,
        process_instance_key: job.process_instance_key,
        bpmn_process_id: job.bpmn_process_id,
        process_definition_version: 0, // populated via join in future
        process_definition_key: job.process_definition_key,
        element_id: job.element_id,
        element_instance_key: job.element_instance_key,
        custom_headers: job.custom_headers.to_string(),
        worker: job.worker.unwrap_or_default(),
        retries: job.retries,
        deadline: deadline_ms,
        variables: job.variables.to_string(),
        tenant_id: job.tenant_id,
    }
}

/// The variables a gRPC call carries as a JSON document, as the engine takes them: an
/// object. As in Zeebe's gateway (`RequestUtil.ensureJsonSet`, then the record's
/// document property), an empty string or `null` is no variables, text that is not
/// JSON is rejected with `Invalid JSON value: …`, and JSON that is not an object with
/// `Property 'variables' is invalid: Expected document to be a root level object, but
/// was '…'`, both as `INVALID_ARGUMENT`.
fn variables_document(json: &str) -> Result<serde_json::Value, Status> {
    if json.trim().is_empty() {
        return Ok(serde_json::json!({}));
    }
    let value = serde_json::from_str::<serde_json::Value>(json)
        .map_err(|_| Status::invalid_argument(format!("Invalid JSON value: {json}")))?;
    // The MessagePack type Zeebe names the root of the document by.
    let kind = match &value {
        serde_json::Value::Object(_) => return Ok(value),
        serde_json::Value::Null => return Ok(serde_json::json!({})),
        serde_json::Value::Array(_) => "ARRAY",
        serde_json::Value::String(_) => "STRING",
        serde_json::Value::Bool(_) => "BOOLEAN",
        serde_json::Value::Number(n) if n.is_f64() => "FLOAT",
        serde_json::Value::Number(_) => "INTEGER",
    };
    Err(Status::invalid_argument(format!(
        "Property 'variables' is invalid: Expected document to be a root level object, but was '{kind}'"
    )))
}

/// A key in an engine response, which gives keys as strings.
fn key_of(value: &serde_json::Value) -> Option<i64> {
    value.as_i64().or_else(|| value.as_str().and_then(|s| s.parse().ok()))
}

/// The engine's `PROCESS_INSTANCE_CREATION` `CREATE` command, as the REST API sends it:
/// a definition key of 0 and an empty process id mean "not given".
fn create_process_instance_payload(req: &CreateProcessInstanceRequest, tenant_id: &str) -> Result<serde_json::Value, Status> {
    let mut payload = serde_json::json!({
        "version": req.version,
        "variables": variables_document(&req.variables)?,
        "tenantId": tenant_id,
    });
    if req.process_definition_key > 0 {
        payload["processDefinitionKey"] = req.process_definition_key.to_string().into();
    }
    if !req.bpmn_process_id.is_empty() {
        payload["bpmnProcessId"] = req.bpmn_process_id.clone().into();
    }
    Ok(payload)
}

/// The engine's `JOB` `COMPLETE` command for a `CompleteJob` call: the same payload
/// the REST job completion sends, with the job result in the REST `JobResult` shape.
fn complete_job_payload(req: CompleteJobRequest) -> Result<serde_json::Value, Status> {
    let mut payload = serde_json::json!({
        "jobKey": req.job_key.to_string(),
        "variables": variables_document(&req.variables)?,
        "result": null,
    });
    if let Some(result) = req.result {
        let mut json = serde_json::Map::new();
        if let Some(kind) = result.r#type {
            json.insert("type".into(), kind.into());
        }
        if let Some(denied) = result.denied {
            json.insert("denied".into(), denied.into());
        }
        if let Some(reason) = result.denied_reason {
            json.insert("deniedReason".into(), reason.into());
        }
        if let Some(c) = result.corrections {
            let mut corrections = serde_json::Map::new();
            let strings = [("assignee", c.assignee), ("dueDate", c.due_date), ("followUpDate", c.follow_up_date)];
            for (name, value) in strings {
                if let Some(value) = value {
                    corrections.insert(name.into(), value.into());
                }
            }
            for (name, list) in [("candidateUsers", c.candidate_users), ("candidateGroups", c.candidate_groups)] {
                if let Some(list) = list {
                    corrections.insert(name.into(), list.values.into());
                }
            }
            if let Some(priority) = c.priority {
                corrections.insert("priority".into(), priority.into());
            }
            json.insert("corrections".into(), corrections.into());
        }
        if !result.activate_elements.is_empty() {
            let elements = result
                .activate_elements
                .into_iter()
                .map(|e| {
                    let variables = variables_document(&e.variables)?;
                    Ok(serde_json::json!({ "elementId": e.element_id, "variables": variables }))
                })
                .collect::<Result<Vec<_>, Status>>()?;
            json.insert("activateElements".into(), elements.into());
        }
        if let Some(fulfilled) = result.is_completion_condition_fulfilled {
            json.insert("isCompletionConditionFulfilled".into(), fulfilled.into());
        }
        if let Some(cancel) = result.is_cancel_remaining_instances {
            json.insert("isCancelRemainingInstances".into(), cancel.into());
        }
        payload["result"] = json.into();
    }
    Ok(payload)
}

#[tonic::async_trait]
impl Gateway for GatewayService {
    // ── Topology ─────────────────────────────────────────────────────────────

    async fn topology(
        &self,
        _request: Request<TopologyRequest>,
    ) -> Result<Response<TopologyResponse>, Status> {
        let owned = self.state.engine.owned_partitions.read().await.clone();
        let partitions: Vec<Partition> = if owned.is_empty() {
            vec![Partition {
                partition_id: 1,
                role: partition::PartitionBrokerRole::Leader as i32,
                health: partition::PartitionBrokerHealth::Healthy as i32,
            }]
        } else {
            owned
                .iter()
                .map(|&pid| Partition {
                    partition_id: pid as i32,
                    role: partition::PartitionBrokerRole::Leader as i32,
                    health: partition::PartitionBrokerHealth::Healthy as i32,
                })
                .collect()
        };

        let partitions_count = owned.len().max(1) as i32;
        Ok(Response::new(TopologyResponse {
            brokers: vec![BrokerInfo {
                node_id: 0,
                host: "localhost".to_string(),
                port: 26500,
                partitions,
                version: env!("CARGO_PKG_VERSION").to_string(),
            }],
            cluster_size: 1,
            partitions_count,
            replication_factor: 1,
            gateway_version: env!("CARGO_PKG_VERSION").to_string(),
        }))
    }

    // ── Deploy ────────────────────────────────────────────────────────────────

    async fn deploy_process(
        &self,
        request: Request<DeployProcessRequest>,
    ) -> Result<Response<DeployProcessResponse>, Status> {
        let req = request.into_inner();
        let mut process_metas = Vec::new();
        let mut deploy_key = 0i64;

        for proc in req.processes {
            let bpmn_xml = String::from_utf8(proc.definition)
                .map_err(|_| Status::invalid_argument("BPMN definition is not valid UTF-8"))?;
            let payload = serde_json::json!({
                "resourceName": proc.name,
                "bpmnXml": bpmn_xml,
                "tenantId": "<default>",
            });
            let result = self.state.engine
                .send_command("DEPLOYMENT".to_string(), "CREATE".to_string(), payload, "<default>".to_string())
                .await
                .map_err(engine_err)?;

            deploy_key = result["deploymentKey"].as_i64().unwrap_or(0);
            let bpmn_process_id = result["bpmnProcessId"].as_str().unwrap_or("").to_string();
            let version = result["version"].as_i64().unwrap_or(1) as i32;
            let pd_key = result["processDefinitionKey"].as_i64().unwrap_or(0);

            process_metas.push(ProcessMetadata {
                bpmn_process_id,
                version,
                process_definition_key: pd_key,
                resource_name: proc.name,
                tenant_id: "<default>".to_string(),
            });
        }

        Ok(Response::new(DeployProcessResponse {
            key: deploy_key,
            processes: process_metas,
        }))
    }

    async fn deploy_resource(
        &self,
        request: Request<DeployResourceRequest>,
    ) -> Result<Response<DeployResourceResponse>, Status> {
        let req = request.into_inner();
        let tenant_id = if req.tenant_id.is_empty() { "<default>".to_string() } else { req.tenant_id.clone() };
        let mut deployments = Vec::new();
        let mut deploy_key = 0i64;

        for resource in req.resources {
            let bpmn_xml = String::from_utf8(resource.content)
                .map_err(|_| Status::invalid_argument("Resource content is not valid UTF-8"))?;
            let payload = serde_json::json!({
                "resourceName": resource.name,
                "bpmnXml": bpmn_xml,
                "tenantId": tenant_id,
            });
            let result = self.state.engine
                .send_command("DEPLOYMENT".to_string(), "CREATE".to_string(), payload, tenant_id.clone())
                .await
                .map_err(engine_err)?;

            deploy_key = result["deploymentKey"].as_i64().unwrap_or(0);
            let bpmn_process_id = result["bpmnProcessId"].as_str().unwrap_or("").to_string();
            let version = result["version"].as_i64().unwrap_or(1) as i32;
            let pd_key = result["processDefinitionKey"].as_i64().unwrap_or(0);

            deployments.push(Deployment {
                metadata: Some(deployment::Metadata::Process(ProcessMetadata {
                    bpmn_process_id,
                    version,
                    process_definition_key: pd_key,
                    resource_name: resource.name,
                    tenant_id: tenant_id.clone(),
                })),
            });
        }

        Ok(Response::new(DeployResourceResponse {
            key: deploy_key,
            deployments,
            tenant_id,
        }))
    }

    // ── Process Instances ─────────────────────────────────────────────────────

    async fn create_process_instance(
        &self,
        request: Request<CreateProcessInstanceRequest>,
    ) -> Result<Response<CreateProcessInstanceResponse>, Status> {
        let req = request.into_inner();
        let tenant_id = if req.tenant_id.is_empty() { "<default>".to_string() } else { req.tenant_id.clone() };
        let payload = create_process_instance_payload(&req, &tenant_id)?;

        let result = self.state.engine
            .send_command("PROCESS_INSTANCE_CREATION".to_string(), "CREATE".to_string(), payload, tenant_id.clone())
            .await
            .map_err(engine_err)?;

        Ok(Response::new(CreateProcessInstanceResponse {
            process_definition_key: key_of(&result["processDefinitionKey"]).unwrap_or(req.process_definition_key),
            bpmn_process_id: result["bpmnProcessId"].as_str().unwrap_or(&req.bpmn_process_id).to_string(),
            version: result["version"].as_i64().unwrap_or(req.version as i64) as i32,
            process_instance_key: key_of(&result["processInstanceKey"]).unwrap_or(0),
            tenant_id,
        }))
    }

    async fn create_process_instance_with_result(
        &self,
        request: Request<CreateProcessInstanceWithResultRequest>,
    ) -> Result<Response<CreateProcessInstanceWithResultResponse>, Status> {
        let req = request.into_inner();
        let timeout_ms = if req.request_timeout > 0 { req.request_timeout as u64 } else { 30_000 };
        let inner = req.request.ok_or_else(|| Status::invalid_argument("Missing request field"))?;
        let tenant_id = if inner.tenant_id.is_empty() { "<default>".to_string() } else { inner.tenant_id.clone() };

        let payload = create_process_instance_payload(&inner, &tenant_id)?;

        let result = self.state.engine
            .send_command("PROCESS_INSTANCE_CREATION".to_string(), "CREATE".to_string(), payload, tenant_id.clone())
            .await
            .map_err(engine_err)?;

        let instance_key = key_of(&result["processInstanceKey"]).unwrap_or(0);
        let pd_key = key_of(&result["processDefinitionKey"]).unwrap_or(inner.process_definition_key);
        let bpmn_process_id = result["bpmnProcessId"].as_str().unwrap_or(&inner.bpmn_process_id).to_string();
        let version = result["version"].as_i64().unwrap_or(inner.version as i64) as i32;

        // Poll until instance completes or timeout
        let pool = self.state.pool.clone();
        let final_vars = tokio::time::timeout(
            Duration::from_millis(timeout_ms),
            wait_for_instance_completion(&pool, instance_key),
        )
        .await
        .unwrap_or(Ok("{}".to_string()))
        .unwrap_or_default();

        Ok(Response::new(CreateProcessInstanceWithResultResponse {
            process_definition_key: pd_key,
            bpmn_process_id,
            version,
            process_instance_key: instance_key,
            tenant_id,
            variables: final_vars,
        }))
    }

    async fn cancel_process_instance(
        &self,
        request: Request<CancelProcessInstanceRequest>,
    ) -> Result<Response<CancelProcessInstanceResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({ "processInstanceKey": req.process_instance_key.to_string() });
        self.state.engine
            .send_command("PROCESS_INSTANCE".to_string(), "CANCEL".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(CancelProcessInstanceResponse {}))
    }

    async fn modify_process_instance(
        &self,
        request: Request<ModifyProcessInstanceRequest>,
    ) -> Result<Response<ModifyProcessInstanceResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({
            "processInstanceKey": req.process_instance_key.to_string(),
            "activateInstructions": req.activate_instructions.iter().map(|i| {
                let variable_instructions = i.variable_instructions.iter().map(|v| {
                    Ok(serde_json::json!({ "variables": variables_document(&v.variables)?, "scopeId": v.scope_id }))
                }).collect::<Result<Vec<_>, Status>>()?;
                Ok(serde_json::json!({
                    "elementId": i.element_id,
                    "ancestorElementInstanceKey": i.ancestor_element_instance_key,
                    "variableInstructions": variable_instructions,
                }))
            }).collect::<Result<Vec<_>, Status>>()?,
            "terminateInstructions": req.terminate_instructions.iter().map(|i| serde_json::json!({
                "elementInstanceKey": i.element_instance_key,
            })).collect::<Vec<_>>(),
        });
        self.state.engine
            .send_command("PROCESS_INSTANCE_MODIFICATION".to_string(), "MODIFY".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(ModifyProcessInstanceResponse {}))
    }

    async fn migrate_process_instance(
        &self,
        request: Request<MigrateProcessInstanceRequest>,
    ) -> Result<Response<MigrateProcessInstanceResponse>, Status> {
        let req = request.into_inner();
        let plan = req.migration_plan.unwrap_or_default();
        let payload = serde_json::json!({
            "processInstanceKey": req.process_instance_key.to_string(),
            "migrationPlan": {
                "targetProcessDefinitionKey": plan.target_process_definition_key,
                "mappingInstructions": plan.mapping_instructions.iter().map(|m| serde_json::json!({
                    "sourceElementId": m.source_element_id,
                    "targetElementId": m.target_element_id,
                })).collect::<Vec<_>>(),
            },
        });
        self.state.engine
            .send_command("PROCESS_INSTANCE_MIGRATION".to_string(), "MIGRATE".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(MigrateProcessInstanceResponse {}))
    }

    // ── Jobs ──────────────────────────────────────────────────────────────────

    type ActivateJobsStream = Pin<Box<dyn Stream<Item = Result<ActivateJobsResponse, Status>> + Send>>;

    async fn activate_jobs(
        &self,
        request: Request<ActivateJobsRequest>,
    ) -> Result<Response<Self::ActivateJobsStream>, Status> {
        let req = request.into_inner();
        let max_jobs = req.max_jobs_to_activate.max(1) as i64;
        let job_type = req.r#type.clone();
        let worker = req.worker.clone();
        let timeout_ms = req.timeout;
        let request_timeout_ms = req.request_timeout;

        let pool = self.state.pool.clone();
        let notifier = self.state.engine.job_notifier.get_or_create(&job_type);
        let (tx, rx) = tokio::sync::mpsc::channel(10);

        tokio::spawn(async move {
            // Try immediate activation
            match reebe_db::state::jobs::activate_jobs(&pool, &job_type, &worker, max_jobs, timeout_ms).await {
                Ok(jobs) if !jobs.is_empty() => {
                    let _ = tx.send(Ok(ActivateJobsResponse {
                        jobs: jobs.into_iter().map(job_to_proto).collect(),
                    })).await;
                    return;
                }
                Err(e) => {
                    let _ = tx.send(Err(Status::internal(e.to_string()))).await;
                    return;
                }
                _ => {}
            }

            // No jobs found immediately
            if request_timeout_ms <= 0 {
                return; // immediate mode — close stream empty
            }

            // Long-poll
            let _ = tokio::time::timeout(
                Duration::from_millis(request_timeout_ms.unsigned_abs()),
                notifier.notified(),
            ).await;

            // Try again
            match reebe_db::state::jobs::activate_jobs(&pool, &job_type, &worker, max_jobs, timeout_ms).await {
                Ok(jobs) if !jobs.is_empty() => {
                    let _ = tx.send(Ok(ActivateJobsResponse {
                        jobs: jobs.into_iter().map(job_to_proto).collect(),
                    })).await;
                }
                _ => {} // empty or error — close stream
            }
        });

        Ok(Response::new(Box::pin(ReceiverStream::new(rx))))
    }

    type StreamActivatedJobsStream = Pin<Box<dyn Stream<Item = Result<ActivatedJob, Status>> + Send>>;

    async fn stream_activated_jobs(
        &self,
        request: Request<StreamActivatedJobsRequest>,
    ) -> Result<Response<Self::StreamActivatedJobsStream>, Status> {
        let req = request.into_inner();
        let job_type = req.r#type.clone();
        let worker = req.worker.clone();
        let timeout_ms = req.timeout;

        let pool = self.state.pool.clone();
        let notifier = self.state.engine.job_notifier.get_or_create(&job_type);
        let (tx, rx) = tokio::sync::mpsc::channel(64);

        tokio::spawn(async move {
            loop {
                // Try to activate a batch
                match reebe_db::state::jobs::activate_jobs(&pool, &job_type, &worker, 32, timeout_ms).await {
                    Ok(jobs) => {
                        for job in jobs {
                            if tx.send(Ok(job_to_proto(job))).await.is_err() {
                                return; // client disconnected
                            }
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(Err(Status::internal(e.to_string()))).await;
                        return;
                    }
                }
                // Wait for the next job to become available
                notifier.notified().await;
            }
        });

        Ok(Response::new(Box::pin(ReceiverStream::new(rx))))
    }

    async fn complete_job(
        &self,
        request: Request<CompleteJobRequest>,
    ) -> Result<Response<CompleteJobResponse>, Status> {
        let payload = complete_job_payload(request.into_inner())?;
        self.state.engine
            .send_command("JOB".to_string(), "COMPLETE".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(CompleteJobResponse {}))
    }

    async fn fail_job(
        &self,
        request: Request<FailJobRequest>,
    ) -> Result<Response<FailJobResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({
            "jobKey": req.job_key.to_string(),
            "retries": req.retries,
            "errorMessage": req.error_message,
            "retryBackOff": req.retry_back_off,
            "variables": variables_document(&req.variables)?,
        });
        self.state.engine
            .send_command("JOB".to_string(), "FAIL".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(FailJobResponse {}))
    }

    async fn throw_error(
        &self,
        request: Request<ThrowErrorRequest>,
    ) -> Result<Response<ThrowErrorResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({
            "jobKey": req.job_key.to_string(),
            "errorCode": req.error_code,
            "errorMessage": req.error_message,
            "variables": variables_document(&req.variables)?,
        });
        self.state.engine
            .send_command("JOB".to_string(), "THROW_ERROR".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(ThrowErrorResponse {}))
    }

    async fn update_job_retries(
        &self,
        request: Request<UpdateJobRetriesRequest>,
    ) -> Result<Response<UpdateJobRetriesResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({
            "jobKey": req.job_key.to_string(),
            "retries": req.retries,
        });
        self.state.engine
            .send_command("JOB".to_string(), "UPDATE_RETRIES".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(UpdateJobRetriesResponse {}))
    }

    async fn update_job_timeout(
        &self,
        request: Request<UpdateJobTimeoutRequest>,
    ) -> Result<Response<UpdateJobTimeoutResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({
            "jobKey": req.job_key.to_string(),
            "timeout": req.timeout,
        });
        self.state.engine
            .send_command("JOB".to_string(), "UPDATE_TIMEOUT".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(UpdateJobTimeoutResponse {}))
    }

    // ── Variables ─────────────────────────────────────────────────────────────

    async fn set_variables(
        &self,
        request: Request<SetVariablesRequest>,
    ) -> Result<Response<SetVariablesResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({
            "elementInstanceKey": req.element_instance_key.to_string(),
            "variables": variables_document(&req.variables)?,
            "local": req.local,
        });
        let result = self.state.engine
            .send_command("VARIABLE_DOCUMENT".to_string(), "UPDATE".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(SetVariablesResponse {
            key: key_of(&result["key"]).unwrap_or(0),
        }))
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    async fn publish_message(
        &self,
        request: Request<PublishMessageRequest>,
    ) -> Result<Response<PublishMessageResponse>, Status> {
        let req = request.into_inner();
        let tenant_id = if req.tenant_id.is_empty() { "<default>".to_string() } else { req.tenant_id.clone() };
        let payload = serde_json::json!({
            "messageName": req.name,
            "correlationKey": req.correlation_key,
            "timeToLive": req.time_to_live,
            "messageId": req.message_id,
            "variables": variables_document(&req.variables)?,
            "tenantId": tenant_id,
        });
        let result = self.state.engine
            .send_command("MESSAGE".to_string(), "PUBLISH".to_string(), payload, tenant_id.clone())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(PublishMessageResponse {
            key: key_of(&result["messageKey"]).unwrap_or(0),
            tenant_id,
        }))
    }

    // ── Incidents ─────────────────────────────────────────────────────────────

    async fn resolve_incident(
        &self,
        request: Request<ResolveIncidentRequest>,
    ) -> Result<Response<ResolveIncidentResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({ "incidentKey": req.incident_key.to_string() });
        self.state.engine
            .send_command("INCIDENT".to_string(), "RESOLVE".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(ResolveIncidentResponse {}))
    }

    // ── Signals ───────────────────────────────────────────────────────────────

    async fn broadcast_signal(
        &self,
        request: Request<BroadcastSignalRequest>,
    ) -> Result<Response<BroadcastSignalResponse>, Status> {
        let req = request.into_inner();
        let tenant_id = if req.tenant_id.is_empty() { "<default>".to_string() } else { req.tenant_id.clone() };
        let payload = serde_json::json!({
            "signalName": req.signal_name,
            "variables": variables_document(&req.variables)?,
            "tenantId": tenant_id,
        });
        let result = self.state.engine
            .send_command("SIGNAL".to_string(), "BROADCAST".to_string(), payload, tenant_id.clone())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(BroadcastSignalResponse {
            key: key_of(&result["signalKey"]).unwrap_or(0),
            tenant_id,
        }))
    }

    // ── Decisions ─────────────────────────────────────────────────────────────

    async fn evaluate_decision(
        &self,
        request: Request<EvaluateDecisionRequest>,
    ) -> Result<Response<EvaluateDecisionResponse>, Status> {
        use reebe_db::StateBackend;
        let req = request.into_inner();
        let tenant_id = if req.tenant_id.is_empty() { "<default>".to_string() } else { req.tenant_id.clone() };
        let variables = variables_document(&req.variables)?;
        // As the REST API's decision evaluation does: the latest decision with the id.
        if req.decision_id.is_empty() {
            return Err(Status::unimplemented("Evaluating a decision by decisionKey is not supported; give its decisionId"));
        }
        let backend = reebe_db::SqlxBackend::new(self.state.pool.clone());
        let dmn_xml = backend
            .get_dmn_xml_by_decision_id(&req.decision_id)
            .await
            .map_err(|e| Status::internal(e.to_string()))?
            .ok_or_else(|| Status::not_found(format!("Expected to evaluate decision '{}', but no such decision found", req.decision_id)))?;
        let drg = reebe_dmn::parse_dmn(&dmn_xml).map_err(|e| Status::internal(format!("DMN parse error: {e}")))?;
        let decision_name = drg
            .decisions
            .iter()
            .find(|d| d.id == req.decision_id)
            .map(|d| d.name.clone())
            .unwrap_or_default();
        let (decision_output, failure_message, failed_decision_id) =
            match reebe_dmn::evaluate_decision(&drg, &req.decision_id, &variables) {
                Ok(output) => (output.to_string(), String::new(), String::new()),
                Err(e) => ("null".to_string(), e.to_string(), req.decision_id.clone()),
            };
        Ok(Response::new(EvaluateDecisionResponse {
            decision_key: req.decision_key,
            decision_id: req.decision_id,
            decision_name,
            decision_version: 0,
            decision_requirements_key: 0,
            decision_requirements_id: String::new(),
            decision_output,
            evaluated_decisions: vec![],
            failed_decision_id,
            failure_message,
            tenant_id,
            process_instance_key: 0,
        }))
    }

    // ── Resources ─────────────────────────────────────────────────────────────

    async fn delete_resource(
        &self,
        request: Request<DeleteResourceRequest>,
    ) -> Result<Response<DeleteResourceResponse>, Status> {
        let req = request.into_inner();
        let payload = serde_json::json!({ "resourceKey": req.resource_key.to_string() });
        self.state.engine
            .send_command("RESOURCE".to_string(), "DELETE".to_string(), payload, "<default>".to_string())
            .await
            .map_err(engine_err)?;
        Ok(Response::new(DeleteResourceResponse {}))
    }
}

/// Poll the DB until a process instance reaches a terminal state.
async fn wait_for_instance_completion(pool: &DbPool, instance_key: i64) -> Result<String, String> {
    use reebe_db::state::process_instances::ProcessInstanceRepository;
    let repo = ProcessInstanceRepository::new(pool);
    loop {
        tokio::time::sleep(Duration::from_millis(100)).await;
        match repo.get_by_key(instance_key).await {
            Ok(pi) if matches!(pi.state.as_str(), "COMPLETED" | "TERMINATED" | "CANCELED") => {
                // Future: fetch and return variables from the root scope
                return Ok("{}".to_string());
            }
            Ok(_) => {} // still running, keep polling
            Err(e) => return Err(e.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use prost::Message;

    /// A length-delimited field: tag, length, bytes.
    fn field(number: u8, bytes: &[u8]) -> Vec<u8> {
        let mut out = vec![(number << 3) | 2, bytes.len() as u8];
        out.extend_from_slice(bytes);
        out
    }

    #[test]
    fn complete_job_result_decodes_from_zeebe_s_field_numbers_and_maps_to_the_rest_payload() {
        // CompleteJobRequest { jobKey = 1: 42, variables = 2: {"agent":1},
        //   result = 3: JobResult { type = 4, activateElements = 5 { elementId = 1, variables = 2 },
        //   isCompletionConditionFulfilled = 6: false, isCancelRemainingInstances = 7: true } }
        let element = [field(1, b"tool"), field(2, br#"{"toolCall":{"q":"x"}}"#)].concat();
        let result = [field(4, b"adHocSubProcess"), field(5, &element), vec![6 << 3, 0], vec![7 << 3, 1]].concat();
        let bytes = [vec![1 << 3, 42], field(2, br#"{"agent":1}"#), field(3, &result)].concat();
        let req = CompleteJobRequest::decode(bytes.as_slice()).unwrap();

        assert_eq!(complete_job_payload(req).unwrap(), serde_json::json!({
            "jobKey": "42",
            "variables": { "agent": 1 },
            "result": {
                "type": "adHocSubProcess",
                "activateElements": [{ "elementId": "tool", "variables": { "toolCall": { "q": "x" } } }],
                "isCompletionConditionFulfilled": false,
                "isCancelRemainingInstances": true,
            },
        }));
    }

    #[test]
    fn a_variables_document_must_be_a_json_object_as_in_zeebe_s_gateway() {
        assert_eq!(variables_document("").unwrap(), serde_json::json!({}));
        assert_eq!(variables_document("null").unwrap(), serde_json::json!({}));
        assert_eq!(variables_document(r#"{"a":1}"#).unwrap(), serde_json::json!({ "a": 1 }));
        let invalid = variables_document("{a").unwrap_err();
        assert_eq!((invalid.code(), invalid.message()), (tonic::Code::InvalidArgument, "Invalid JSON value: {a"));
        for (json, kind) in [("[]", "ARRAY"), (r#""x""#, "STRING"), ("true", "BOOLEAN"), ("1", "INTEGER"), ("1.5", "FLOAT")] {
            let status = variables_document(json).unwrap_err();
            assert_eq!(status.code(), tonic::Code::InvalidArgument);
            assert_eq!(
                status.message(),
                format!("Property 'variables' is invalid: Expected document to be a root level object, but was '{kind}'"),
            );
        }
    }

    #[test]
    fn create_process_instance_names_the_definition_by_what_is_given() {
        let by_id = CreateProcessInstanceRequest { bpmn_process_id: "p".into(), version: -1, ..Default::default() };
        assert_eq!(
            create_process_instance_payload(&by_id, "<default>").unwrap(),
            serde_json::json!({ "bpmnProcessId": "p", "version": -1, "variables": {}, "tenantId": "<default>" }),
        );
        let by_key = CreateProcessInstanceRequest { process_definition_key: 42, variables: r#"{"x":1}"#.into(), ..Default::default() };
        assert_eq!(
            create_process_instance_payload(&by_key, "t").unwrap(),
            serde_json::json!({ "processDefinitionKey": "42", "version": 0, "variables": { "x": 1 }, "tenantId": "t" }),
        );
    }

    #[test]
    fn complete_job_maps_user_task_corrections_and_no_result() {
        let req = CompleteJobRequest {
            job_key: 7,
            variables: String::new(),
            result: Some(JobResult {
                denied: Some(true),
                denied_reason: Some("no".into()),
                corrections: Some(JobResultCorrections {
                    assignee: Some("ann".into()),
                    candidate_groups: Some(StringList { values: vec!["ops".into()] }),
                    priority: Some(80),
                    ..Default::default()
                }),
                ..Default::default()
            }),
        };
        assert_eq!(complete_job_payload(req).unwrap()["result"], serde_json::json!({
            "denied": true,
            "deniedReason": "no",
            "corrections": { "assignee": "ann", "candidateGroups": ["ops"], "priority": 80 },
        }));

        let req = CompleteJobRequest { job_key: 7, variables: "{}".into(), result: None };
        assert_eq!(complete_job_payload(req).unwrap(), serde_json::json!({ "jobKey": "7", "variables": {}, "result": null }));

        let req = CompleteJobRequest { job_key: 7, variables: "[1]".into(), result: None };
        assert_eq!(complete_job_payload(req).unwrap_err().code(), tonic::Code::InvalidArgument);
    }
}
