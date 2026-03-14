import { CONNECTOR_SCHEMA as SCHEMA_URL } from "./types.js"
import type {
	AuthHint,
	ConnectorGroup,
	ConnectorTemplate,
	GeneratorOptions,
	OperationWithMeta,
	Parameter,
	PropertyDef,
	Schema,
} from "./types.js"

// ─── Slugify / ID helpers ──────────────────────────────────────────────────────

function slugify(s: string): string {
	return s
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase()
}

function operationName(op: OperationWithMeta): string {
	if (op.operation.operationId) return op.operation.operationId
	// Fallback: METHOD_path_segments
	const segs = op.path
		.split("/")
		.filter(Boolean)
		.map((s) => s.replace(/[{}]/g, ""))
	return `${op.method}_${segs.join("_")}`
}

function toDisplayName(id: string): string {
	// "listRepoIssues" → "List Repo Issues"; "list-repo-issues" → "List Repo Issues"
	return id
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[-_]+/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim()
}

// ─── FEEL URL construction ────────────────────────────────────────────────────

/**
 * Build the URL value and whether it needs FEEL.
 * For paths with parameters (e.g. /repos/{owner}/{repo}), returns a FEEL expression
 * and feel="optional" so it's visible and editable in the modeler.
 */
function buildUrlField(op: OperationWithMeta): PropertyDef {
	const base = op.baseUrl
	const hasPathParams = op.pathParams.length > 0

	if (!hasPathParams) {
		return {
			type: "Hidden",
			value: `${base}${op.path}`,
			binding: { type: "zeebe:input", name: "url" },
		}
	}

	// Build FEEL expression: ="https://api/repos/" + owner + "/" + repo + "/issues"
	const parts = op.path.split(/(\{[^}]+\})/)
	const feelParts = parts.map((part) => {
		const match = /^\{([^}]+)\}$/.exec(part)
		if (match) {
			const paramName = match[1] ?? part.slice(1, -1)
			return paramName // variable reference
		}
		const segment = `${base}${part}`
		return JSON.stringify(segment) // string literal
	})

	// Filter out empty string literals
	const nonEmpty = feelParts.filter((p) => p !== '""')
	const feelExpr = `=${nonEmpty.join(" + ")}`

	return {
		label: "URL",
		type: "String",
		value: feelExpr,
		group: "endpoint",
		feel: "optional",
		binding: { type: "zeebe:input", name: "url" },
		constraints: { notEmpty: true },
	}
}

// ─── Path parameter fields ────────────────────────────────────────────────────

function buildPathParamField(param: Parameter): PropertyDef {
	return {
		id: param.name,
		label: toDisplayName(param.name),
		description: param.description,
		type: "String",
		group: "endpoint",
		feel: "optional",
		binding: { type: "zeebe:input", name: param.name },
		constraints: param.required !== false ? { notEmpty: true } : undefined,
	}
}

// ─── Query parameter field ────────────────────────────────────────────────────

function buildQueryParamsField(queryParams: Parameter[]): PropertyDef {
	if (queryParams.length === 0) {
		return {
			label: "Query parameters",
			type: "Text",
			group: "endpoint",
			feel: "required",
			optional: true,
			binding: { type: "zeebe:input", name: "queryParameters" },
			value: "={}",
		}
	}

	// Build a FEEL context with all params as example keys
	const entries = queryParams.map((p) => `"${p.name}": ${p.name}Value`).join(", ")
	const defaultValue = `={${entries}}`

	const names = queryParams.map((p) => `\`${p.name}\``).join(", ")
	const reqNames = queryParams
		.filter((p) => p.required)
		.map((p) => `\`${p.name}\``)
		.join(", ")

	return {
		label: "Query parameters",
		description: `Available: ${names}${reqNames ? `. Required: ${reqNames}.` : ""} Remove unused keys from the FEEL context.`,
		type: "Text",
		group: "endpoint",
		feel: "required",
		optional: queryParams.every((p) => !p.required),
		binding: { type: "zeebe:input", name: "queryParameters" },
		value: defaultValue,
	}
}

// ─── Headers field ────────────────────────────────────────────────────────────

