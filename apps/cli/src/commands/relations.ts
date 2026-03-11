import type { Command, CommandGroup, Relation } from "../types.js"

/**
 * Auto-detect follow-up relations between commands.
 * For each list command (with columns), find commands in any group
 * whose args match column keys. Mutates commands in-place.
 */
export function computeRelations(allGroups: CommandGroup[]): void {
	// Build index: argName → [{ group, cmd }]
	const argIndex = new Map<string, Array<{ group: CommandGroup; cmd: Command }>>()
	for (const group of allGroups) {
		for (const cmd of group.commands) {
			for (const arg of cmd.args ?? []) {
				const existing = argIndex.get(arg.name) ?? []
				existing.push({ group, cmd })
				argIndex.set(arg.name, existing)
			}
		}
	}

	// For each list command that has columns, find related commands
	for (const group of allGroups) {
		for (const cmd of group.commands) {
			if (!cmd.columns || cmd.columns.length === 0) continue

			const relations: Relation[] = []
			const seen = new Set<string>()

			for (const col of cmd.columns) {
				const targets = argIndex.get(col.key) ?? []
				for (const { group: tGroup, cmd: tCmd } of targets) {
					if (tCmd === cmd) continue
					const key = `${tGroup.name}/${tCmd.name}`
					if (seen.has(key)) continue
					seen.add(key)
					relations.push({
						groupName: tGroup.name,
						commandName: tCmd.name,
						description: tCmd.description,
						params: [{ field: col.key, param: col.key }],
					})
				}
			}

			if (relations.length > 0) {
				cmd.relations = relations
			}
		}
	}
}
