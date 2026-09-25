// @vitest-environment happy-dom
import type { CanvasApi } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { CommandPalettePlugin } from "../../src/command-palette/index.js"
import {
	type ElementTemplate,
	createConfigPanelBpmnPlugin,
} from "../../src/config-panel-bpmn/index.js"
import type { PanelAdapter, PanelSchema } from "../../src/config-panel/index.js"
import {
	type ConnectorCatalogPlugin,
	createConnectorCatalogPlugin,
} from "../../src/connector-catalog/index.js"

const PROXY = "http://proxy.test"
const ROOT = "/project"
/** A bundled Camunda connector — a workspace template may shadow it. */
const REST_ID = "io.camunda.connectors.HttpJson.v2"

function template(id: string, name: string, taskType = `${id}:1`): ElementTemplate {
	return {
		id,
		name,
		appliesTo: ["bpmn:ServiceTask"],
		properties: [
			{
				type: "Hidden",
				value: taskType,
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
		],
	}
}

/** What the proxy answers, per diagram path. */
const PER_FILE: Record<string, ElementTemplate[]> = {
	"a/order.bpmn": [template("acme.A", "Only in a/"), template(REST_ID, "Project REST")],
	"b/invoice.bpmn": [template("acme.B", "Only in b/")],
}

function serviceTask(templateId: string): BpmnDefinitions {
	return {
		id: "defs",
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		signals: [],
		collaborations: [],
		processes: [
			{
				id: "p",
				extensionElements: [],
				flowElements: [
					{
						id: "t",
						type: "serviceTask",
						incoming: [],
						outgoing: [],
						extensionElements: [],
						unknownAttributes: { "zeebe:modelerTemplate": templateId },
					},
				],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
				unknownAttributes: {},
			},
		],
		diagrams: [],
	}
}

const palette = {
	addCommands: () => () => {},
	pushView: () => {},
} as unknown as CommandPalettePlugin

const canvasApi = {} as CanvasApi

let serviceTaskSchema: PanelSchema | undefined
let serviceTaskAdapter: PanelAdapter | undefined
let configPanelBpmn: ReturnType<typeof createConfigPanelBpmnPlugin>
let catalog: ConnectorCatalogPlugin | undefined
let fetchMock: ReturnType<typeof vi.fn>

/** The connector picker's entries, as the properties panel would list them. */
function pickerLabels(): Map<string, string> {
	const field = serviceTaskSchema?.groups[0]?.fields.find((f) => f.key === "connector")
	const options = (field as { options?: Array<{ value: string; label: string }> }).options ?? []
	return new Map(options.map((o) => [o.value, o.label]))
}

/** Which template form the panel would render for a task stamped with `id`. */
function resolves(id: string): boolean {
	return serviceTaskAdapter?.resolve?.(serviceTask(id), "t") != null
}

function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
	configPanelBpmn = createConfigPanelBpmnPlugin({
		name: "config-panel",
		install: () => {},
		registerSchema: (type: string, schema: PanelSchema, adapter: PanelAdapter) => {
			if (type === "serviceTask") {
				serviceTaskSchema = schema
				serviceTaskAdapter = adapter
			}
		},
	} as unknown as Parameters<typeof createConfigPanelBpmnPlugin>[0])
	configPanelBpmn.install(canvasApi)

	fetchMock = vi.fn(async (input: string) => {
		const url = new URL(input)
		if (url.pathname === "/worker-templates") return Response.json([])
		const file = url.searchParams.get("file")
		if (file === null) {
			// The project-wide merge: every folder's templates at once.
			return Response.json({ templates: Object.values(PER_FILE).flat(), problems: [] })
		}
		return Response.json({ templates: PER_FILE[file] ?? [], problems: [] })
	})
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	catalog?.uninstall?.()
	catalog = undefined
	vi.unstubAllGlobals()
})

