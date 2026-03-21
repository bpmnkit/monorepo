import { adminCommandGroups } from "../generated/admin-commands.js"
import {
	decisionDefinitionGroup,
	decisionRequirementsGroup,
	generatedCommandGroups,
	jobGroup,
	processDefinitionGroup,
	userTaskGroup,
} from "../generated/commands.js"
import type { CommandGroup } from "../types.js"
import { askGroup } from "./ask.js"
import {
	getDmnReqsXmlCmd,
	getDmnXmlCmd,
	getStartFormCmd,
	getUserTaskFormCmd,
	getXmlCmd,
	renderBpmnCmd,
} from "./bpmn.js"
import { completionGroup } from "./completion.js"
import { connectorGroup } from "./connector.js"
import { pluginGroup } from "./plugin.js"
import { profileGroup } from "./profile.js"
import { computeRelations } from "./relations.js"
import { settingsGroup } from "./settings.js"
import { workerCmd } from "./worker.js"

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
	if (g === jobGroup) {
		return g
	}
	return g
})

const sortedOtherGroups = [
	connectorGroup,
	...customisedGroups,
	...adminCommandGroups,
	completionGroup,
].sort((a, b) => a.name.localeCompare(b.name))

const workerGroup: CommandGroup = {
	name: "worker",
	description: workerCmd.description,
	commands: [workerCmd],
}

/** Pinned groups shown above the separator in the main TUI menu. */
export const pinnedGroups: CommandGroup[] = [askGroup, settingsGroup, workerGroup]

/** API command groups — shown below the plugin section in the main TUI menu. */
export const apiGroups: CommandGroup[] = sortedOtherGroups

/** All built-in groups — used for CLI routing. */
export const commandGroups: CommandGroup[] = [...pinnedGroups, ...apiGroups]

// Exported for CLI routing in run.ts (not shown in main TUI menu)
export { pluginGroup, profileGroup }

// Compute follow-up relations between commands based on shared field/arg names
computeRelations(commandGroups)

// Manually inject relations on GET commands (they return a single object, not a
// list, so they have no `columns` and are skipped by computeRelations).
const piGroup = commandGroups.find((g) => g.name === "process-instance")
const pdGroup = commandGroups.find((g) => g.name === "process-definition")
const piGetCmd = piGroup?.commands.find((c) => c.name === "get")
const pdGetCmd = pdGroup?.commands.find((c) => c.name === "get")
const pdRelations = [
	{
		groupName: "process-definition",
		commandName: "get",
		description: "View process definition",
		params: [{ field: "processDefinitionKey", param: "processDefinitionKey" }],
	},
	{
		groupName: "process-definition",
		commandName: "render",
		description: "Render BPMN diagram",
		params: [{ field: "processDefinitionKey", param: "processDefinitionKey" }],
	},
	{
		groupName: "process-definition",
		commandName: "get-xml",
		description: "Get BPMN XML",
		params: [{ field: "processDefinitionKey", param: "processDefinitionKey" }],
	},
]
if (piGetCmd) {
	piGetCmd.relations = pdRelations
}
if (pdGetCmd) {
	pdGetCmd.relations = pdRelations.filter((r) => r.commandName !== "get")
}
