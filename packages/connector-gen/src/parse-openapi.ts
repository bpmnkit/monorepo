import { parse as parseYaml } from "yaml"
import type {
	ApiResponse,
	Components,
	HttpMethod,
	MediaType,
	OpenApiDoc,
	OpenApiServer,
	Operation,
	OperationWithMeta,
	Parameter,
	PathItem,
	Ref,
	RequestBody,
	Schema,
} from "./types.js"

// ─── $ref helpers ─────────────────────────────────────────────────────────────

export function isRef(obj: unknown): obj is Ref {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"$ref" in obj &&
		typeof (obj as Record<string, unknown>).$ref === "string"
	)
}

export function resolveRef<T>(doc: OpenApiDoc, ref: string): T {
	if (!ref.startsWith("#/")) {
		throw new Error(`External $ref not supported: "${ref}". Only local #/ refs are resolved.`)
	}
	const parts = ref.slice(2).split("/")
	let current: unknown = doc
	for (const part of parts) {
		if (typeof current !== "object" || current === null) {
			throw new Error(`Cannot resolve $ref "${ref}": path segment "${part}" is not an object`)
		}
		const decoded = part.replace(/~1/g, "/").replace(/~0/g, "~")
		current = (current as Record<string, unknown>)[decoded]
		if (current === undefined) {
			throw new Error(`Cannot resolve $ref "${ref}": key "${decoded}" not found`)
		}
	}
	return current as T
}

/** Resolve a value that may be a $ref or a concrete type. */
export function resolve<T>(doc: OpenApiDoc, obj: T | Ref): T {
	if (isRef(obj)) return resolveRef<T>(doc, (obj as Ref).$ref)
	return obj
}

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseOpenApi(text: string): OpenApiDoc {
	const trimmed = text.trimStart()
	// JSON starts with { or [; everything else is treated as YAML
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			return JSON.parse(text) as OpenApiDoc
		} catch (e) {
			throw new Error(`Failed to parse OpenAPI JSON: ${String(e)}`)
		}
	}
	try {
		return parseYaml(text) as OpenApiDoc
	} catch (e) {
		throw new Error(`Failed to parse OpenAPI YAML: ${String(e)}`)
	}
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

export function getBaseUrl(doc: OpenApiDoc, override?: string): string {
	if (override) return override.replace(/\/$/, "")
	const server = doc.servers?.[0]
	if (!server) return ""
	let url = server.url.replace(/\/$/, "")
	// Expand server variables with their defaults
	if (server.variables) {
		for (const [key, variable] of Object.entries(server.variables)) {
			url = url.replace(`{${key}}`, variable.default)
		}
	}
	return url
}

// ─── Parameter resolution (path-level params merged with op-level) ────────────

function resolveParameters(doc: OpenApiDoc, pathItem: PathItem, operation: Operation): Parameter[] {
	const all: Array<Parameter | Ref> = [
		...(pathItem.parameters ?? []),
		...(operation.parameters ?? []),
	]
	// Op-level overrides path-level by name+in (later entries win)
	const map = new Map<string, Parameter>()
	for (const item of all) {
		const param = resolve<Parameter>(doc, item)
		map.set(`${param.in}:${param.name}`, param)
	}
	return [...map.values()]
}

// ─── Body / response schema resolution ───────────────────────────────────────

function resolveBodySchema(
	doc: OpenApiDoc,
	requestBody: RequestBody | Ref | undefined,
): Schema | null {
	if (!requestBody) return null
	const body = resolve<RequestBody>(doc, requestBody)
	const json = body.content["application/json"] as MediaType | undefined
	if (!json?.schema) return null
	try {
		return resolve<Schema>(doc, json.schema)
	} catch {
		return null
	}
}

