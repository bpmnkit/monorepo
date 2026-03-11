import { adminCommandGroups } from "../generated/admin-commands.js"
import {
	decisionDefinitionGroup,
	decisionRequirementsGroup,
	generatedCommandGroups,
	processDefinitionGroup,
	userTaskGroup,
} from "../generated/commands.js"
import type { CommandGroup } from "../types.js"
import {
	getDmnReqsXmlCmd,
	getDmnXmlCmd,
	getStartFormCmd,
	getUserTaskFormCmd,
	getXmlCmd,
	renderBpmnCmd,
} from "./bpmn.js"
import { completionGroup } from "./completion.js"
import { profileGroup } from "./profile.js"
import { computeRelations } from "./relations.js"

// Inject custom commands into generated groups without modifying generated files.
// Also remove the broken generated get-x-m-l commands (return text/xml, not JSON)
// and replace getstart-form / get-form with ASCII-rendering variants.
const customisedGroups: CommandGroup[] = generatedCommandGroups.map((g) => {
	if (g === processDefinitionGroup) {
		const commands = g.commands.filter((c) => c.name !== "get-x-m-l" && c.name !== "getstart-form")
		return { ...g, commands: [...commands, getXmlCmd, renderBpmnCmd, getStartFormCmd] }
	}
	if (g === decisionDefinitionGroup) {
		const commands = g.commands.filter((c) => c.name !== "get-x-m-l")
		return { ...g, commands: [...commands, getDmnXmlCmd] }
	}
	if (g === decisionRequirementsGroup) {
		const commands = g.commands.filter((c) => c.name !== "get-x-m-l")
		return { ...g, commands: [...commands, getDmnReqsXmlCmd] }
	}
	if (g === userTaskGroup) {
		const commands = g.commands.filter((c) => c.name !== "get-form")
		return { ...g, commands: [...commands, getUserTaskFormCmd] }
	}
	return g
})

const allGroups = [profileGroup, ...customisedGroups, ...adminCommandGroups, completionGroup]

// Sort alphabetically by name for the main menu
export const commandGroups: CommandGroup[] = allGroups.sort((a, b) => a.name.localeCompare(b.name))

// Compute follow-up relations between commands based on shared field/arg names
computeRelations(commandGroups)
