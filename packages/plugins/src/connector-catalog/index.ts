/**
 * @bpmnkit/canvas-plugin-connector-catalog — Import API connectors from
 * OpenAPI specs into the BPMN editor via the command palette.
 *
 * Exposes 30+ pre-configured APIs (GitHub, Stripe, Slack, …) as searchable
 * commands in Ctrl+K / ⌘K. Selecting one fetches the spec, generates connector
 * templates via `@bpmnkit/connector-gen`, and registers them in the
 * config-panel-bpmn connector selector — no restart required.
 *
 * An additional "Import from OpenAPI URL…" command accepts any OpenAPI 3.x
 * spec URL for custom or private APIs.
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
import { CATALOG, generateFromCatalog, generateFromUrl } from "@bpmnkit/connector-gen/browser"
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
		registerAll(templates, registrar)
		resolveToast(toast, `${templates.length} operations from ${label} added`, "success", 3000)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		resolveToast(toast, `Import failed: ${msg}`, "error", 5000)
	}
}

async function loadFromUrl(url: string, registrar: TemplateRegistrar): Promise<void> {
	// Derive a simple idPrefix from the hostname (e.g. "api.example.com" → "com.example")
	let idPrefix = "io.custom"
	try {
		const parts = new URL(url).hostname.split(".").filter(Boolean)
		if (parts.length >= 2) {
			idPrefix = parts.slice(-2).reverse().join(".")
		}
	} catch {
		// url was not parseable — idPrefix stays as fallback
	}

	const toast = showToast("Fetching spec…", "loading")
	try {
		const { templates } = await generateFromUrl(url, { idPrefix })
		registerAll(templates, registrar)
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

			_deregister = palette.addCommands([...catalogCmds, urlCmd])
		},

		uninstall() {
			_deregister?.()
			_deregister = null
		},
	}
}