function buildHeadersField(headerParams: Parameter[]): PropertyDef {
	if (headerParams.length === 0) {
		return {
			label: "Headers",
			type: "Text",
			group: "endpoint",
			feel: "required",
			optional: true,
			binding: { type: "zeebe:input", name: "headers" },
			value: "={}",
		}
	}
	const entries = headerParams.map((p) => `"${p.name}": ${slugify(p.name)}Value`).join(", ")
	return {
		label: "Headers",
		type: "Text",
		group: "endpoint",
		feel: "required",
		optional: headerParams.every((p) => !p.required),
		binding: { type: "zeebe:input", name: "headers" },
		value: `={${entries}}`,
	}
}

// ─── Body field ───────────────────────────────────────────────────────────────

const BODY_METHODS = ["post", "put", "patch"]

function buildBodyFields(op: OperationWithMeta, expandBody: boolean): PropertyDef[] {
	if (!BODY_METHODS.includes(op.method)) return []

	const condition = {
		property: "method",
		oneOf: ["POST", "PUT", "PATCH"],
		type: "simple" as const,
	}

	if (!expandBody || !op.requestBodySchema?.properties) {
		return [
			{
				label: "Request body",
				description: op.requestBodySchema?.description,
				type: "Text",
				group: "payload",
				feel: "required",
				optional: true,
				binding: { type: "zeebe:input", name: "body" },
				value: "={}",
				condition,
			},
		]
	}

	// Expand each top-level property into its own field
	const schema = op.requestBodySchema
	const required = new Set(schema.required ?? [])
	const fields: PropertyDef[] = []

	for (const [name, rawProp] of Object.entries(schema.properties ?? {})) {
		const prop = rawProp as Schema
		const fieldType =
			prop.type === "boolean"
				? "Boolean"
				: prop.type === "number" || prop.type === "integer"
					? "Number"
					: "String"
		fields.push({
			id: `body.${name}`,
			label: toDisplayName(name),
			description: prop.description,
			type: fieldType,
			group: "payload",
			feel: "optional",
			optional: !required.has(name),
			binding: { type: "zeebe:input", name: `body.${name}` },
			constraints: required.has(name) ? { notEmpty: true } : undefined,
			condition,
		})
	}

	return fields
}

// ─── Authentication block ─────────────────────────────────────────────────────

const AUTH_CHOICES = [
	{ name: "No auth", value: "noAuth" },
	{ name: "API key", value: "apiKey" },
	{ name: "Basic auth", value: "basic" },
	{ name: "Bearer token", value: "bearer" },
	{ name: "OAuth 2.0 (Client Credentials)", value: "oauth-client-credentials-flow" },
]

function authCond(equals: string): PropertyDef["condition"] {
	return { property: "authentication.type", equals, type: "simple" }
}

