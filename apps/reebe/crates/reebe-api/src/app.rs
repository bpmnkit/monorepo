use std::sync::Arc;
use std::time::Duration;
use axum::Router;
use axum::routing::{delete, get, patch, post};
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use reebe_db::DbPool;
use reebe_engine::EngineHandle;
use crate::auth::{auth_middleware, AuthConfig, AuthState};
use crate::handlers;

/// Shared state for all API handlers.
#[derive(Clone)]
pub struct ApiState {
    pub engine: Arc<EngineHandle>,
    /// All engine handles indexed by partition_id. Used for key-based routing.
    pub engines: Vec<Arc<EngineHandle>>,
    /// Total number of partitions.
    pub partition_count: usize,
    pub pool: DbPool,
    /// Read replica pool. When present, read-only handlers use this instead of `pool`
    /// to isolate query traffic from the engine write path.
    pub replica_pool: Option<DbPool>,
    pub metrics_handle: Option<Arc<PrometheusHandle>>,
}

impl ApiState {
    /// Return the engine handle responsible for the given key.
    pub fn engine_for_key(&self, key: i64) -> &Arc<EngineHandle> {
        let idx = reebe_engine::routing::partition_for_key(key, self.partition_count as u32)
            as usize;
        &self.engines[idx.min(self.engines.len() - 1)]
    }

    /// Return the engine handle responsible for the given string key (process id, correlation key).
    pub fn engine_for_str(&self, s: &str) -> &Arc<EngineHandle> {
        let idx = reebe_engine::routing::partition_for_str(s, self.partition_count as u32)
            as usize;
        &self.engines[idx.min(self.engines.len() - 1)]
    }
}

async fn track_request_duration(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let path = req
        .extensions()
        .get::<axum::extract::MatchedPath>()
        .map(|mp| mp.as_str().to_owned())
        .unwrap_or_else(|| req.uri().path().to_owned());
    let method = req.method().as_str().to_owned();
    let start = std::time::Instant::now();
    let response = next.run(req).await;
    let elapsed = start.elapsed().as_secs_f64();
    metrics::histogram!("reebe_api_request_duration_seconds", "endpoint" => path, "method" => method)
        .record(elapsed);
    response
}

