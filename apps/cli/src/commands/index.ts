import { adminCommandGroups } from "../generated/admin-commands.js"
import { generatedCommandGroups } from "../generated/commands.js"
import type { CommandGroup } from "../types.js"
import { completionGroup } from "./completion.js"
import { profileGroup } from "./profile.js"

export const commandGroups: CommandGroup[] = [
	profileGroup,
	...generatedCommandGroups,
	...adminCommandGroups,
	completionGroup,
]
