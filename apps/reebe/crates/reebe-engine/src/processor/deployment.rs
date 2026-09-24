use std::sync::Arc;
use async_trait::async_trait;
use base64::Engine as Base64Engine;
use reebe_db::records::DbRecord;
use reebe_db::state::deployments::{Deployment, ProcessDefinition};
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{EventToWrite, RecordProcessor, Writers};

pub struct DeploymentProcessor;

#[async_trait]
impl RecordProcessor for DeploymentProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        value_type == "DEPLOYMENT" && intent == "CREATE"
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let deployment_key = key_gen.next_key().await?;

        let tenant_id = record.tenant_id.clone();
        let payload = &record.payload;

        // Parse resources from payload
        let resources = payload["resources"]
            .as_array()
            .cloned()
            .unwrap_or_default();

        // Insert deployment record
        let deployment = Deployment {
            key: deployment_key,
            tenant_id: tenant_id.clone(),
            created_at: state.clock.now(),
        };
        state.backend.insert_deployment(&deployment).await?;

        let mut deployed_processes = Vec::new();

        for resource in &resources {
            let resource_name = resource["name"]
                .as_str()
                .unwrap_or("process.bpmn")
                .to_string();

            // Decode base64 content
            let content = resource["content"].as_str().unwrap_or("");
            let xml_bytes = base64::engine::general_purpose::STANDARD
                .decode(content)
                .map_err(|e| EngineError::BpmnParse(format!("Base64 decode error: {e}")))?;
            let xml = String::from_utf8(xml_bytes)
                .map_err(|e| EngineError::BpmnParse(format!("UTF-8 decode error: {e}")))?;

            // If the resource is a DMN file (has at least one decision), store each
            // decision and skip BPMN parsing. BPMN also parses without error (same root
            // element name) but yields zero decisions, so we must guard on non-empty.
            if let Ok(drg) = reebe_dmn::parse_dmn(&xml) {
                if !drg.decisions.is_empty() {
                    for decision in &drg.decisions {
                        state.backend.insert_decision_xml(&decision.id, &xml).await
                            .unwrap_or_else(|e| tracing::warn!("Failed to store DMN decision {}: {e}", decision.id));
                    }
                    continue;
                }
            }

            // Parse BPMN
            let deployment_obj = reebe_bpmn::BpmnDeployment::from_xml(&xml, &resource_name)
                .map_err(|e| EngineError::BpmnParse(e.to_string()))?;

            // Validate
            for process in &deployment_obj.processes {
                let errors = reebe_bpmn::validate_bpmn(process);
                if !errors.is_empty() {
                    let msg = errors.iter().map(|e| e.to_string()).collect::<Vec<_>>().join("; ");
                    return Err(EngineError::BpmnParse(msg));
                }
            }

            for process in &deployment_obj.processes {
                // Get next version
                let previous = state.backend
                    .get_latest_process_definition(&process.id, &tenant_id)
                    .await
                    .ok();
                let version = previous.as_ref().map_or(1, |p| p.version + 1);

                let pd_key = key_gen.next_key().await?;

                let pd = ProcessDefinition {
                    key: pd_key,
                    bpmn_process_id: process.id.clone(),
                    version,
                    tenant_id: tenant_id.clone(),
                    deployment_key,
                    resource_name: resource_name.clone(),
                    bpmn_xml: xml.clone(),
                    bpmn_checksum: Some(deployment_obj.checksum.clone()),
                };

                state.backend.insert_process_definition(&pd).await?;
                super::start_event::register(state, process, &pd, previous.as_ref()).await?;

                // Populate the in-memory cache with the parsed BPMN processes.
                let cached_processes = deployment_obj.processes.clone();
                state.process_def_cache.insert(crate::process_def_cache::CachedProcessDef {
                    key: pd_key,
                    bpmn_process_id: process.id.clone(),
                    version,
                    tenant_id: tenant_id.clone(),
                    processes: std::sync::Arc::new(cached_processes),
                });

                deployed_processes.push(serde_json::json!({
                    "processDefinitionKey": pd_key.to_string(),
                    "bpmnProcessId": process.id,
                    "version": version,
                    "resourceName": resource_name,
                    "tenantId": tenant_id,
                }));
            }
        }

        // Write DEPLOYMENT.CREATED event
        writers.events.push(EventToWrite {
            value_type: "DEPLOYMENT".to_string(),
            intent: "CREATED".to_string(),
            key: deployment_key,
            payload: serde_json::json!({
                "deploymentKey": deployment_key.to_string(),
                "resources": resources,
                "tenantId": tenant_id,
            }),
        });

        // Set response
        writers.response = Some(serde_json::json!({
            "deploymentKey": deployment_key.to_string(),
            "deployments": deployed_processes,
            "tenantId": tenant_id,
        }));

        Ok(())
    }
}
