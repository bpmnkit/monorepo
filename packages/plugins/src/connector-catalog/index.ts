/**
 * @bpmnkit/canvas-plugin-connector-catalog — Import API connectors from
 * OpenAPI specs into the BPMN editor via the command palette and a visual
 * catalog panel.
 *
 * The catalog panel (Ctrl+K → "Browse connectors…") shows two tabs:
 *   • Built-in Workers — bpmnkit workers, always available without a proxy
 *   • Community APIs  — 30+ pre-configured OpenAPI specs (GitHub, Stripe, …)
 *
 * Additional commands accept any OpenAPI 3.x spec URL or a local file upload.
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
import { BUILTIN_WORKER_TEMPLATES } from "./builtin-templates.js"
import {
	CONNECTOR_CATALOG_CSS,
	CONNECTOR_CATALOG_STYLE_ID,
	injectConnectorCatalogStyles,
} from "./css.js"
import { CatalogPanel } from "./panel.js"

export { CONNECTOR_CATALOG_CSS, CONNECTOR_CATALOG_STYLE_ID, injectConnectorCatalogStyles }
export { BUILTIN_WORKER_TEMPLATES }

// ── Public types ──────────────────────────────────────────────────────────────

/** Subset of the config-panel-bpmn plugin API needed by this plugin. */
export interface TemplateRegistrar {
	registerTemplate(template: ElementTemplate): void
}

export interface ConnectorCatalogOptions {
	/** Base URL of the bpmnkit proxy (e.g. "http://localhost:3033"). When set,
	 * built-in worker templates are fetched from `<proxyUrl>/worker-templates`
	 * and registered automatically on plugin install. */
	proxyUrl?: string
	/**
	 * The project root whose own `.camunda/element-templates/` should be loaded,
	 * via `<proxyUrl>/element-templates`. Requires `proxyUrl` — a browser cannot
	 * walk a filesystem, so the proxy does the discovery and hands over the
	 * result.
	 */
	workspaceRoot?: string
	/**
	 * Templates supplied directly by the host, for a host that has them by some
	 * other route than the proxy — its own storage, an extension host, a
	 * download. Registered after the built-ins, so a project's own version of a
	 * connector wins.
	 */
	workspaceTemplates?: ElementTemplate[]
	/** Called when a workspace template could not be loaded, so a host can surface it. */
	onWorkspaceProblem?: (problem: { file: string; path: string; message: string }) => void
}

/** Extended plugin interface — exposes `openCatalog()` for programmatic use. */
export interface ConnectorCatalogPlugin extends CanvasPlugin {
	openCatalog(): void
	/**
	 * Registers more workspace templates after install — for a host that learns
	 * about them later, or whose project root changed.
	 */
	addWorkspaceTemplates(templates: ElementTemplate[]): void
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

/**
 * Pulls a project's own element templates from the proxy and registers them.
 *
 * Registered after the built-ins so a workspace template with the same id wins
 * — a project that ships its own version of a connector means it.
 */
async function loadWorkspaceTemplates(
	proxyUrl: string,
	root: string,
	registrar: TemplateRegistrar,
	onProblem?: ConnectorCatalogOptions["onWorkspaceProblem"],
): Promise<void> {
	try {
		const res = await fetch(`${proxyUrl}/element-templates?root=${encodeURIComponent(root)}`)
		if (!res.ok) return
		const body = (await res.json()) as {
			templates?: ElementTemplate[]
			problems?: Array<{ file: string; path: string; message: string }>
		}
		for (const t of body.templates ?? []) registrar.registerTemplate(t)
		if (onProblem) for (const p of body.problems ?? []) onProblem(p)
	} catch {
		// proxy unavailable — the project's templates simply aren't registered
	}
}

async function loadBuiltinWorkers(proxyUrl: string, registrar: TemplateRegistrar): Promise<void> {
	try {
		const res = await fetch(`${proxyUrl}/worker-templates`)
		if (!res.ok) return
		const templates = (await res.json()) as ElementTemplate[]
		for (const t of templates) {
			registrar.registerTemplate(t)
		}
	} catch {
		// proxy unavailable — built-in workers simply aren't registered
	}
}

async function loadFromUrl(url: string, registrar: TemplateRegistrar): Promise<void> {
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
 * Registers a visual catalog panel (two tabs: Built-in Workers + Community
 * APIs) plus command palette commands for all catalog entries. The panel is
 * accessible via the "Browse connectors…" palette command.
 *
 * Built-in worker templates are registered immediately (static, no proxy).
 * When `options.proxyUrl` is set, additional templates are fetched from the
 * local proxy at startup.
 *
 * @param registrar - The config-panel-bpmn plugin (or any object with
 *   `registerTemplate`).
 * @param palette - The command palette plugin.
 * @param options - Optional configuration.
 */
export function createConnectorCatalogPlugin(
	registrar: TemplateRegistrar,
	palette: CommandPalettePlugin,
	options?: ConnectorCatalogOptions,
): ConnectorCatalogPlugin {
	let _deregister: (() => void) | null = null
	let _panel: CatalogPanel | null = null

	const plugin: ConnectorCatalogPlugin = {
		name: "connector-catalog",

		install() {
			injectConnectorCatalogStyles()

			// Register static built-in worker templates immediately
			for (const t of BUILTIN_WORKER_TEMPLATES) {
				registrar.registerTemplate(t)
			}

			// Also fetch from proxy if configured (may add more or updated templates)
			if (options?.proxyUrl) {
				void loadBuiltinWorkers(options.proxyUrl, registrar)
				if (options.workspaceRoot !== undefined && options.workspaceRoot !== "") {
					void loadWorkspaceTemplates(
						options.proxyUrl,
						options.workspaceRoot,
						registrar,
						options.onWorkspaceProblem,
					)
				}
			}

			// Templates the host already has, whatever route they came by.
			for (const template of options?.workspaceTemplates ?? []) {
				registrar.registerTemplate(template)
			}

			// Build the visual catalog panel (lazy — created on first open)
			_panel = new CatalogPanel({
				builtinTemplates: BUILTIN_WORKER_TEMPLATES,
				catalogEntries: CATALOG,
				onUseBuiltin(template) {
					// Already registered above — just confirm to the user
					const toast = showToast(
						`"${template.name}" ready — select a service task to apply it`,
						"success",
					)
					setTimeout(() => toast.remove(), 3500)
				},
				onLoadCatalogEntry(id) {
					void loadCatalogEntry(id, registrar)
				},
				onLoadFromUrl(url) {
					void loadFromUrl(url, registrar)
				},
				onLoadFromFile() {
					loadFromFile(registrar)
				},
			})

			const browseCmd = {
				id: "connector-catalog:browse",
				title: "Browse connectors\u2026",
				description: "Open the connector catalog to pick a built-in worker or import an API",
				action() {
					_panel?.open()
				},
			}

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

			_deregister = palette.addCommands([browseCmd, ...catalogCmds, urlCmd, fileCmd])
		},

		uninstall() {
			_deregister?.()
			_deregister = null
			_panel?.close()
			_panel = null
		},

		openCatalog() {
			_panel?.open()
		},

		addWorkspaceTemplates(templates: ElementTemplate[]) {
			for (const template of templates) registrar.registerTemplate(template)
		},
	}

	return plugin
}
