// ─── OpenAPI 3.x types (minimal subset needed for generation) ─────────────────

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options" | "trace"

export interface OpenApiDoc {
	openapi: string
	info: OpenApiInfo
	externalDocs?: { url?: string; description?: string }
	servers?: OpenApiServer[]
	paths?: Record<string, PathItem | Ref>
	components?: Components
	security?: SecurityRequirement[]
}

export interface OpenApiInfo {
	title: string
	version: string
	description?: string
}

export interface OpenApiServer {
	url: string
	description?: string
	variables?: Record<string, { default: string; description?: string; enum?: string[] }>
}

export interface PathItem {
	summary?: string
	description?: string
	get?: Operation
	put?: Operation
	post?: Operation
	delete?: Operation
	options?: Operation
	head?: Operation
	patch?: Operation
	trace?: Operation
	parameters?: Array<Parameter | Ref>
}

export interface Operation {
	operationId?: string
	summary?: string
	description?: string
	tags?: string[]
	parameters?: Array<Parameter | Ref>
	requestBody?: RequestBody | Ref
	responses?: Record<string, ApiResponse | Ref>
	security?: SecurityRequirement[]
	deprecated?: boolean
	externalDocs?: { url?: string; description?: string }
}

export interface Parameter {
	name: string
	in: "query" | "header" | "path" | "cookie"
	description?: string
	required?: boolean
	deprecated?: boolean
	schema?: Schema | Ref
}

export interface RequestBody {
	description?: string
	required?: boolean
	content: Record<string, MediaType>
}

export interface MediaType {
	schema?: Schema | Ref
}

export interface ApiResponse {
	description?: string
	content?: Record<string, MediaType>
}

export interface Schema {
	type?: string
	format?: string
	title?: string
	description?: string
	properties?: Record<string, Schema | Ref>
	required?: string[]
	items?: Schema | Ref
	enum?: unknown[]
	default?: unknown
	nullable?: boolean
	allOf?: Array<Schema | Ref>
	oneOf?: Array<Schema | Ref>
	anyOf?: Array<Schema | Ref>
	$ref?: string
}

export interface Ref {
	$ref: string
}

export interface Components {
	schemas?: Record<string, Schema | Ref>
	parameters?: Record<string, Parameter | Ref>
	requestBodies?: Record<string, RequestBody | Ref>
	responses?: Record<string, ApiResponse | Ref>
	securitySchemes?: Record<string, SecurityScheme | Ref>
}

export type SecurityScheme =
	| { type: "apiKey"; name: string; in: "header" | "query" | "cookie"; description?: string }
	| { type: "http"; scheme: string; bearerFormat?: string; description?: string }
	| { type: "oauth2"; flows: OAuthFlows; description?: string }
	| { type: "openIdConnect"; openIdConnectUrl: string; description?: string }

export interface OAuthFlows {
	clientCredentials?: { tokenUrl: string; scopes?: Record<string, string> }
	authorizationCode?: {
		authorizationUrl: string
		tokenUrl: string
		scopes?: Record<string, string>
	}
}

export type SecurityRequirement = Record<string, string[]>

// ─── Enriched operation (ready for template generation) ───────────────────────

export interface OperationWithMeta {
	path: string
	method: HttpMethod
	operation: Operation
	baseUrl: string
	pathParams: Parameter[]
	queryParams: Parameter[]
	headerParams: Parameter[]
	requestBodySchema: Schema | null
	responseSchema: Schema | null
}

// ─── Connector template types ─────────────────────────────────────────────────

export const CONNECTOR_SCHEMA =
	"https://unpkg.com/@camunda/zeebe-element-templates-json-schema/resources/schema.json"

export interface ConnectorTemplate {
	$schema: string
	name: string
	id: string
	version: number
	description?: string
	documentationRef?: string
	category?: { id: string; name: string }
	appliesTo: string[]
	elementType: { value: string }
	engines?: { camunda?: string }
	groups: ConnectorGroup[]
	properties: PropertyDef[]
	icon?: { contents: string }
	metadata?: { keywords?: string[] }
}

export interface ConnectorGroup {
	id: string
	label: string
	tooltip?: string
	openByDefault?: boolean
}

export type Binding =
	| { type: "zeebe:taskDefinition"; property: "type" | "retries" }
	| { type: "zeebe:input"; name: string }
	| { type: "zeebe:output"; name: string }
	| { type: "zeebe:taskHeader"; key: string }
	| { type: "zeebe:property"; name: string }

export interface Condition {
	property: string
	equals?: string
	oneOf?: string[]
	type?: "simple"
}

export interface Constraints {
	notEmpty?: boolean
	pattern?: { value: string; message?: string }
	minLength?: number
	maxLength?: number
}

export interface PropertyDef {
	id?: string
	label?: string
	description?: string
	type: "String" | "Text" | "Number" | "Boolean" | "Dropdown" | "Hidden"
	value?: string | boolean | number
	group?: string
	binding: Binding
	feel?: "optional" | "required" | "static"
	optional?: boolean
	constraints?: Constraints
	condition?: Condition
	choices?: Array<{ name: string; value: string }>
	tooltip?: string
}

// ─── Generator options ────────────────────────────────────────────────────────

export type AuthHint = "noAuth" | "apiKey" | "basic" | "bearer" | "oauth-client-credentials-flow"

export interface GeneratorOptions {
	/** Reverse-DNS prefix for template IDs, e.g. "io.mycompany" */
	idPrefix: string
	/** Override the base URL from the spec */
	baseUrl?: string
	/** Decompose top-level request body properties into individual fields */
	expandBody?: boolean
	/** Filter operations by operationId/summary regex */
	filter?: string
	/** Pre-select a specific auth type */
	defaultAuthType?: AuthHint
}

export interface WriteOptions {
	outputDir: string
	/** "one-per-op": one file per operation; "array": all in one file */
	format?: "one-per-op" | "array"
}
