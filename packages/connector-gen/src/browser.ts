/**
 * Browser-safe entry point for `@bpmnkit/connector-gen`.
 *
 * Identical to the main entry except `writeTemplates` is excluded — that
 * function depends on `node:fs/promises` and `node:path` which are not
 * available in browser environments. Use this entry point when bundling for
 * the browser (e.g. with Vite or webpack).
 *
 * @packageDocumentation
 */

export { buildTemplate, buildTemplates } from "./build-template.js"
export { CATALOG, getCatalogEntry } from "./catalog.js"
export type { CatalogEntry } from "./catalog.js"
export {
	detectDefaultAuth,
	getBaseUrl,
	getOperations,
	getServers,
	isRef,
	parseOpenApi,
	resolve,
	resolveRef,
} from "./parse-openapi.js"
export type { DetectedAuth } from "./parse-openapi.js"
export type {
	ApiResponse,
	AuthHint,
	Binding,
	Components,
	ConnectorGroup,
	ConnectorTemplate,
	Constraints,
	GeneratorOptions,
	HttpMethod,
	MediaType,
	OpenApiDoc,
	OpenApiInfo,
	OpenApiServer,
	Operation,
	OperationWithMeta,
	OAuthFlows,
	Parameter,
	PathItem,
	PropertyDef,
	Ref,
	RequestBody,
	Schema,
	SecurityRequirement,
	WriteOptions,
} from "./types.js"
export { CONNECTOR_SCHEMA } from "./types.js"

import { buildTemplates } from "./build-template.js"
import type { CatalogEntry } from "./catalog.js"
import { CATALOG, getCatalogEntry } from "./catalog.js"
import { detectDefaultAuth, getOperations, parseOpenApi } from "./parse-openapi.js"
import type { ConnectorTemplate, GeneratorOptions } from "./types.js"

export interface GenerateOptions extends GeneratorOptions {
	filter?: GeneratorOptions["filter"]
}

/**
 * Parse an OpenAPI spec (string or object) and generate connector templates.
 */
export function generate(specText: string, opts: GeneratorOptions): ConnectorTemplate[] {
	const doc = parseOpenApi(specText)
	const defaultAuth = opts.defaultAuthType ?? detectDefaultAuth(doc)
	const ops = getOperations(doc, opts.filter)
	return buildTemplates(ops, { ...opts, defaultAuthType: defaultAuth })
}

/**
 * Download an OpenAPI spec from a URL and generate connector templates.
 */
export async function generateFromUrl(
	url: string,
	opts: GeneratorOptions,
): Promise<{ templates: ConnectorTemplate[] }> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`Failed to fetch spec from ${url}: ${res.status} ${res.statusText}`)
	const text = await res.text()
	const templates = generate(text, opts)
	return { templates }
}

/**
 * Generate connector templates from a catalog entry by ID.
 */
export async function generateFromCatalog(
	id: string,
	overrides: Partial<GenerateOptions> = {},
): Promise<{ templates: ConnectorTemplate[]; entry: CatalogEntry }> {
	const entry = getCatalogEntry(id)
	if (!entry) {
		const ids = CATALOG.map((e) => e.id).join(", ")
		throw new Error(`Unknown catalog entry "${id}". Available: ${ids}`)
	}
	const opts: GenerateOptions = {
		idPrefix: overrides.idPrefix ?? entry.idPrefix,
		defaultAuthType: overrides.defaultAuthType ?? entry.defaultAuth,
		...overrides,
	}
	const { templates } = await generateFromUrl(entry.url, opts)
	return { templates, entry }
}
