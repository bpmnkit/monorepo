import { AdminApiClient, CamundaClient } from "@bpmnkit/api"
import { getActiveProfile, getProfile } from "./profile.js"

function requireProfile(profileName?: string) {
	const profile = profileName ? getProfile(profileName) : getActiveProfile()
	if (!profile) {
		if (profileName) {
			throw new Error(
				`Profile "${profileName}" not found. Run \`casen profile list\` to see available profiles.`,
			)
		}
		throw new Error(
			"No active profile. Create one with:\n\n  casen profile create <name> --base-url <url> --auth-type bearer --token <token>\n",
		)
	}
	return profile
}

export function createClientFromProfile(profileName?: string): CamundaClient {
	return new CamundaClient(requireProfile(profileName).config)
}

export function createAdminClientFromProfile(profileName?: string): AdminApiClient {
	return new AdminApiClient(requireProfile(profileName).config)
}