function resolveResponseSchema(
	doc: OpenApiDoc,
	responses: Record<string, ApiResponse | Ref> | undefined,
): Schema | null {
	if (!responses) return null
	const ok = responses["200"] ?? responses["201"] ?? responses["2XX"] ?? responses.default
	if (!ok) return null
	try {
		const resp = resolve<ApiResponse>(doc, ok)
		const json = resp.content?.["application/json"] as MediaType | undefined
		if (!json?.schema) return null
		return resolve<Schema>(doc, json.schema)
	} catch {
		return null
	}
}

// ─── Server validation ────────────────────────────────────────────────────────

function validateDoc(doc: OpenApiDoc): void {
	if (!doc || typeof doc !== "object") {
		throw new Error("Invalid OpenAPI document: must be an object")
	}
	const version = (doc as OpenApiDoc).openapi ?? (doc as unknown as Record<string, unknown>).swagger
	if (typeof version !== "string") {
		throw new Error("Invalid OpenAPI document: missing `openapi` version field")
	}
	if (version.startsWith("2.")) {
		throw new Error(
			`OpenAPI 2.x (Swagger) is not supported. Found version "${version}". Please convert to OpenAPI 3.x first (e.g. using https://editor.swagger.io).`,
		)
	}
}

// ─── Main: enumerate all operations ──────────────────────────────────────────

const HTTP_METHODS: HttpMethod[] = [
	"get",
	"post",
	"put",
	"patch",
	"delete",
	"head",
	"options",
	"trace",
]

export function getOperations(doc: OpenApiDoc, filter?: string): OperationWithMeta[] {
	validateDoc(doc)
	const baseUrl = getBaseUrl(doc)
	const filterRe = filter ? new RegExp(filter, "i") : null
	const results: OperationWithMeta[] = []

	for (const [path, rawPathItem] of Object.entries(doc.paths ?? {})) {
		let pathItem: PathItem
		try {
			pathItem = resolve<PathItem>(doc, rawPathItem)
		} catch {
			continue
		}

		for (const method of HTTP_METHODS) {
			const operation = pathItem[method]
			if (!operation) continue

			if (filterRe) {
				const haystack = `${operation.operationId ?? ""} ${operation.summary ?? ""} ${path}`
				if (!filterRe.test(haystack)) continue
			}

			const params = resolveParameters(doc, pathItem, operation)
			let responseSchema: Schema | null = null
			try {
				responseSchema = resolveResponseSchema(doc, operation.responses)
			} catch {
				// ignore resolution errors for response schemas
			}

			results.push({
				path,
				method,
				operation,
				baseUrl,
				pathParams: params.filter((p) => p.in === "path"),
				queryParams: params.filter((p) => p.in === "query"),
				headerParams: params.filter((p) => p.in === "header"),
				requestBodySchema: resolveBodySchema(doc, operation.requestBody),
				responseSchema,
			})
		}
	}

	return results
}

// ─── Security scheme detection ────────────────────────────────────────────────

export type DetectedAuth =
	| "noAuth"
	| "apiKey"
	| "basic"
	| "bearer"
	| "oauth-client-credentials-flow"

export function detectDefaultAuth(doc: OpenApiDoc): DetectedAuth {
	const schemes = doc.components?.securitySchemes
	if (!schemes) return "noAuth"

	for (const raw of Object.values(schemes)) {
		try {
			const scheme = resolve<{
				type: string
				scheme?: string
				flows?: { clientCredentials?: unknown }
			}>(doc, raw)
			if (scheme.type === "http" && scheme.scheme === "bearer") return "bearer"
			if (scheme.type === "http" && scheme.scheme === "basic") return "basic"
			if (scheme.type === "apiKey") return "apiKey"
			if (scheme.type === "oauth2" && scheme.flows?.clientCredentials) {
				return "oauth-client-credentials-flow"
			}
		} catch {}
	}
	return "noAuth"
}

// Re-export server info helper used downstream
export function getServers(doc: OpenApiDoc): OpenApiServer[] {
	return doc.servers ?? []
}
