import { buildRelations } from "@bpmnkit/api"
import type { CommandGroup } from "../types.js"

/**
 * Auto-detect follow-up relations between commands using the shared
 * buildRelations() from @bpmnkit/api. Converts CommandGroups to generic
 * RelationSources, computes the graph, and wires results back to commands.
 * Mutates commands in-place.
 */
export function computeRelations(allGroups: CommandGroup[]): void {
	// Convert to generic RelationSources
	const sources = allGroups.flatMap((group) =>
		group.commands.map((cmd) => ({
			groupName: group.name,
			commandName: cmd.name,
			description: cmd.description,
			outputFields: cmd.columns?.map((c) => c.key) ?? [],
			inputParams: cmd.args?.map((a) => a.name) ?? [],
		})),
	)

	const relationsMap = buildRelations(sources)

	// Apply results back to commands
	for (const group of allGroups) {
		for (const cmd of group.commands) {
			const relations = relationsMap.get(`${group.name}/${cmd.name}`)
			if (relations) {
				cmd.relations = relations
			}
		}
	}
}
