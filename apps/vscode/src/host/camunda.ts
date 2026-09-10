/**
 * Deploying the open diagram to a Camunda 8 cluster, and starting an instance.
 *
 * The clusters are the ones `casen` already knows about: this reads the same
 * profile store the CLI writes, so there is no second place to configure a
 * connection and no credentials living in workspace settings. A profile holds
 * secrets; nothing in here returns one, logs one, or puts one in a message.
 *
 * Deployment goes over `fetch` with a multipart body, the way `casen deploy`
 * does, because the endpoint takes files. Starting an instance goes through the
 * generated `CamundaClient`, because that one takes JSON and is typed.
 */

import {
	createClientFromProfile,
	getActiveName,
	getAuthHeader,
	listProfiles,
} from "@bpmnkit/profiles"

/** A cluster the user has already configured, named only. */
export interface DeployTarget {
	readonly name: string
	readonly active: boolean
	/** Where it points, for disambiguating two profiles with similar names. */
	readonly baseUrl: string
}

/** A process definition the cluster accepted. */
export interface DeployedProcess {
	readonly processDefinitionId: string
	readonly processDefinitionKey: string
	readonly version: number
}

/** Raised with a message worth showing the user as it is. */
export class DeployError extends Error {}

/**
 * The Camunda 8 profiles `casen` knows about, active one first.
 *
 * Admin profiles are left out: they authenticate against the administration
 * API and cannot deploy a process, so offering one is offering a failure.
 */
export function listDeployTargets(): DeployTarget[] {
	const active = getActiveName()
	return listProfiles()
		.filter((profile) => profile.apiType === "c8" && profile.config.baseUrl !== undefined)
		.map((profile) => ({
			name: profile.name,
			active: profile.name === active,
			baseUrl: profile.config.baseUrl ?? "",
		}))
		.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
}

/** The process definitions in a deployment response, ignoring decisions and forms. */
export function deployedProcesses(result: unknown): DeployedProcess[] {
	if (typeof result !== "object" || result === null) return []
	const items = (result as { deployments?: unknown }).deployments
	if (!Array.isArray(items)) return []

	const processes: DeployedProcess[] = []
	for (const item of items) {
		const definition = (item as { processDefinition?: Record<string, unknown> }).processDefinition
		if (definition === undefined) continue
		const id = definition.processDefinitionId
		const key = definition.processDefinitionKey
		if (typeof id !== "string" || typeof key !== "string") continue
		processes.push({
			processDefinitionId: id,
			processDefinitionKey: key,
			version:
				typeof definition.processDefinitionVersion === "number"
					? definition.processDefinitionVersion
					: 0,
		})
	}
	return processes
}

/**
 * Reads the variables a user typed into a JSON object.
 *
 * Empty means no variables, which is different from invalid: starting an
 * instance with no data is the common case and should not require typing `{}`.
 *
 * @throws DeployError when the text is not a JSON object.
 */
export function parseVariables(text: string): Record<string, unknown> {
	const trimmed = text.trim()
	if (trimmed === "") return {}

	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed)
	} catch (error) {
		throw new DeployError(`Variables must be JSON: ${(error as Error).message}`)
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new DeployError('Variables must be a JSON object, e.g. {"amount": 100}')
	}
	return parsed as Record<string, unknown>
}

/**
 * Deploys one resource file to a profile's cluster.
 *
 * @param profileName - A name from {@link listDeployTargets}.
 * @param filename - The name the cluster should record the resource under.
 * @param content - The file's text.
 */
export async function deployResource(
	profileName: string,
	filename: string,
	content: string,
): Promise<DeployedProcess[]> {
	const target = listProfiles().find((profile) => profile.name === profileName)
	const baseUrl = target?.config.baseUrl
	if (target === undefined || baseUrl === undefined) {
		throw new DeployError(`No Camunda 8 profile named "${profileName}".`)
	}

	const body = new FormData()
	body.append("resources[]", new Blob([content], { type: "application/octet-stream" }), filename)

	let response: Response
	try {
		response = await fetch(`${baseUrl.replace(/\/$/, "")}/v2/deployments`, {
			method: "POST",
			headers: { authorization: await getAuthHeader(target.config) },
			body,
		})
	} catch (error) {
		throw new DeployError(`Could not reach ${baseUrl}: ${(error as Error).message}`)
	}

	if (!response.ok) {
		throw new DeployError(`Deploy failed (${response.status}): ${await response.text()}`)
	}
	return deployedProcesses(await response.json())
}

/** Starts an instance of a deployed process definition. Returns its key. */
export async function startInstance(
	profileName: string,
	processDefinitionKey: string,
	variables: Record<string, unknown>,
): Promise<string> {
	const client = createClientFromProfile(profileName)
	const result = await client.processInstance.createProcessInstance({
		processDefinitionKey,
		variables,
	})
	return result.processInstanceKey
}