/// Create the Axum application with all routes registered.
///
/// `auth_config` controls whether requests must carry a valid token/credentials.
/// When `auth_config.enabled = false` (the default), all requests pass through
/// unauthenticated — identical to Zeebe's default behaviour.
pub async fn create_app(
    engine: Arc<EngineHandle>,
    engines: Vec<Arc<EngineHandle>>,
    partition_count: usize,
    pool: DbPool,
    replica_pool: Option<DbPool>,
    auth_config: AuthConfig,
) -> Router {
    let metrics_handle = PrometheusBuilder::new()
        .install_recorder()
        .ok()
        .map(Arc::new);

    let state = ApiState {
        engine,
        engines,
        partition_count,
        pool: pool.clone(),
        replica_pool,
        metrics_handle,
    };

    let auth_state = Arc::new(AuthState::new(auth_config, pool).await);

    Router::new()
        // Deployments
        .route("/v2/deployments", post(handlers::deployments::create_deployment))

        // Process instances
        .route("/v2/process-instances", post(handlers::process_instances::create_process_instance))
        .route("/v2/process-instances/search", post(handlers::process_instances::search_process_instances))
        .route("/v2/process-instances/:key", get(handlers::process_instances::get_process_instance))
        .route("/v2/process-instances/:key/cancellation", post(handlers::process_instances::cancel_process_instance))
        .route("/v2/process-instances/cancellation", post(handlers::process_instances::batch_cancel_process_instances))
        .route("/v2/process-instances/deletion", post(handlers::process_instances::delete_process_instances))
        .route("/v2/process-instances/migration", post(handlers::process_instances::batch_migrate_process_instances))
        .route("/v2/process-instances/:key/migration", post(handlers::process_instances::migrate_process_instance))
        .route("/v2/process-instances/:key/modification", post(handlers::process_instances::modify_process_instance))
        .route("/v2/process-instances/:key/incident-resolution", post(handlers::process_instances::resolve_incident_for_process_instance))
        .route("/v2/process-instances/:key/call-hierarchy", get(handlers::process_instances::get_call_hierarchy))
        .route("/v2/process-instances/:key/sequence-flows", get(handlers::process_instances::get_sequence_flows))
        .route("/v2/process-instances/:key/incidents/search", post(handlers::process_instances::search_process_instance_incidents))

        // Jobs
        .route("/v2/jobs/activation", post(handlers::jobs::activate_jobs))
        .route("/v2/jobs/search", post(handlers::jobs::search_jobs))
        .route("/v2/jobs/:key", get(handlers::jobs::get_job))
        .route("/v2/jobs/:key/completion", post(handlers::jobs::complete_job))
        .route("/v2/jobs/:key/failure", post(handlers::jobs::fail_job))
        .route("/v2/jobs/:key/error", post(handlers::jobs::throw_error))

        // Messages
        .route("/v2/messages/publication", post(handlers::messages::publish_message))
        .route("/v2/messages/correlation", post(handlers::messages::correlate_message))
        .route("/v2/message-subscriptions/search", post(handlers::messages::search_message_subscriptions))

        // Incidents
        .route("/v2/incidents/search", post(handlers::incidents::search_incidents))
        .route("/v2/incidents/:key", get(handlers::incidents::get_incident))
        .route("/v2/incidents/:key/resolution", post(handlers::incidents::resolve_incident))

        // Variables
        .route("/v2/variables/search", post(handlers::variables::search_variables))
        .route("/v2/variables/:key", get(handlers::variables::get_variable))

        // User tasks
        .route("/v2/user-tasks/search", post(handlers::user_tasks::search_user_tasks))
        .route("/v2/user-tasks/:key", get(handlers::user_tasks::get_user_task))
        .route("/v2/user-tasks/:key/completion", post(handlers::user_tasks::complete_user_task))
        .route("/v2/user-tasks/:key/assignment", post(handlers::user_tasks::assign_user_task))
        .route("/v2/user-tasks/:key/assignee", delete(handlers::user_tasks::unassign_user_task))

        // Process definitions
        .route("/v2/process-definitions/search", post(handlers::process_definitions::search))
        .route("/v2/process-definitions/:key", get(handlers::process_definitions::get))
        .route("/v2/process-definitions/:key/xml", get(handlers::process_definitions::get_xml))

        // Element instances
        .route("/v2/element-instances/search", post(handlers::element_instances::search))
        .route("/v2/element-instances/:key", get(handlers::element_instances::get))
        .route(
            "/v2/element-instances/ad-hoc-activities/:key/activation",
            post(handlers::element_instances::activate_ad_hoc_activities),
        )

        // Signals
        .route("/v2/signals/broadcast", post(handlers::signals::broadcast))

        // OpenAPI spec and Swagger UI
        .route("/v2/api-docs", get(handlers::openapi::openapi_spec))
        .route("/v2/swagger-ui", get(handlers::openapi::swagger_ui))

        // System
        .route("/v2/topology", get(handlers::system::topology))
        .route("/v2/status", get(handlers::system::status))
        .route("/v2/license", get(handlers::system::license))
        .route("/actuator/health", get(handlers::system::actuator_health))
        .route("/metrics", get(handlers::metrics::metrics_handler))

        // Identity - Users
        .route("/v2/users", post(handlers::identity::create_user))
        .route("/v2/users/search", post(handlers::identity::search_users))
        .route("/v2/users/:username", get(handlers::identity::get_user))
        .route("/v2/users/:username", delete(handlers::identity::delete_user))

        // Identity - Tenants
        .route("/v2/tenants", post(handlers::identity::create_tenant))
        .route("/v2/tenants/search", post(handlers::identity::search_tenants))
        .route("/v2/tenants/:id", get(handlers::identity::get_tenant))
        .route("/v2/tenants/:id", patch(handlers::identity::patch_tenant))
        .route("/v2/tenants/:id/deletion", post(handlers::identity::delete_tenant))

        // Identity - Roles
        .route("/v2/roles", post(handlers::identity::create_role))
        .route("/v2/roles/search", post(handlers::identity::search_roles))
        .route("/v2/roles/:id", get(handlers::identity::get_role))
        .route("/v2/roles/:id/deletion", post(handlers::identity::delete_role))

        // Identity - Groups
        .route("/v2/groups", post(handlers::identity::create_group))
        .route("/v2/groups/search", post(handlers::identity::search_groups))
        .route("/v2/groups/:id", get(handlers::identity::get_group))
        .route("/v2/groups/:id/deletion", post(handlers::identity::delete_group))

        // Authentication
        .route("/v2/authentication/me", get(handlers::identity::get_current_user))

        // Decision definitions
        .route("/v2/decision-definitions/search", post(handlers::decisions::search_decision_definitions))
        .route("/v2/decision-definitions/:key", get(handlers::decisions::get_decision_definition))

        // Decision instances
        .route("/v2/decision-instances/search", post(handlers::decisions::search_decision_instances))

        // Decision requirements
        .route("/v2/decision-requirements/search", post(handlers::decisions::search_decision_requirements))

        // Decision evaluation
        .route("/v2/decision-definitions/evaluation", post(handlers::decisions::evaluate_decision))
        .route("/v2/decisions/evaluation", post(handlers::decisions::evaluate_decision))

        // Resources
        .route("/v2/resources/:key", get(handlers::resources::get_resource))
        .route("/v2/resources/:key/deletion", post(handlers::resources::delete_resource))
        .route("/v2/resources/:key/content", get(handlers::resources::get_resource_content))

        // Batch operations
        .route("/v2/batch-operations/search", post(handlers::batch_operations::search_batch_operations))
        .route("/v2/batch-operations/:key", get(handlers::batch_operations::get_batch_operation))

        // Statistics
        .route("/v2/process-definitions/:key/statistics/element-instances", get(handlers::statistics::element_instance_statistics))
        .route("/v2/incidents/statistics/process-instances-by-definition", post(handlers::statistics::incidents_by_definition))
        .route("/v2/incidents/statistics/process-instances-by-error", post(handlers::statistics::incidents_by_error))
        .route("/v2/jobs/statistics/global", get(handlers::statistics::jobs_statistics_global))
        .route("/v2/jobs/statistics/by-types", post(handlers::statistics::jobs_statistics_by_type))
        .route("/v2/jobs/statistics/by-workers", post(handlers::statistics::jobs_statistics_by_worker))

        // Expression evaluation
        .route("/v2/expression/evaluation", post(handlers::expressions::evaluate_expression))

        // Clock management
        .route("/v2/clock", get(handlers::clock::get_clock))
        .route("/v2/clock", post(handlers::clock::pin_clock))
        .route("/v2/clock/reset", post(handlers::clock::reset_clock))

        // System configuration and usage
        .route("/v2/system/configuration", get(handlers::system::get_configuration))
        .route("/v2/system/usage-metrics", post(handlers::system::usage_metrics))

        // Setup
        .route("/v2/setup/user", post(handlers::system::setup_user))

        // Conditionals
        .route("/v2/conditionals/evaluation", post(handlers::admin::evaluate_conditionals))

        // Mapping rules
        .route("/v2/mapping-rules/search", post(handlers::admin::search_mapping_rules))
        .route("/v2/mapping-rules", post(handlers::admin::create_mapping_rule))
        .route("/v2/mapping-rules/:id", delete(handlers::admin::delete_mapping_rule))

        // Admin — Audit logs
        .route("/v2/audit-logs/search", post(handlers::admin::search_audit_logs))

        // Admin — Cluster variables
        .route("/v2/cluster-variables", get(handlers::admin::search_cluster_variables))
        .route("/v2/cluster-variables/:key", get(handlers::admin::get_cluster_variable))

        // Admin — Form models
        .route("/v2/form-models/search", post(handlers::admin::search_form_models))
        .route("/v2/form-models/:key", get(handlers::admin::get_form_model))

        // Admin — Global task listeners
        .route("/v2/global-task-listeners/search", post(handlers::admin::search_global_task_listeners))

        // Admin — Documents
        .route("/v2/documents", post(handlers::admin::create_document))
        .route("/v2/documents/:id", get(handlers::admin::get_document))
        .route("/v2/documents/:id", delete(handlers::admin::delete_document))

        // Identity — Tenant members
        .route("/v2/tenants/:id/users/:username", post(handlers::identity::assign_tenant_user))
        .route("/v2/tenants/:id/users/:username", delete(handlers::identity::remove_tenant_user))
        .route("/v2/tenants/:id/groups/:group_id", post(handlers::identity::assign_tenant_group))
        .route("/v2/tenants/:id/groups/:group_id", delete(handlers::identity::remove_tenant_group))
        .route("/v2/tenants/:id/roles/:role_id", post(handlers::identity::assign_tenant_role))
        .route("/v2/tenants/:id/roles/:role_id", delete(handlers::identity::remove_tenant_role))

        // Identity — Authorizations
        .route("/v2/authorizations", post(handlers::identity::create_authorization))
        .route("/v2/authorizations/search", post(handlers::identity::search_authorizations))
        .route("/v2/authorizations/:key", delete(handlers::identity::delete_authorization))

        .layer(axum::middleware::from_fn_with_state(auth_state, auth_middleware))
        .layer(axum::middleware::from_fn(track_request_duration))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(TimeoutLayer::new(Duration::from_secs(60))),
        )
        .with_state(state)
}
