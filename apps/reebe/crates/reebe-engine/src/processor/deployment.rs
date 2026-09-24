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
        let mut deployed_decisions = Vec::new();
        let mut deployed_drgs = Vec::new();

        let mut decoded = Vec::new();
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

            // A DMN resource has at least one decision. BPMN also parses without error
            // (same root element name) but yields zero decisions.
            let drg = reebe_dmn::parse_dmn(&xml).ok().filter(|drg| !drg.decisions.is_empty());
            let duplicate = match &drg {
                Some(drg) => dmn::is_duplicate(state, drg, &resource_name, &xml, &tenant_id).await?,
                None => false,
            };
            decoded.push((resource_name, xml, drg, duplicate));
        }
        // As in Zeebe, a deployment of nothing but resources deployed before creates no
        // new versions; otherwise every resource of it gets a new version.
        let duplicates_only = decoded.iter().all(|(_, _, _, duplicate)| *duplicate);

        for (resource_name, xml, drg, duplicate) in decoded {
            if let Some(drg) = drg {
                let deployed = dmn::deploy(state, &key_gen, dmn::Resource {
                    drg: &drg,
                    resource_name: &resource_name,
                    xml: &xml,
                    tenant_id: &tenant_id,
                    deployment_key,
                    keep_latest: duplicate && duplicates_only,
                }).await?;
                deployed_drgs.push(deployed.drg);
                deployed_decisions.extend(deployed.decisions);
                continue;
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
                super::ad_hoc::check_from_ai_calls(&process.elements)
                    .map_err(|message| EngineError::BpmnParse(format!("'{resource_name}': {message}")))?;
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
            "decisions": deployed_decisions,
            "decisionRequirements": deployed_drgs,
            "tenantId": tenant_id,
        }));

        Ok(())
    }
}

/// DMN resources, versioned as Zeebe's `DmnResourceTransformer` versions them.
mod dmn {
    use reebe_db::state::decisions::{DecisionDefinition, DecisionRequirements};
    use reebe_dmn::DmnDecisionRequirementsGraph;
    use crate::engine::EngineState;
    use crate::error::EngineResult;
    use crate::key_gen::KeyGenerator;

    /// Whether the resource is the latest version of its decision requirements graph
    /// again: the same resource name and content, and every decision in it still has
    /// its latest version in that graph.
    pub(super) async fn is_duplicate(
        state: &EngineState,
        drg: &DmnDecisionRequirementsGraph,
        resource_name: &str,
        xml: &str,
        tenant_id: &str,
    ) -> EngineResult<bool> {
        let Some(latest) = state.backend.get_latest_decision_requirements(&drg.id, tenant_id).await? else {
            return Ok(false);
        };
        if latest.resource_name != resource_name || latest.dmn_xml != xml {
            return Ok(false);
        }
        for decision in &drg.decisions {
            let in_latest = state.backend
                .get_latest_decision_definition(&decision.id, tenant_id)
                .await?
                .is_some_and(|d| d.decision_requirements_key == latest.key);
            if !in_latest {
                return Ok(false);
            }
        }
        Ok(true)
    }

    pub(super) struct Resource<'a> {
        pub drg: &'a DmnDecisionRequirementsGraph,
        pub resource_name: &'a str,
        pub xml: &'a str,
        pub tenant_id: &'a str,
        pub deployment_key: i64,
        /// A duplicate in a deployment of duplicates only: the latest versions stay.
        pub keep_latest: bool,
    }

    pub(super) struct Deployed {
        pub drg: serde_json::Value,
        pub decisions: Vec<serde_json::Value>,
    }

    fn non_empty(name: &str) -> Option<String> {
        Some(name.to_string()).filter(|n| !n.is_empty())
    }

    /// Store a new version of the graph and of each decision in it (the latest
    /// version plus one), or keep the latest versions of a duplicate.
    pub(super) async fn deploy(state: &EngineState, key_gen: &KeyGenerator, r: Resource<'_>) -> EngineResult<Deployed> {
        let latest_drg = state.backend.get_latest_decision_requirements(&r.drg.id, r.tenant_id).await?;
        let drg = match latest_drg {
            Some(latest) if r.keep_latest => latest,
            latest => {
                let drg = DecisionRequirements {
                    key: key_gen.next_key().await?,
                    drg_id: r.drg.id.clone(),
                    name: non_empty(&r.drg.name),
                    version: latest.map_or(1, |l| l.version + 1),
                    tenant_id: r.tenant_id.to_string(),
                    deployment_key: r.deployment_key,
                    resource_name: r.resource_name.to_string(),
                    dmn_xml: r.xml.to_string(),
                };
                state.backend.insert_decision_requirements(&drg).await?;
                drg
            }
        };
        let mut decisions = Vec::new();
        for decision in &r.drg.decisions {
            let latest = state.backend.get_latest_decision_definition(&decision.id, r.tenant_id).await?;
            let deployed = match latest {
                Some(latest) if r.keep_latest => latest,
                latest => {
                    let deployed = DecisionDefinition {
                        key: key_gen.next_key().await?,
                        decision_id: decision.id.clone(),
                        name: non_empty(&decision.name),
                        version: latest.map_or(1, |l| l.version + 1),
                        decision_requirements_key: drg.key,
                        decision_requirements_id: drg.drg_id.clone(),
                        tenant_id: r.tenant_id.to_string(),
                        deployment_key: r.deployment_key,
                        resource_name: r.resource_name.to_string(),
                        dmn_xml: r.xml.to_string(),
                    };
                    state.backend.insert_decision_definition(&deployed).await?;
                    deployed
                }
            };
            decisions.push(serde_json::json!({
                "decisionKey": deployed.key.to_string(),
                "decisionId": deployed.decision_id,
                "decisionName": deployed.name.clone().unwrap_or_default(),
                "version": deployed.version,
                "decisionRequirementsKey": drg.key.to_string(),
                "decisionRequirementsId": drg.drg_id,
                "resourceName": r.resource_name,
                "tenantId": r.tenant_id,
                "duplicate": r.keep_latest,
            }));
        }
        Ok(Deployed {
            drg: serde_json::json!({
                "decisionRequirementsKey": drg.key.to_string(),
                "decisionRequirementsId": drg.drg_id,
                "decisionRequirementsName": drg.name.clone().unwrap_or_default(),
                "version": drg.version,
                "resourceName": r.resource_name,
                "tenantId": r.tenant_id,
                "duplicate": r.keep_latest,
            }),
            decisions,
        })
    }
}
