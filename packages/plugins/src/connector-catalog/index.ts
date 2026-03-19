/**
 * @bpmnkit/canvas-plugin-connector-catalog — Import API connectors from
 * OpenAPI specs into the BPMN editor via the command palette.
 *
 * Exposes 30+ pre-configured APIs (GitHub, Stripe, Slack, …) as searchable
 * commands in Ctrl+K / ⌘K. Selecting one fetches the spec, generates connector
 * templates via `@bpmnkit/connector-gen`, and registers them in the
 * config-panel-bpmn connector selector — no restart required.
 *
 * Additional commands accept any OpenAPI 3.x spec URL ("Import from OpenAPI
 * URL…") or a local file upload ("Import from OpenAPI file…") for custom,
 * private, or CORS-restricted APIs.
 *
 * ## Usage
 * ```typescript
 * import { createConnectorCatalogPlugin } from "@bpmnkit/plugins/connector-catalog";
 *
 * const catalog = createConnectorCatalogPlugin(configPanelBpmn, palette);
 * const editor = new BpmnEditor({
 *   container, xml,
 *   plugins: [configPanel, configPanelBpmn, palette, catalog],
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin } from "@bpmnkit/canvas"
import {
	CATALOG,
	generate,
	generateFromCatalog,
	generateFromUrl,
} from "@bpmnkit/connector-gen/browser"
import type { ConnectorTemplate } from "@bpmnkit/connector-gen/browser"
import type { CommandPalettePlugin } from "../command-palette/index.js"
import type { ElementTemplate } from "../config-panel-bpmn/index.js"
import {
	CONNECTOR_CATALOG_CSS,
	CONNECTOR_CATALOG_STYLE_ID,
	injectConnectorCatalogStyles,
} from "./css.js"

export { CONNECTOR_CATALOG_CSS, CONNECTOR_CATALOG_STYLE_ID, injectConnectorCatalogStyles }

// ── Public types ──────────────────────────────────────────────────────────────

/** Subset of the config-panel-bpmn plugin API needed by this plugin. */
export interface TemplateRegistrar {
	registerTemplate(template: ElementTemplate): void
}

// ── Toast helper ──────────────────────────────────────────────────────────────

function showToast(message: string, variant: "loading" | "success" | "error"): HTMLElement {
	const el = document.createElement("div")
	el.className = `bpmnkit-cc-toast bpmnkit-cc-toast--${variant}`
	el.setAttribute("role", "status")
	el.setAttribute("aria-live", "polite")
	el.textContent = message
	document.body.append(el)
	return el
}

function resolveToast(
	el: HTMLElement,
	message: string,
	variant: "success" | "error",
	autoDismissMs: number,
): void {
	el.className = `bpmnkit-cc-toast bpmnkit-cc-toast--${variant}`
	el.textContent = message
	setTimeout(() => el.remove(), autoDismissMs)
}

// ── Core logic ────────────────────────────────────────────────────────────────

/**
 * Strips common API descriptor words from an entry name to get a short prefix.
 * "GitHub REST API" → "GitHub", "Twilio Messaging API" → "Twilio".
 */
function derivePrefix(entryName: string): string {
	return entryName
		.replace(
			/\s+(REST|Web|Admin|Management|CRM|Messaging|Mail|Payments|Helix|Email|Transactional)?\s*API\s*$/i,
			"",
		)
		.trim()
}

function withPrefix(templates: ConnectorTemplate[], prefix: string): ConnectorTemplate[] {
	return templates.map((t) => ({ ...t, name: `${prefix}: ${t.name}` }))
}

function registerAll(templates: ConnectorTemplate[], registrar: TemplateRegistrar): void {
	for (const t of templates) {
		registrar.registerTemplate(t as unknown as ElementTemplate)
	}
}

async function loadCatalogEntry(id: string, registrar: TemplateRegistrar): Promise<void> {
	const entry = CATALOG.find((e) => e.id === id)
	const label = entry?.name ?? id
	const toast = showToast(`Importing ${label}…`, "loading")
	try {
		const { templates } = await generateFromCatalog(id)
		const prefix = entry ? derivePrefix(entry.name) : id
		registerAll(withPrefix(templates, prefix), registrar)
		resolveToast(toast, `${templates.length} operations from ${label} added`, "success", 3000)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		resolveToast(toast, `Import failed: ${msg}`, "error", 5000)
	}
}