function buildAuthBlock(defaultAuthType: AuthHint = "noAuth"): PropertyDef[] {
	return [
		{
			id: "authentication.type",
			label: "Type",
			type: "Dropdown",
			group: "authentication",
			value: defaultAuthType,
			binding: { type: "zeebe:input", name: "authentication.type" },
			choices: AUTH_CHOICES,
		},
		// API key
		{
			id: "authentication.apiKeyLocation",
			label: "API key location",
			type: "Dropdown",
			group: "authentication",
			value: "headers",
			binding: { type: "zeebe:input", name: "authentication.apiKeyLocation" },
			condition: authCond("apiKey"),
			choices: [
				{ name: "Header", value: "headers" },
				{ name: "Query parameter", value: "query" },
			],
		},
		{
			id: "authentication.apiKeyName",
			label: "API key name",
			type: "String",
			group: "authentication",
			feel: "optional",
			binding: { type: "zeebe:input", name: "authentication.apiKeyName" },
			condition: authCond("apiKey"),
			constraints: { notEmpty: true },
		},
		{
			id: "authentication.apiKeyValue",
			label: "API key value",
			type: "String",
			group: "authentication",
			feel: "optional",
			binding: { type: "zeebe:input", name: "authentication.apiKeyValue" },
			condition: authCond("apiKey"),
			constraints: { notEmpty: true },
		},
		// Basic
		{
			id: "authentication.username",
			label: "Username",
			type: "String",
			group: "authentication",
			feel: "optional",
			binding: { type: "zeebe:input", name: "authentication.username" },
			condition: authCond("basic"),
			constraints: { notEmpty: true },
		},
		{
			id: "authentication.password",
			label: "Password",
			type: "String",
			group: "authentication",
			feel: "optional",
			binding: { type: "zeebe:input", name: "authentication.password" },
			condition: authCond("basic"),
			constraints: { notEmpty: true },
		},
		// Bearer
		{
			id: "authentication.token",
			label: "Bearer token",
			type: "String",
			group: "authentication",
			feel: "optional",
			binding: { type: "zeebe:input", name: "authentication.token" },
			condition: authCond("bearer"),
			constraints: { notEmpty: true },
		},
		// OAuth2 client credentials
		{
			id: "authentication.oauthTokenEndpoint",
			label: "OAuth token endpoint",
			type: "String",
			group: "authentication",
			feel: "optional",
			binding: { type: "zeebe:input", name: "authentication.oauthTokenEndpoint" },
			condition: authCond("oauth-client-credentials-flow"),
			constraints: { notEmpty: true },
		},
		{
			id: "authentication.clientId",
			label: "Client ID",
			type: "String",
			group: "authentication",
			feel: "optional",
			binding: { type: "zeebe:input", name: "authentication.clientId" },
			condition: authCond("oauth-client-credentials-flow"),
			constraints: { notEmpty: true },
		},
		{
			id: "authentication.clientSecret",
			label: "Client secret",
			type: "String",
			group: "authentication",
			feel: "optional",
			binding: { type: "zeebe:input", name: "authentication.clientSecret" },
			condition: authCond("oauth-client-credentials-flow"),
			constraints: { notEmpty: true },
		},
		{
			id: "authentication.clientAuthentication",
			label: "Client authentication",
			type: "Dropdown",
			group: "authentication",
			value: "basicAuthHeader",
			binding: { type: "zeebe:input", name: "authentication.clientAuthentication" },
			condition: authCond("oauth-client-credentials-flow"),
			choices: [
				{ name: "Send as Basic Auth header", value: "basicAuthHeader" },
				{ name: "Send client credentials in body", value: "requestBody" },
			],
		},
		{
			id: "authentication.scopes",
			label: "Scopes",
			type: "String",
			group: "authentication",
			feel: "optional",
			optional: true,
			binding: { type: "zeebe:input", name: "authentication.scopes" },
			condition: authCond("oauth-client-credentials-flow"),
		},
		{
			id: "authentication.audience",
			label: "Audience",
			type: "String",
			group: "authentication",
			feel: "optional",
			optional: true,
			binding: { type: "zeebe:input", name: "authentication.audience" },
			condition: authCond("oauth-client-credentials-flow"),
		},
	]
}

// ─── Timeout block ────────────────────────────────────────────────────────────

function buildTimeoutBlock(): PropertyDef[] {
	return [
		{
			label: "Connection timeout (seconds)",
			type: "Number",
			group: "timeout",
			value: 20,
			feel: "optional",
			optional: true,
			binding: { type: "zeebe:input", name: "connectionTimeoutInSeconds" },
		},
		{
			label: "Read timeout (seconds)",
			type: "Number",
			group: "timeout",
			value: 20,
			feel: "optional",
			optional: true,
			binding: { type: "zeebe:input", name: "readTimeoutInSeconds" },
		},
	]
}

// ─── Output / error / retry blocks ───────────────────────────────────────────

function buildOutputBlock(responseSchema: Schema | null): PropertyDef[] {
	let resultExprHint = ""
	if (responseSchema?.properties) {
		const keys = Object.keys(responseSchema.properties).slice(0, 3)
		if (keys.length > 0) {
			const pairs = keys.map((k) => `${k}: response.body.${k}`).join(", ")
			resultExprHint = `={${pairs}}`
		}
	}
	return [
		{
			label: "Result variable",
			type: "String",
			group: "output",
			feel: "static",
			optional: true,
			binding: { type: "zeebe:taskHeader", key: "resultVariable" },
		},
		{
			label: "Result expression",
			description: resultExprHint
				? `Example: \`${resultExprHint}\``
				: "FEEL expression to extract values from the response",
			type: "Text",
			group: "output",
			feel: "required",
			optional: true,
			binding: { type: "zeebe:taskHeader", key: "resultExpression" },
		},
	]
}

