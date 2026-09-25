/**
 * Element templates for one diagram, found by convention.
 *
 * The extension host has a filesystem, so it resolves templates the way Camunda
 * Desktop Modeler does — per file: every `.camunda/element-templates/` from the
 * diagram's folder up to the workspace folder, the nearest winning — by calling
 * `discoverElementTemplates` directly. No proxy is involved. The same upward
 * walk `payloads.ts` does for `.camunda/payloads/`.
 *
 * What consumes them here is the Problems panel: a connector's required inputs
 * are checked against the template this diagram actually sees, as `casen lint`
 * does, rather than against the bundled catalogue alone.
 */

import {
	type ElementTemplate,
	applyConnectorTemplate,
	applyElementTemplate,
} from "@bpmnkit/connectors"
import { discoverElementTemplates } from "@bpmnkit/connectors/node"

/** Answers "which required inputs are unset" for the `connector/*` lint rule. */
export type ConnectorRequirementsResolver = (templateId: string, boundKeys: string[]) => string[]

/**
 * A resolver that prefers the given templates, then falls back to the bundled
 * catalogue. Scoped to one diagram rather than registered globally, so two
 * open files in different folders are never judged by each other's templates.
 */
export function requirementsResolver(
	templates: readonly ElementTemplate[],
): ConnectorRequirementsResolver {
	const own = new Map(templates.map((t) => [t.id, t]))
	return (templateId, boundKeys) => {
		const values = Object.fromEntries(boundKeys.map((k) => [k, "x"]))
		const template = own.get(templateId)
		const result = template
			? applyElementTemplate(template, values)
			: applyConnectorTemplate(templateId, values)
		// Only a missing required value is a finding; an unknown key just means a
		// bound name differs from the property's lookup key.
		return result.problems
			.filter((p) => p.kind === "missing-required" && p.key !== undefined)
			.map((p) => p.key as string)
	}
}

/**
 * The resolver for a diagram on disk.
 *
 * @param file - The diagram's path.
 * @param root - Where the walk stops — the workspace folder. Without it only
 *   the diagram's own folder is searched, never the whole disk above it.
 */
export async function resolverForFile(
	file: string,
	root: string | undefined,
): Promise<ConnectorRequirementsResolver> {
	const { templates } = await discoverElementTemplates({ from: file, root: root ?? file })
	return requirementsResolver(templates)
}
