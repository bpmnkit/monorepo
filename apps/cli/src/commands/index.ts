import type { CommandGroup } from "../types.js";
import { authorizationGroup } from "./authorization.js";
import { batchOperationGroup } from "./batch-operation.js";
import { clusterGroup } from "./cluster.js";
import { completionGroup } from "./completion.js";
import { decisionGroup } from "./decision.js";
import { elementInstanceGroup } from "./element-instance.js";
import { groupGroup } from "./group.js";
import { incidentGroup } from "./incident.js";
import { jobGroup } from "./job.js";
import { mappingRuleGroup } from "./mapping-rule.js";
import { messageGroup } from "./message.js";
import { processDefinitionGroup } from "./process-definition.js";
import { processInstanceGroup } from "./process-instance.js";
import { profileGroup } from "./profile.js";
import { resourceGroup } from "./resource.js";
import { roleGroup } from "./role.js";
import { signalGroup } from "./signal.js";
import { tenantGroup } from "./tenant.js";
import { userTaskGroup } from "./user-task.js";
import { userGroup } from "./user.js";
import { variableGroup } from "./variable.js";

export const commandGroups: CommandGroup[] = [
	profileGroup,
	processInstanceGroup,
	processDefinitionGroup,
	jobGroup,
	userTaskGroup,
	incidentGroup,
	variableGroup,
	messageGroup,
	signalGroup,
	decisionGroup,
	resourceGroup,
	userGroup,
	groupGroup,
	roleGroup,
	tenantGroup,
	authorizationGroup,
	batchOperationGroup,
	elementInstanceGroup,
	mappingRuleGroup,
	clusterGroup,
	completionGroup,
];
