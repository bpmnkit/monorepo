import { renderBpmnAscii, renderDmnAscii, renderFormAscii } from "@bpmn-sdk/ascii"
import type { Command } from "../types.js"

// Minimal interface to access the underlying HTTP client on CamundaBaseClient
interface WithHttp {
	http: {
		request<T>(options: {
			method: string
			path: string
			pathParams?: Record<string, string | number>
			accept?: string
			responseType?: "json" | "text"
			cacheable?: boolean
		}): Promise<T>
	}
}

/**
 * Replaces the generated `get-x-m-l` command. The endpoint returns text/xml,
 * so we must set Accept: text/xml and parse the body as text, not JSON.
 * The XML is then rendered as ASCII art via @bpmn-sdk/ascii.
 */
export const getXmlCmd: Command = {
	name: "get-xml",
	description: "Get process definition XML and render as ASCII art",
	args: [{ name: "processDefinitionKey", description: "Process definition key", required: true }],
	async run(ctx) {
		const key = ctx.positional[0]
		if (!key) throw new Error("Missing required argument: <processDefinitionKey>")
		const client = await ctx.getClient()
		const xml = await (client as unknown as WithHttp).http.request<string>({
			method: "GET",
			path: `/process-definitions/${key}/xml`,
			accept: "text/xml",
			responseType: "text",
			cacheable: true,
		})
		if (!xml) throw new Error("No XML returned for this process definition")
		const art = renderBpmnAscii(xml)
		ctx.output.print(art)
	},
}

/**
 * Fetches a process definition's BPMN XML and renders it as ASCII art.
 * Injected into the generated process-definition command group.
 */
export const renderBpmnCmd: Command = {
	name: "render",
	description: "Render process definition as ASCII art in the terminal",
	args: [{ name: "processDefinitionKey", description: "Process definition key", required: true }],
	async run(ctx) {
		const key = ctx.positional[0]
		if (!key) throw new Error("Missing required argument: <processDefinitionKey>")
		// Reuse the XML fetch + render logic
		await getXmlCmd.run(ctx)
	},
}

// ── DMN ───────────────────────────────────────────────────────────────────────

/**
 * Replaces the generated `get-x-m-l` command on decision-definition.
 * Fetches DMN XML and renders it as ASCII art.
 */
export const getDmnXmlCmd: Command = {
	name: "get-xml",
	description: "Get decision definition XML and render as ASCII art",
	args: [{ name: "decisionDefinitionKey", description: "Decision definition key", required: true }],
	async run(ctx) {
		const key = ctx.positional[0]
		if (!key) throw new Error("Missing required argument: <decisionDefinitionKey>")
		const client = await ctx.getClient()
		const xml = await (client as unknown as WithHttp).http.request<string>({
			method: "GET",
			path: `/decision-definitions/${key}/xml`,
			accept: "text/xml",
			responseType: "text",
			cacheable: true,
		})
		if (!xml) throw new Error("No XML returned for this decision definition")
		ctx.output.print(renderDmnAscii(xml))
	},
}

/**
 * Replaces the generated `get-x-m-l` command on decision-requirements.
 * Fetches DMN requirements XML and renders it as ASCII art.
 */
export const getDmnReqsXmlCmd: Command = {
	name: "get-xml",
	description: "Get decision requirements XML and render as ASCII art",
	args: [
		{ name: "decisionRequirementsKey", description: "Decision requirements key", required: true },
	],
	async run(ctx) {
		const key = ctx.positional[0]
		if (!key) throw new Error("Missing required argument: <decisionRequirementsKey>")
		const client = await ctx.getClient()
		const xml = await (client as unknown as WithHttp).http.request<string>({
			method: "GET",
			path: `/decision-requirements/${key}/xml`,
			accept: "text/xml",
			responseType: "text",
			cacheable: true,
		})
		if (!xml) throw new Error("No XML returned for this decision requirements")
		ctx.output.print(renderDmnAscii(xml))
	},
}

// ── Forms ─────────────────────────────────────────────────────────────────────

interface FormResult {
	schema?: unknown
}

function renderFormResult(result: unknown, ctx: Parameters<Command["run"]>[0]): void {
	const schema = (result as FormResult).schema
	if (!schema) {
		ctx.output.print("(no form schema)")
		return
	}
	// The Camunda API returns `schema` as a JSON-encoded string even though the
	// generated TypeScript type says Record<string, unknown>. Handle both cases.
	const json = typeof schema === "string" ? schema : JSON.stringify(schema)
	ctx.output.print(renderFormAscii(json))
}

/**
 * Replaces the generated `getstart-form` command on process-definition.
 * Fetches the start form schema and renders it as ASCII art.
 */
export const getStartFormCmd: Command = {
	name: "get-start-form",
	description: "Get process start form and render as ASCII art",
	args: [{ name: "processDefinitionKey", description: "Process definition key", required: true }],
	async run(ctx) {
		const key = ctx.positional[0]
		if (!key) throw new Error("Missing required argument: <processDefinitionKey>")
		const client = await ctx.getClient()
		const result = await client.processDefinition.getStartProcessForm(key)
		renderFormResult(result, ctx)
	},
}

/**
 * Replaces the generated `get-form` command on user-task.
 * Fetches the user task form schema and renders it as ASCII art.
 */
export const getUserTaskFormCmd: Command = {
	name: "get-form",
	description: "Get user task form and render as ASCII art",
	args: [{ name: "userTaskKey", description: "User task key", required: true }],
	async run(ctx) {
		const key = ctx.positional[0]
		if (!key) throw new Error("Missing required argument: <userTaskKey>")
		const client = await ctx.getClient()
		const result = await client.userTask.getUserTaskForm(key)
		renderFormResult(result, ctx)
	},
}