function loadFromFile(registrar: TemplateRegistrar): void {
	const input = document.createElement("input")
	input.type = "file"
	input.accept = ".json,.yaml,.yml"
	input.onchange = async () => {
		const file = input.files?.[0]
		if (!file) return

		const stem = file.name
			.replace(/\.(json|ya?ml)$/i, "")
			.replace(/[-_.]/g, " ")
			.trim()
		const prefix = stem.charAt(0).toUpperCase() + stem.slice(1) || "Custom"

		const toast = showToast(`Parsing ${file.name}…`, "loading")
		try {
			const text = await file.text()
			const templates = generate(text, { idPrefix: "io.custom" })
			registerAll(withPrefix(templates, prefix), registrar)
			resolveToast(toast, `${templates.length} operations imported`, "success", 3000)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			resolveToast(toast, `Import failed: ${msg}`, "error", 5000)
		}
	}
	input.click()
}

async function loadFromUrl(url: string, registrar: TemplateRegistrar): Promise<void> {
	// Derive idPrefix and a display prefix from the hostname
	let idPrefix = "io.custom"
	let prefix = "Custom"
	try {
		const parts = new URL(url).hostname.split(".").filter(Boolean)
		if (parts.length >= 2) {
			idPrefix = parts.slice(-2).reverse().join(".")
			const last = idPrefix.split(".").at(-1) ?? "custom"
			prefix = last.charAt(0).toUpperCase() + last.slice(1)
		}
	} catch {
		// url was not parseable — idPrefix/prefix stay as fallback
	}

	const toast = showToast("Fetching spec…", "loading")
	try {
		const { templates } = await generateFromUrl(url, { idPrefix })
		registerAll(withPrefix(templates, prefix), registrar)
		resolveToast(toast, `${templates.length} operations imported`, "success", 3000)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		resolveToast(toast, `Import failed: ${msg}`, "error", 5000)
	}
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates the connector catalog plugin.
 *
 * Registers one command per built-in catalog entry plus an "Import from
 * OpenAPI URL" command. All commands appear in the command palette (Ctrl+K /
 * ⌘K). Selecting a catalog entry fetches the spec, generates connector
 * templates, and registers them immediately in the config panel connector
 * selector.
 *
 * @param registrar - The config-panel-bpmn plugin (or any object with
 *   `registerTemplate`).
 * @param palette - The command palette plugin.
 */
export function createConnectorCatalogPlugin(
	registrar: TemplateRegistrar,
	palette: CommandPalettePlugin,
): CanvasPlugin {
	let _deregister: (() => void) | null = null

	return {
		name: "connector-catalog",

		install() {
			injectConnectorCatalogStyles()

			const catalogCmds = CATALOG.map((entry) => ({
				id: `connector-catalog:${entry.id}`,
				title: `Import API: ${entry.name}`,
				description: entry.description,
				action() {
					void loadCatalogEntry(entry.id, registrar)
				},
			}))

			const urlCmd = {
				id: "connector-catalog:url",
				title: "Import from OpenAPI URL\u2026",
				description: "Fetch any OpenAPI 3.x spec from a URL and add its operations",
				action() {
					palette.pushView([], {
						placeholder: "https://\u2026 (OpenAPI 3.x spec URL)",
						onConfirm(url: string) {
							void loadFromUrl(url, registrar)
						},
					})
				},
			}

			const fileCmd = {
				id: "connector-catalog:file",
				title: "Import from OpenAPI file\u2026",
				description: "Upload a local OpenAPI 3.x spec file (.json or .yaml)",
				action() {
					loadFromFile(registrar)
				},
			}

			_deregister = palette.addCommands([...catalogCmds, urlCmd, fileCmd])
		},

		uninstall() {
			_deregister?.()
			_deregister = null
		},
	}
}
