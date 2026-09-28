// Public API: createOperate() and its option/result types.
export { createOperate } from "./operate.js"

// @internal — the detail views and their stores are exported for BPMN Kit
// Studio, which embeds them. They are not part of the stable API.
export { createDefinitionDetailView } from "./views/definition-detail.js"
export { createInstanceDetailView } from "./views/instance-detail.js"
export { createDecisionDetailView } from "./views/decision-detail.js"
export { DefinitionsStore } from "./stores/definitions.js"
export { InstancesStore } from "./stores/instances.js"
export { DecisionsStore } from "./stores/decisions.js"

export type {
	DashboardData,
	IncidentResult,
	JobSearchResult,
	OperateApi,
	OperateOptions,
	ProcessDefinitionResult,
	ProcessInstanceResult,
	ProfileInfo,
	Theme,
	UserTaskResult,
	VariableResult,
} from "./types.js"
