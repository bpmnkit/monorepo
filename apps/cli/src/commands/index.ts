import { adminCommandGroups } from "../generated/admin-commands.js"
import { generatedCommandGroups, processDefinitionGroup } from "../generated/commands.js"
import type { CommandGroup } from "../types.js"
import { getXmlCmd, renderBpmnCmd } from "./bpmn.js"
import { completionGroup } from "./completion.js"
import { profileGroup } from "./profile.js"
import { computeRelations } from "./relations.js"

// Inject custom commands into generated groups without modifying generated files.
// Also remove the broken generated get-x-m-l command (returns text/xml, not JSON).
const customisedGroups: CommandGroup[] = generatedCommandGroups.map((g) => {
	if (g === processDefinitionGroup) {
		const commands = g.commands.filter((c) => c.name !== "get-x-m-l")
		return { ...g, commands: [...commands, getXmlCmd, renderBpmnCmd] }
	}
	return g
})

const allGroups = [profileGroup, ...customisedGroups, ...adminCommandGroups, completionGroup]

// Sort alphabetically by name for the main menu
export const commandGroups: CommandGroup[] = allGroups.sort((a, b) => a.name.localeCompare(b.name))

// Compute follow-up relations between commands based on shared field/arg names
computeRelations(commandGroups)
