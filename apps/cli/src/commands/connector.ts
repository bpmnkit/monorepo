import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { getTemplate, listConnectors, searchConnectors } from "@bpmnkit/connectors"
import type { Command, CommandGroup } from "../types.js"

const searchCmd: Command = {
	name: "search",
	description:
		"Search the bundled Camunda 8 out-of-the-box connector catalog (Slack, HTTP, AWS, AI Agent, …)",
	args: [
		{ name: "query", description: 'Search terms, e.g. "slack" or "send email"', required: true },
	],
	examples: [{ description: "Find the Slack connector", command: "casen connector search slack" }],
	async run(ctx) {
		const query = ctx.positional.join(" ")
		const results = searchConnectors(query)
		if (results.length === 0) {
			ctx.output.info(`No connectors matched "${query}". Try 'casen connector list' to browse all.`)
			return
		}
		ctx.output.printList({ items: results }, [
			{ key: "id", header: "TEMPLATE ID", maxWidth: 48 },
			{ key: "direction", header: "DIRECTION", maxWidth: 18 },
			{ key: "taskType", header: "TASK TYPE", maxWidth: 32 },
			{ key: "description", header: "DESCRIPTION", maxWidth: 50 },
		])
	},
}

const listCatalogCmd: Command = {
	name: "list",
	description: "List all bundled Camunda 8 out-of-the-box connector templates",
	async run(ctx) {
		ctx.output.printList({ items: listConnectors() }, [
			{ key: "id", header: "TEMPLATE ID", maxWidth: 48 },
			{ key: "direction", header: "DIRECTION", maxWidth: 18 },
			{ key: "taskType", header: "TASK TYPE", maxWidth: 32 },
		])
	},
}

const showCmd: Command = {
	name: "show",
	description: "Show a connector template's required/optional input keys",
	args: [
		{
			name: "templateId",
			description: "Template id, e.g. io.camunda.connectors.Slack.v1",
			required: true,
		},
	],
	examples: [
		{
			description: "Show the Slack connector's inputs",
			command: "casen connector show io.camunda.connectors.Slack.v1",
		},
	],
	async run(ctx) {
		const templateId = ctx.positional[0]
		if (!templateId) throw new Error("Missing required argument: <templateId>")

		const summary =
			searchConnectors(templateId).find((s) => s.id === templateId) ??
			listConnectors().find((s) => s.id === templateId)
		if (!summary || !getTemplate(templateId)) {
			throw new Error(
				`Unknown connector template "${templateId}". Use 'casen connector search <query>' to find one.`,
			)
		}

		ctx.output.info(`${summary.name}  (${summary.id})`)
		if (summary.taskType) ctx.output.info(`Task type: ${summary.taskType}`)
		ctx.output.info(`Direction: ${summary.direction}`)
		if (summary.description) ctx.output.info(summary.description)

		if (summary.requiredInputs.length > 0) {
			ctx.output.info("\nRequired inputs:")
			for (const i of summary.requiredInputs) {
				ctx.output.info(`  ${i.key}${i.isSecret ? " (secret)" : ""} — ${i.label}`)
			}
		}
		if (summary.optionalInputs.length > 0) {
			ctx.output.info("\nOptional inputs:")
			for (const i of summary.optionalInputs) {
				ctx.output.info(`  ${i.key}${i.isSecret ? " (secret)" : ""} — ${i.label}`)
			}
		}
	},
}