function buildErrorBlock(): PropertyDef[] {
	return [
		{
			label: "Error expression",
			description:
				'Example: `=if error.code = 404 then bpmnError("NOT_FOUND", error.message) else null`',
			type: "Text",
			group: "errors",
			feel: "required",
			optional: true,
			binding: { type: "zeebe:taskHeader", key: "errorExpression" },
		},
	]
}

function buildRetryBlock(): PropertyDef[] {
	return [
		{
			label: "Retries",
			type: "String",
			group: "retries",
			value: "3",
			binding: { type: "zeebe:taskDefinition", property: "retries" },
			constraints: { notEmpty: true },
		},
		{
			label: "Retry backoff",
			description: "ISO 8601 duration, e.g. PT5S for 5 seconds",
			type: "String",
			group: "retries",
			value: "PT0S",
			feel: "static",
			optional: true,
			binding: { type: "zeebe:taskHeader", key: "retryBackoff" },
		},
	]
}

// ─── Standard groups ──────────────────────────────────────────────────────────

const STANDARD_GROUPS: ConnectorGroup[] = [
	{ id: "endpoint", label: "HTTP Endpoint" },
	{ id: "authentication", label: "Authentication" },
	{ id: "timeout", label: "Timeout", openByDefault: false },
	{ id: "payload", label: "Payload" },
	{ id: "output", label: "Output Mapping" },
	{ id: "errors", label: "Error Handling" },
	{ id: "retries", label: "Retries", openByDefault: false },
]

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildTemplate(op: OperationWithMeta, opts: GeneratorOptions): ConnectorTemplate {
	const name = operationName(op)
	const displayName = op.operation.summary ? op.operation.summary : toDisplayName(name)

	const templateId = `${opts.idPrefix}.${slugify(name)}`

	const properties: PropertyDef[] = []

	// 1. Hidden: job type
	properties.push({
		type: "Hidden",
		value: "io.camunda:http-json:1",
		binding: { type: "zeebe:taskDefinition", property: "type" },
	})

	// 2. Hidden: method
	properties.push({
		type: "Hidden",
		value: op.method.toUpperCase(),
		binding: { type: "zeebe:input", name: "method" },
	})

	// 3. URL (hidden if no path params, editable FEEL string if path params)
	properties.push(buildUrlField(op))

	// 4. Path params as individual inputs (above URL display)
	for (const param of op.pathParams) {
		properties.push(buildPathParamField(param))
	}

	// 5. Query parameters
	properties.push(buildQueryParamsField(op.queryParams))

	// 6. Headers
	properties.push(buildHeadersField(op.headerParams))

	// 7. Body (POST/PUT/PATCH only)
	for (const f of buildBodyFields(op, opts.expandBody ?? false)) {
		properties.push(f)
	}

	// 8. Auth block
	for (const f of buildAuthBlock(opts.defaultAuthType)) {
		properties.push(f)
	}

	// 9. Timeout
	for (const f of buildTimeoutBlock()) {
		properties.push(f)
	}

	// 10. Output
	for (const f of buildOutputBlock(op.responseSchema)) {
		properties.push(f)
	}

	// 11. Errors
	for (const f of buildErrorBlock()) {
		properties.push(f)
	}

	// 12. Retries
	for (const f of buildRetryBlock()) {
		properties.push(f)
	}

	// Drop payload group if no body fields
	const hasPayload = properties.some((p) => p.group === "payload")
	const groups = hasPayload ? STANDARD_GROUPS : STANDARD_GROUPS.filter((g) => g.id !== "payload")

	return {
		$schema: SCHEMA_URL,
		name: displayName,
		id: templateId,
		version: 1,
		description: op.operation.description ?? op.operation.summary,
		documentationRef: op.operation.externalDocs?.url,
		category: { id: "connectors", name: "Connectors" },
		appliesTo: ["bpmn:Task"],
		elementType: { value: "bpmn:ServiceTask" },
		groups,
		properties,
	}
}

export function buildTemplates(
	ops: OperationWithMeta[],
	opts: GeneratorOptions,
): ConnectorTemplate[] {
	return ops.map((op) => buildTemplate(op, opts))
}
