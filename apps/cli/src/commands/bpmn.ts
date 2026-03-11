import { renderBpmnAscii } from "@bpmn-sdk/ascii"
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
