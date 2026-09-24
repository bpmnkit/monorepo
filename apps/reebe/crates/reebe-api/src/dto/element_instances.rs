use serde::{Deserialize, Serialize};
use crate::pagination::PageRequest;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchElementInstancesRequest {
    pub filter: Option<ElementInstanceFilter>,
    pub sort: Option<Vec<serde_json::Value>>,
    pub page: Option<PageRequest>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementInstanceFilter {
    pub process_instance_key: Option<String>,
    pub state: Option<String>,
    pub element_type: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementInstanceDto {
    pub element_instance_key: String,
    pub process_instance_key: String,
    pub process_definition_key: String,
    pub element_id: String,
    pub element_type: String,
    pub state: String,
    pub tenant_id: String,
}

impl From<reebe_db::state::element_instances::ElementInstance> for ElementInstanceDto {
    fn from(ei: reebe_db::state::element_instances::ElementInstance) -> Self {
        Self {
            element_instance_key: ei.key.to_string(),
            process_instance_key: ei.process_instance_key.to_string(),
            process_definition_key: ei.process_definition_key.to_string(),
            element_id: ei.element_id,
            element_type: ei.element_type,
            state: ei.state,
            tenant_id: ei.tenant_id,
        }
    }
}

/// `POST /v2/element-instances/ad-hoc-activities/{key}/activation` body
/// (`AdHocSubProcessActivateActivitiesInstruction`).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateAdHocActivitiesRequest {
    pub elements: Option<Vec<AdHocActivityReference>>,
    #[serde(default)]
    pub cancel_remaining_instances: bool,
}

/// `AdHocSubProcessActivateActivityReference`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdHocActivityReference {
    pub element_id: Option<String>,
    pub variables: Option<serde_json::Map<String, serde_json::Value>>,
}
