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
	SecurityScheme,
	WriteOptions,
} from "./types.js"
export { CONNECTOR_SCHEMA } from "./types.js"
export { writeTemplates } from "./write-templates.js"

import { buildTemplates } from "./build-template.js"
import type { CatalogEntry } from "./catalog.js"
import { CATALOG, getCatalogEntry } from "./catalog.js"
import { detectDefaultAuth, getOperations, parseOpenApi } from "./parse-openapi.js"
import type { ConnectorTemplate, GeneratorOptions, WriteOptions } from "./types.js"
import { writeTemplates } from "./write-templates.js"

// ─── High-level convenience API ───────────────────────────────────────────────

export interface GenerateOptions extends GeneratorOptions, Partial<WriteOptions> {
	/** If provided, write files to disk. Otherwise return the templates. */
	outputDir?: string
}

/**
 * Parse an OpenAPI spec (string or object) and generate connector templates.
 * Returns the generated templates; call `writeTemplates` separately if you need
 * to write them to disk.
 */
export function generate(specText: string, opts: GeneratorOptions): ConnectorTemplate[] {
	const doc = parseOpenApi(specText)
	const defaultAuth = opts.defaultAuthType ?? detectDefaultAuth(doc)
	const ops = getOperations(doc, opts.filter)
	return buildTemplates(ops, { ...opts, defaultAuthType: defaultAuth })
}

/**
 * Download an OpenAPI spec from a URL, generate connector templates, and
 * optionally write them to disk.
 */
export async function generateFromUrl(
	url: string,
	opts: GenerateOptions,
): Promise<{ templates: ConnectorTemplate[]; files: string[] }> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`Failed to fetch spec from ${url}: ${res.status} ${res.statusText}`)
	const text = await res.text()
	const templates = generate(text, opts)
	const files = opts.outputDir
		? await writeTemplates(templates, { outputDir: opts.outputDir, format: opts.format })
		: []
	return { templates, files }
}

/**
 * Generate connector templates from a catalog entry by ID.
 * Downloads the spec from the catalog URL.
 */
export async function generateFromCatalog(
	id: string,
	overrides: Partial<GenerateOptions> = {},
): Promise<{ templates: ConnectorTemplate[]; files: string[]; entry: CatalogEntry }> {
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
	const { templates, files } = await generateFromUrl(entry.url, opts)
	return { templates, files, entry }
}