export const connectorGroup: CommandGroup = {
	name: "connector",
	description: "Generate Camunda REST connector element templates from OpenAPI specs",
	commands: [
		{
			name: "generate",
			description: "Generate connector templates from a local OpenAPI spec or catalog entry",
			flags: [
				{
					name: "swagger",
					short: "s",
					description: "Path to a local OpenAPI/Swagger file (YAML or JSON)",
					type: "string",
				},
				{
					name: "api",
					description: "Catalog API id (e.g. github, stripe). Use 'connector catalog' to list.",
					type: "string",
				},
				{
					name: "output",
					short: "o",
					description: "Output directory (default: ./connector-templates)",
					type: "string",
				},
				{ name: "base-url", description: "Override the base URL from the spec", type: "string" },
				{
					name: "id-prefix",
					description: "Reverse-DNS id prefix (default: io.generated)",
					type: "string",
				},
				{
					name: "filter",
					description: "Regex filter on operationId/summary (case-insensitive)",
					type: "string",
				},
				{
					name: "expand-body",
					description: "Decompose top-level request body properties into individual fields",
					type: "boolean",
					default: false,
				},
				{
					name: "auth",
					description:
						"Default auth type: noAuth, apiKey, basic, bearer, oauth-client-credentials-flow",
					type: "string",
				},
				{
					name: "format",
					description: "Output format: one-per-op (default) or array (single file)",
					type: "string",
				},
				{
					name: "dry-run",
					description: "Print templates to stdout without writing files",
					type: "boolean",
					default: false,
				},
			],
			examples: [
				{
					description: "Generate from a local file",
					command: "casen connector generate --swagger ./petstore.yaml --output ./out",
				},
				{
					description: "Generate from the GitHub catalog entry",
					command: "casen connector generate --api github --output ./out --filter issues",
				},
				{
					description: "Dry run (print to stdout)",
					command: "casen connector generate --swagger ./spec.yaml --dry-run",
				},
			],
			async run(ctx) {
				// Lazy import so the CLI doesn't load yaml on startup
				const { generate, generateFromUrl, CATALOG, getCatalogEntry } = await import(
					"@bpmnkit/connector-gen"
				)

				const swaggerPath = ctx.flags.swagger as string | undefined
				const apiId = ctx.flags.api as string | undefined
				const outputDir = (ctx.flags.output as string | undefined) ?? "./connector-templates"
				const baseUrl = ctx.flags["base-url"] as string | undefined
				const idPrefix = (ctx.flags["id-prefix"] as string | undefined) ?? "io.generated"
				const filter = ctx.flags.filter as string | undefined
				const expandBody = ctx.flags["expand-body"] === true
				const authFlag = ctx.flags.auth as string | undefined
				const format = (ctx.flags.format as "one-per-op" | "array" | undefined) ?? "one-per-op"
				const dryRun = ctx.flags["dry-run"] === true

				const validAuth = [
					"noAuth",
					"apiKey",
					"basic",
					"bearer",
					"oauth-client-credentials-flow",
				] as const
				type AuthHint = (typeof validAuth)[number]
				if (authFlag && !validAuth.includes(authFlag as AuthHint)) {
					throw new Error(`Unknown --auth value "${authFlag}". Valid: ${validAuth.join(", ")}`)
				}
				const defaultAuthType = authFlag as AuthHint | undefined

				if (!swaggerPath && !apiId) {
					throw new Error(
						"Provide either --swagger <file> or --api <id>. Use 'casen connector catalog' to list catalog entries.",
					)
				}
				if (swaggerPath && apiId) {
					throw new Error("Use either --swagger or --api, not both.")
				}

				const opts = { idPrefix, baseUrl, expandBody, filter, defaultAuthType }

				if (swaggerPath) {
					const absPath = resolve(swaggerPath)
					const text = await readFile(absPath, "utf8")
					const templates = generate(text, opts)

					if (dryRun) {
						ctx.output.print(templates)
						ctx.output.info(`Would generate ${templates.length} template(s)`)
						return
					}

					const { writeTemplates } = await import("@bpmnkit/connector-gen")
					const files = await writeTemplates(templates, { outputDir: resolve(outputDir), format })
					ctx.output.ok(`Generated ${files.length} template(s) → ${resolve(outputDir)}`)
					for (const f of files) ctx.output.info(`  ${f}`)
					return
				}

				// API catalog path
				if (!apiId) return
				const entry = getCatalogEntry(apiId)
				if (!entry) {
					const ids = CATALOG.map((e) => e.id).join(", ")
					throw new Error(`Unknown catalog entry "${apiId}". Available: ${ids}`)
				}

				ctx.output.info(`Downloading spec for "${entry.name}" …`)
				const { generateFromUrl: _gfu } = { generateFromUrl }
				const { templates, files } = await generateFromUrl(entry.url, {
					...opts,
					idPrefix: opts.idPrefix === "io.generated" ? entry.idPrefix : opts.idPrefix,
					defaultAuthType: opts.defaultAuthType ?? entry.defaultAuth,
					...(dryRun ? {} : { outputDir: resolve(outputDir), format }),
				})

				if (dryRun) {
					ctx.output.print(templates)
					ctx.output.info(`Would generate ${templates.length} template(s)`)
					return
				}

				ctx.output.ok(`Generated ${files.length} template(s) → ${resolve(outputDir)}`)
				for (const f of files) ctx.output.info(`  ${f}`)
			},
		},
		{
			name: "catalog",
			description: "List available API catalog entries",
			examples: [{ description: "Show all catalog entries", command: "casen connector catalog" }],
			async run(ctx) {
				const { CATALOG } = await import("@bpmnkit/connector-gen")
				ctx.output.printList(
					{
						items: CATALOG.map((e) => ({
							id: e.id,
							name: e.name,
							auth: e.defaultAuth,
							description: e.description,
						})),
					},
					[
						{ key: "id", header: "ID", maxWidth: 16 },
						{ key: "name", header: "NAME", maxWidth: 30 },
						{ key: "auth", header: "AUTH", maxWidth: 32 },
						{ key: "description", header: "DESCRIPTION", maxWidth: 60 },
					],
				)
			},
		},
		searchCmd,
		listCatalogCmd,
		showCmd,
	],
}