describe("connector-catalog per-file resolution", () => {
	it("asks the proxy for the one diagram's templates", async () => {
		catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
			proxyUrl: PROXY,
			workspaceRoot: ROOT,
			diagramPath: "a/order.bpmn",
		})
		catalog.install(canvasApi)
		await flush()

		const urls = fetchMock.mock.calls.map((call) => String(call[0]))
		expect(urls).toContain(
			`${PROXY}/element-templates?root=${encodeURIComponent(ROOT)}&file=${encodeURIComponent("a/order.bpmn")}`,
		)
		expect(pickerLabels().get("acme.A")).toBe("Only in a/")
		expect(pickerLabels().has("acme.B")).toBe(false)
		expect(pickerLabels().get(REST_ID)).toBe("Project REST")
	})

	it("swaps the previous diagram's templates out on setDiagramPath", async () => {
		catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
			proxyUrl: PROXY,
			workspaceRoot: ROOT,
			diagramPath: "a/order.bpmn",
		})
		catalog.install(canvasApi)
		await flush()
		expect(resolves("acme.A")).toBe(true)

		await catalog.setDiagramPath("b/invoice.bpmn")

		const labels = pickerLabels()
		expect(labels.has("acme.A")).toBe(false)
		expect(resolves("acme.A")).toBe(false)
		expect(labels.get("acme.B")).toBe("Only in b/")
		// The bundled connector a/ shadowed is back, under its own name.
		expect(labels.get(REST_ID)).not.toBe("Project REST")
		expect(resolves(REST_ID)).toBe(true)
		// Built-in workers are untouched by the swap.
		expect(labels.has("io.bpmnkit.cli")).toBe(true)
	})

	it("drops an answer that arrives after a later switch", async () => {
		let release: (() => void) | undefined
		fetchMock.mockImplementation(async (input: string) => {
			const url = new URL(input)
			if (url.pathname === "/worker-templates") return Response.json([])
			const file = url.searchParams.get("file") ?? ""
			if (file === "a/order.bpmn") {
				await new Promise<void>((resolve) => {
					release = resolve
				})
			}
			return Response.json({ templates: PER_FILE[file] ?? [], problems: [] })
		})
		catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
			proxyUrl: PROXY,
			workspaceRoot: ROOT,
			diagramPath: "a/order.bpmn",
		})
		catalog.install(canvasApi)
		await catalog.setDiagramPath("b/invoice.bpmn")
		release?.()
		await flush()

		expect(pickerLabels().has("acme.A")).toBe(false)
		expect(pickerLabels().has("acme.B")).toBe(true)
	})

	it("clears workspace templates for an unsaved diagram", async () => {
		catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
			proxyUrl: PROXY,
			workspaceRoot: ROOT,
			diagramPath: "a/order.bpmn",
		})
		catalog.install(canvasApi)
		await flush()
		await catalog.setDiagramPath(undefined)
		expect(pickerLabels().has("acme.A")).toBe(false)
	})

	it("takes its workspace templates back on uninstall", async () => {
		catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
			proxyUrl: PROXY,
			workspaceRoot: ROOT,
			diagramPath: "a/order.bpmn",
		})
		catalog.install(canvasApi)
		await flush()
		catalog.uninstall?.()
		catalog = undefined

		expect(pickerLabels().has("acme.A")).toBe(false)
		expect(pickerLabels().get(REST_ID)).not.toBe("Project REST")
	})

	it("replaces host-supplied templates with setWorkspaceTemplates", () => {
		catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
			workspaceTemplates: [template("acme.A", "Only in a/")],
		})
		catalog.install(canvasApi)
		expect(pickerLabels().has("acme.A")).toBe(true)

		catalog.setWorkspaceTemplates([template("acme.B", "Only in b/")])
		expect(pickerLabels().has("acme.A")).toBe(false)
		expect(pickerLabels().has("acme.B")).toBe(true)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("keeps host-supplied templates across a diagram switch", async () => {
		catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
			proxyUrl: PROXY,
			workspaceRoot: ROOT,
			diagramPath: "a/order.bpmn",
			workspaceTemplates: [template("acme.Host", "From the host")],
		})
		catalog.install(canvasApi)
		await flush()
		await catalog.setDiagramPath("b/invoice.bpmn")

		expect(pickerLabels().get("acme.Host")).toBe("From the host")
		expect(pickerLabels().has("acme.A")).toBe(false)
	})

	it("keeps the project-wide merge without diagramPath", async () => {
		catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
			proxyUrl: PROXY,
			workspaceRoot: ROOT,
		})
		catalog.install(canvasApi)
		await flush()

		const urls = fetchMock.mock.calls.map((call) => String(call[0]))
		expect(urls).toContain(`${PROXY}/element-templates?root=${encodeURIComponent(ROOT)}`)
		expect(pickerLabels().has("acme.A")).toBe(true)
		expect(pickerLabels().has("acme.B")).toBe(true)
	})

	it("refuses per-file resolution with a registrar that cannot unregister", () => {
		expect(() =>
			createConnectorCatalogPlugin({ registerTemplate: () => {} }, palette, {
				proxyUrl: PROXY,
				workspaceRoot: ROOT,
				diagramPath: "a/order.bpmn",
			}),
		).toThrow(/unregisterTemplate/)
		expect(() =>
			createConnectorCatalogPlugin(configPanelBpmn, palette, { diagramPath: "a/order.bpmn" }),
		).toThrow(/proxyUrl and workspaceRoot/)
	})
})
