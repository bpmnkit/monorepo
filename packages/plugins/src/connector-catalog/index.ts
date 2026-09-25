/**
 * @bpmnkit/plugins/connector-catalog — Import API connectors from
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
	/**
	 * Removes a registered template. Needed for per-file resolution
	 * (`diagramPath`, `setDiagramPath`, `setWorkspaceTemplates`): without it the
	 * previous diagram's templates could not be taken back. config-panel-bpmn
	 * provides it.
	 */
	unregisterTemplate?(id: string): void
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
	/**
	 * Resolve workspace templates for this one diagram instead of the whole
	 * project: only the `.camunda/element-templates/` folders from the diagram's
	 * own folder up to `workspaceRoot` apply, the nearest winning — how Camunda
	 * Desktop Modeler resolves them. Absolute, or relative to `workspaceRoot`.
	 * Requires `proxyUrl` and `workspaceRoot`, and a registrar with
	 * `unregisterTemplate`. Call `setDiagramPath` when the host opens another
	 * diagram.
	 */
	diagramPath?: string
}

/** Extended plugin interface — exposes `openCatalog()` for programmatic use. */
export interface ConnectorCatalogPlugin extends CanvasPlugin {
	openCatalog(): void
	/**
	 * Registers more workspace templates after install — for a host that learns
	 * about them later, or whose project root changed.
	 */
	addWorkspaceTemplates(templates: ElementTemplate[]): void
	/**
	 * Replaces the host-supplied templates (`workspaceTemplates`,
	 * `addWorkspaceTemplates`) with `templates` — for a host that resolves them
	 * per diagram itself (an extension host with filesystem access) and has just
	 * switched diagrams. Ids the previous set held and this one does not are
	 * unregistered, so nothing from the last diagram leaks into this one; a
	 * bundled template one of them shadowed comes back. Templates the proxy
	 * resolved are not touched. Requires a registrar with `unregisterTemplate`.
	 */
	setWorkspaceTemplates(templates: ElementTemplate[]): void
	/**
	 * Re-resolves workspace templates for another diagram through the proxy
	 * (`<proxyUrl>/element-templates?root=…&file=…`) and swaps them in. Pass
	 * `undefined` to drop the workspace templates, e.g. for an unsaved diagram.
	 * Resolves once the new set is registered; a call superseded by a later one
	 * registers nothing. Requires `proxyUrl`, `workspaceRoot` and a registrar
	 * with `unregisterTemplate`.
	 */
	setDiagramPath(path: string | undefined): Promise<void>
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
 * Asks the proxy for a project's own element templates: the whole project's
 * merge, or — with `file` — only those that apply to that one diagram.
 *
 * `undefined` means the proxy could not be asked, which a caller treats as "no
 * workspace templates" rather than an error: the bundled catalogue still works.
 */
async function fetchWorkspaceTemplates(
	proxyUrl: string,
	root: string,
	file: string | undefined,
	onProblem?: ConnectorCatalogOptions["onWorkspaceProblem"],
): Promise<ElementTemplate[] | undefined> {
	const query =
		file === undefined
			? `root=${encodeURIComponent(root)}`
			: `root=${encodeURIComponent(root)}&file=${encodeURIComponent(file)}`
	try {
		const res = await fetch(`${proxyUrl}/element-templates?${query}`)
		if (!res.ok) return undefined
		const body = (await res.json()) as {
			templates?: ElementTemplate[]
			problems?: Array<{ file: string; path: string; message: string }>
		}
		if (onProblem) for (const p of body.problems ?? []) onProblem(p)
		return body.templates ?? []
	} catch {
		// proxy unavailable — the project's templates simply aren't registered
		return undefined
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

// ── Template layers ───────────────────────────────────────────────────────────

type Layer = "base" | "host" | "resolved"

/**
 * Three layers over one registrar, highest first on an id: templates the proxy
 * `resolved` for the project or diagram, templates the `host` supplied, and the
 * `base` this plugin brings itself (built-in workers, imported APIs).
 *
 * Remembering all three is what lets a set be taken back exactly: when an id
 * leaves a layer, the next layer's template of that id is registered again,
 * and an id no layer holds is unregistered — which in config-panel-bpmn
 * restores the bundled Camunda template of that id, if there is one.
 */
function createLayers(registrar: TemplateRegistrar) {
	const layers: Record<Layer, Map<string, ElementTemplate>> = {
		base: new Map(),
		host: new Map(),
		resolved: new Map(),
	}
	const precedence = [layers.resolved, layers.host, layers.base]

	function refresh(id: string, unregister?: (id: string) => void): void {
		for (const layer of precedence) {
			const template = layer.get(id)
			if (template) {
				registrar.registerTemplate(template)
				return
			}
		}
		unregister?.(id)
	}

	return {
		add(layer: Layer, templates: readonly ElementTemplate[]): void {
			for (const template of templates) layers[layer].set(template.id, template)
			for (const template of templates) refresh(template.id)
		},
		/** Replaces a layer's contents; ids it no longer holds fall through to the layers below. */
		replace(
			layer: Layer,
			templates: readonly ElementTemplate[],
			unregister: (id: string) => void,
		): void {
			const previous = [...layers[layer].keys()]
			layers[layer].clear()
			for (const template of templates) layers[layer].set(template.id, template)
			for (const id of previous) if (!layers[layer].has(id)) refresh(id, unregister)
			for (const template of templates) refresh(template.id)
		},
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
 * Workspace templates are either the whole project's (`workspaceRoot`) or one
 * diagram's (`workspaceRoot` + `diagramPath`, then `setDiagramPath` on every
 * switch). When the registrar can unregister, they are taken back on
 * uninstall too, so a host that rebuilds its editor per diagram does not carry
 * one diagram's templates into the next.
 *
 * @param registrar - The config-panel-bpmn plugin (or any object with
 *   `registerTemplate`, plus `unregisterTemplate` for per-file resolution).
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
	let installed = false
	const layers = createLayers(registrar)
	/** The registrar everything this plugin brings itself goes through. */
	const base: TemplateRegistrar = {
		registerTemplate: (template) => layers.add("base", [template]),
	}
	const proxyUrl = options?.proxyUrl ?? ""
	const root = options?.workspaceRoot ?? ""

	/** The registrar's `unregisterTemplate`, or an error naming what needed it. */
	function unregisterFor(what: string): (id: string) => void {
		const unregister = registrar.unregisterTemplate?.bind(registrar)
		if (!unregister) {
			throw new Error(
				`connector-catalog: ${what} needs a registrar with unregisterTemplate() (config-panel-bpmn has one); without it the previous diagram's templates could not be removed`,
			)
		}
		return unregister
	}

	function requireProxy(what: string): void {
		if (proxyUrl === "" || root === "") {
			throw new Error(`connector-catalog: ${what} requires proxyUrl and workspaceRoot`)
		}
	}

	/** Per-file once a diagram path has been given, at creation or later. */
	let perFile = options?.diagramPath !== undefined
	let diagramPath = options?.diagramPath
	if (perFile) {
		unregisterFor("diagramPath")
		requireProxy("diagramPath")
	}
	/** Bumped per resolution, so a slow answer for an earlier diagram is dropped. */
	let generation = 0

	async function resolveWorkspace(): Promise<void> {
		if (proxyUrl === "" || root === "") return
		const mine = ++generation
		let templates: ElementTemplate[]
		if (!perFile) {
			templates =
				(await fetchWorkspaceTemplates(proxyUrl, root, undefined, options?.onWorkspaceProblem)) ??
				[]
		} else if (diagramPath === undefined || diagramPath === "") {
			// No file yet (an unsaved diagram): nothing of the project's applies.
			templates = []
		} else {
			templates =
				(await fetchWorkspaceTemplates(proxyUrl, root, diagramPath, options?.onWorkspaceProblem)) ??
				[]
		}
		if (mine !== generation || !installed) return
		if (perFile) layers.replace("resolved", templates, unregisterFor("diagramPath"))
		else layers.add("resolved", templates)
	}

	const plugin: ConnectorCatalogPlugin = {
		name: "connector-catalog",

		install() {
			injectConnectorCatalogStyles()
			installed = true

			// Register static built-in worker templates immediately
			for (const t of BUILTIN_WORKER_TEMPLATES) {
				base.registerTemplate(t)
			}

			// Also fetch from proxy if configured (may add more or updated templates)
			if (proxyUrl !== "") {
				void loadBuiltinWorkers(proxyUrl, base)
				void resolveWorkspace()
			}

			// Templates the host already has, whatever route they came by.
			layers.add("host", options?.workspaceTemplates ?? [])

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
					void loadCatalogEntry(id, base)
				},
				onLoadFromUrl(url) {
					void loadFromUrl(url, base)
				},
				onLoadFromFile() {
					loadFromFile(base)
				},
			})

			const browseCmd = {
				id: "connector-catalog:browse",
				title: "Browse connectors…",
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
					void loadCatalogEntry(entry.id, base)
				},
			}))

			const urlCmd = {
				id: "connector-catalog:url",
				title: "Import from OpenAPI URL…",
				description: "Fetch any OpenAPI 3.x spec from a URL and add its operations",
				action() {
					palette.pushView([], {
						placeholder: "https://… (OpenAPI 3.x spec URL)",
						onConfirm(url: string) {
							void loadFromUrl(url, base)
						},
					})
				},
			}

			const fileCmd = {
				id: "connector-catalog:file",
				title: "Import from OpenAPI file…",
				description: "Upload a local OpenAPI 3.x spec file (.json or .yaml)",
				action() {
					loadFromFile(base)
				},
			}

			_deregister = palette.addCommands([browseCmd, ...catalogCmds, urlCmd, fileCmd])
		},

		uninstall() {
			installed = false
			generation++
			// The registry behind the registrar outlives this plugin; leaving the
			// workspace set in it would hand this diagram's templates to the next.
			const unregister = registrar.unregisterTemplate?.bind(registrar)
			if (unregister) {
				layers.replace("resolved", [], unregister)
				layers.replace("host", [], unregister)
			}
			_deregister?.()
			_deregister = null
			_panel?.close()
			_panel = null
		},

		openCatalog() {
			_panel?.open()
		},

		addWorkspaceTemplates(templates: ElementTemplate[]) {
			layers.add("host", templates)
		},

		setWorkspaceTemplates(templates: ElementTemplate[]) {
			layers.replace("host", templates, unregisterFor("setWorkspaceTemplates"))
		},

		async setDiagramPath(path: string | undefined) {
			unregisterFor("setDiagramPath")
			requireProxy("setDiagramPath")
			perFile = true
			diagramPath = path
			if (installed) await resolveWorkspace()
		},
	}

	return plugin
}
