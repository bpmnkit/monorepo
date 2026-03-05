import { CamundaClient } from "@bpmn-sdk/api";
import { getActiveProfile, getProfile } from "./profile.js";

/**
 * Create a CamundaClient from a named profile (or the active profile if no
 * name is given). Throws a descriptive error if no matching profile is found.
 */
export function createClientFromProfile(profileName?: string): CamundaClient {
	const profile = profileName ? getProfile(profileName) : getActiveProfile();

	if (!profile) {
		if (profileName) {
			throw new Error(
				`Profile "${profileName}" not found. Run \`casen profile list\` to see available profiles.`,
			);
		}
		throw new Error(
			"No active profile. Create one with:\n\n  casen profile create <name> --base-url <url> --auth-type bearer --token <token>\n",
		);
	}

	return new CamundaClient(profile.config);
}
