import type { CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnEditor, createSideDock, initEditorHud } from "@bpmnkit/editor"
import type { SideDock } from "@bpmnkit/editor"
import { Engine } from "@bpmnkit/engine"
import type { CommandPalettePlugin } from "@bpmnkit/plugins/command-palette"
import { createCommandPaletteEditorPlugin } from "@bpmnkit/plugins/command-palette-editor"
import { createConfigPanelPlugin } from "@bpmnkit/plugins/config-panel"
import { createConfigPanelBpmnPlugin } from "@bpmnkit/plugins/config-panel-bpmn"
import { createConnectorCatalogPlugin } from "@bpmnkit/plugins/connector-catalog"
import { DmnEditor } from "@bpmnkit/plugins/dmn-editor"
import { type PresentationApi, createPresentationPlugin } from "@bpmnkit/plugins/presentation"
import { createProcessRunnerPlugin } from "@bpmnkit/plugins/process-runner"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { Input } from "@cascivo/react"
import { QueryClientProvider } from "@tanstack/react-query"
import {
	ArrowLeft,
	BookOpen,
	CheckCircle,
	Clock,
	Copy,
	ExternalLink,
	Eye,
	FileCode,
	Image,
	Link2,
	MonitorPlay,
	MoreHorizontal,
	Play,
	Rocket,
	RotateCw,
	Save,
} from "lucide-react"
import { render } from "preact"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { Link, useLocation, useParams } from "wouter"
import { useCreateProcessInstance, useDefinitions, useDeployProcess } from "../api/queries.js"
import { queryClient } from "../api/queryClient.js"
import { runScenarioWasm } from "../api/run-scenario-wasm.js"
import { Button } from "../components/ui/button.js"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js"
import { getFsAdapter } from "../storage/index.js"
import type { ModelFile } from "../storage/types.js"
import { useClusterStore } from "../stores/cluster.js"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"
import { WasmInstanceDetail } from "./InstanceDetail.js"

// TopBar = h-12 (48px), save bar = h-10 (40px)
const DOCK_TOP = 88

function getCompanionDmns(xml: string, models: ModelFile[]) {
	const matches = [...xml.matchAll(/<zeebe:calledDecision[^>]+decisionId="([^"]+)"/g)]
	const decisionIds = [...new Set(matches.map((m) => m[1] as string))]
	return decisionIds.flatMap((decisionId) => {
		const dmn = models.find((m) => m.type === "dmn" && m.content.includes(decisionId))
		if (!dmn) return []
		return [{ xml: dmn.content, fileName: `${dmn.name}.dmn` }]
	})
}

// ── Deploy pane component (rendered into dock's deploy pane) ─────────────────

type TriggerMode = "manual" | "webhook" | "timer" | "file-watch"

function StudioDeployPane({ modelId, getXml }: { modelId: string; getXml: () => string | null }) {
	const { models, saveModel, upsertModel } = useModelsStore()
	const { proxyUrl } = useClusterStore()
	const model = models.find((m) => m.id === modelId)
	const [processIdInput, setProcessIdInput] = useState(model?.processDefinitionId ?? "")
	const [startVars, setStartVars] = useState("{}")
	const [startError, setStartError] = useState<string | null>(null)
	const [startedKey, setStartedKey] = useState<string | null>(null)
	const [triggerMode, setTriggerMode] = useState<TriggerMode>("manual")
	const { data, refetch } = useDefinitions(
		model?.processDefinitionId ? { bpmnProcessId: model.processDefinitionId } : undefined,
	)
	const deploy = useDeployProcess()
	const createInstance = useCreateProcessInstance()

	const latestDef = data?.items[0]
	const isDeployed = !!latestDef

	async function handleLink() {
		if (!model) return
		const updated = await saveModel({ ...model, processDefinitionId: processIdInput || undefined })
		upsertModel(updated)
		toast.success("Process ID linked")
	}

	async function handleDeploy() {
		const xml = getXml()
		if (!xml || !model) return
		try {
			const companions = getCompanionDmns(xml, models)
			await deploy.mutateAsync({
				xml,
				fileName: `${model.name}.bpmn`,
				...(companions.length && { companions }),
			})
			await refetch()
			toast.success("Deployed successfully")
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
		}
	}

	async function handleStart() {
		if (!latestDef) return
		setStartError(null)
		setStartedKey(null)
		let vars: Record<string, unknown> = {}
		try {
			const trimmed = startVars.trim()
			if (trimmed && trimmed !== "{}") vars = JSON.parse(trimmed)
		} catch {
			setStartError("Variables must be valid JSON")
			return
		}
		try {
			const result = await createInstance.mutateAsync({
				processDefinitionKey: latestDef.processDefinitionKey,
				variables: vars,
			})
			setStartedKey(result.processInstanceKey)
		} catch (err) {
			setStartError(err instanceof Error ? err.message : String(err))
		}
	}

	return (
		<div className="p-4 flex flex-col gap-5 overflow-y-auto h-full">
			<div>
				<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
					<Rocket size={11} />
					Deploy
				</p>
				{isDeployed && (
					<p className="text-xs text-success flex items-center gap-1 mb-2">
						<CheckCircle size={11} />
						Deployed — v{latestDef.version}
					</p>
				)}
				<Button
					size="sm"
					onClick={() => void handleDeploy()}
					disabled={deploy.isPending}
					className="w-full"
				>
					{deploy.isPending ? "Deploying…" : isDeployed ? "Re-deploy" : "Deploy to Camunda"}
				</Button>
			</div>

			{isDeployed && (
				<div className="border border-border rounded-lg p-3 flex flex-col gap-3">
					{/* Trigger mode selector */}
					<div className="flex rounded-md border border-border overflow-hidden text-xs">
						{(
							[
								{ mode: "manual", label: "Manual", icon: <Play size={11} /> },
								{ mode: "webhook", label: "Webhook", icon: <Link2 size={11} /> },
								{ mode: "timer", label: "Timer", icon: <Clock size={11} /> },
								{ mode: "file-watch", label: "File Watch", icon: <Eye size={11} /> },
							] satisfies { mode: TriggerMode; label: string; icon: preact.JSX.Element }[]
						).map(({ mode, label, icon }) => (
							<button
								key={mode}
								type="button"
								onClick={() => setTriggerMode(mode)}
								className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 transition-colors border-r border-border last:border-r-0 ${
									triggerMode === mode
										? "bg-accent text-white"
										: "bg-surface text-muted hover:bg-surface-2"
								}`}
							>
								{icon}
								<span className="hidden sm:inline">{label}</span>
							</button>
						))}
					</div>

					{/* Manual mode */}
					{triggerMode === "manual" && (
						<>
							<div className="flex flex-col gap-1">
								<label className="text-xs text-muted" htmlFor="deploy-pane-vars">
									Variables (JSON)
								</label>
								<textarea
									id="deploy-pane-vars"
									value={startVars}
									onInput={(e) => setStartVars((e.target as HTMLTextAreaElement).value)}
									rows={2}
									className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs font-mono text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
									placeholder="{}"
								/>
							</div>
							{startError && <p className="text-xs text-danger">{startError}</p>}
							{startedKey && (
								<p className="text-xs text-success">
									Started —{" "}
									<Link href={`/instances/${startedKey}`} className="underline hover:text-accent">
										view #{startedKey}
									</Link>
								</p>
							)}
							<Button
								size="sm"
								onClick={() => void handleStart()}
								disabled={createInstance.isPending}
								className="self-start"
							>
								{createInstance.isPending ? (
									<>
										<RotateCw size={13} className="animate-spin" />
										Starting…
									</>
								) : (
									<>
										<Play size={13} />
										Start
									</>
								)}
							</Button>
						</>
					)}

					{/* Webhook mode */}
					{triggerMode === "webhook" &&
						(() => {
							const webhookUrl = `${proxyUrl}/webhooks/${latestDef.bpmnProcessId ?? latestDef.processDefinitionId}`
							return (
								<>
									<div className="flex items-center gap-1.5">
										<code className="flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs font-mono text-fg break-all">
											{webhookUrl}
										</code>
										<button
											type="button"
											onClick={() => {
												void navigator.clipboard.writeText(webhookUrl)
												toast.success("Copied!")
											}}
											className="shrink-0 rounded-md border border-border bg-surface p-1.5 text-muted hover:bg-surface-2 hover:text-fg transition-colors"
											aria-label="Copy webhook URL"
										>
											<Copy size={13} />
										</button>
									</div>
									<p className="text-xs text-muted">
										Send a POST request to this URL with your variables as the JSON body.
									</p>
									<pre className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-mono text-fg overflow-x-auto whitespace-pre-wrap break-all">
										{`curl -X POST ${webhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "value"}'`}
									</pre>
								</>
							)
						})()}

					{/* Timer mode */}
					{triggerMode === "timer" && (
						<>
							<p className="text-xs text-fg">
								Timer triggers are configured directly in the BPMN diagram using Timer Start Events.
							</p>
							<p className="text-xs text-muted">
								Use ISO 8601 duration (e.g. <code className="font-mono">PT1H</code> for hourly),
								date, or cron cycle expressions.
							</p>
						</>
					)}

					{/* File Watch mode */}
					{triggerMode === "file-watch" && (
						<>
							<p className="text-xs text-fg">
								File watch triggers are configured using the File Watch Trigger service task in the
								BPMN diagram.
							</p>
							<p className="text-xs text-muted">
								The worker daemon polls for jobs of type{" "}
								<code className="font-mono">io.bpmnkit:trigger:file-watch:1</code>.
							</p>
						</>
					)}
				</div>
			)}

			<div>
				<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
					<Link2 size={11} />
					Link to Process ID
				</p>
				<div className="flex gap-1">
					<Input
						value={processIdInput}
						onInput={(e) => setProcessIdInput((e.target as HTMLInputElement).value)}
						placeholder="process-id"
						size="sm"
						className="flex-1"
						aria-label="Process definition ID"
					/>
					<Button size="sm" variant="outline" onClick={() => void handleLink()}>
						Link
					</Button>
				</div>
			</div>

			{model?.processDefinitionId && (
				<div>
					<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
						Deployed versions
					</p>
					{!data?.items.length ? (
						<p className="text-xs text-muted">No deployed versions found.</p>
					) : (
						<ul className="divide-y divide-border rounded border border-border">
							{data.items.map((def) => (
								<li key={def.processDefinitionKey} className="hover:bg-surface-2 transition-colors">
									<Link
										href={`/definitions/${def.processDefinitionKey}`}
										className="flex items-center justify-between p-2 text-sm"
									>
										<span className="text-fg">v{def.version}</span>
										<span className="text-xs text-muted">
											{def.deploymentTime ? new Date(def.deploymentTime).toLocaleDateString() : ""}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	)
}

// ── Docs pane component ───────────────────────────────────────────────────────

interface ElementDoc {
	label: string
	href: string
	description: string
	links?: Array<{ label: string; href: string }>
}

const ELEMENT_DOCS: Record<string, ElementDoc> = {
	startEvent: {
		label: "Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/start-events/",
		description: "Marks where a process begins. The none start event is the default type.",
	},
	messageStartEvent: {
		label: "Message Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/message-events/",
		description: "Starts the process when a named message is received.",
	},
	timerStartEvent: {
		label: "Timer Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/timer-events/",
		description: "Starts the process at a specific time or on a repeating schedule.",
		links: [
			{
				label: "Timer expressions (ISO 8601)",
				href: "https://docs.camunda.io/docs/components/modeler/bpmn/timer-events/#timer-definition",
			},
		],
	},
	conditionalStartEvent: {
		label: "Conditional Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/start-events/",
		description: "Starts when a FEEL condition evaluates to true.",
	},
	signalStartEvent: {
		label: "Signal Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/signal-events/",
		description: "Starts when a named signal is broadcast.",
	},
	endEvent: {
		label: "End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/end-events/",
		description: "Marks where a process path ends. The token is consumed.",
	},
	messageEndEvent: {
		label: "Message End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/message-events/",
		description: "Sends a message when the path ends.",
	},
	escalationEndEvent: {
		label: "Escalation End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/escalation-events/",
		description: "Triggers an escalation in the parent scope when the path ends.",
	},
	errorEndEvent: {
		label: "Error End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/error-events/",
		description:
			"Throws a named BPMN error, propagating up to a boundary error event or error subprocess.",
	},
	terminateEndEvent: {
		label: "Terminate End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/terminate-events/",
		description: "Ends the entire process instance immediately, cancelling all active tokens.",
	},
	task: {
		label: "Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/tasks/",
		description:
			"A generic task with no specific behavior. Use a typed task for production workflows.",
	},
	serviceTask: {
		label: "Service Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/service-tasks/",
		description:
			"Invokes an external job worker. Configure the job type, retries, and input/output mappings.",
		links: [
			{
				label: "Job Workers",
				href: "https://docs.camunda.io/docs/components/concepts/job-workers/",
			},
			{
				label: "Headers & variables",
				href: "https://docs.camunda.io/docs/components/modeler/bpmn/service-tasks/#task-headers",
			},
		],
	},
	userTask: {
		label: "User Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/user-tasks/",
		description: "Requires a human to complete a form or take action before the process continues.",
		links: [{ label: "Forms", href: "https://docs.camunda.io/docs/components/modeler/forms/" }],
	},
	scriptTask: {
		label: "Script Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/script-tasks/",
		description: "Executes a FEEL expression or script inline, without an external worker.",
	},
	sendTask: {
		label: "Send Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/send-tasks/",
		description: "Sends a message. Behaves like a service task — implement via a job worker.",
	},
	receiveTask: {
		label: "Receive Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/receive-tasks/",
		description: "Waits until a correlated message is received before continuing.",
	},
	businessRuleTask: {
		label: "Business Rule Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/business-rule-tasks/",
		description: "Evaluates a DMN decision table and maps the result to process variables.",
	},
	manualTask: {
		label: "Manual Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/manual-tasks/",
		description: "Represents work done outside the engine (e.g. a phone call). No automation.",
	},
	callActivity: {
		label: "Call Activity",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/call-activities/",
		description:
			"Calls a reusable child process by its process ID. Supports input/output variable mappings.",
	},
	subProcess: {
		label: "Sub-Process",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/embedded-subprocesses/",
		description: "An embedded group of tasks that share scope and can have boundary events.",
		links: [
			{
				label: "Multi-instance",
				href: "https://docs.camunda.io/docs/components/modeler/bpmn/multi-instance/",
			},
		],
	},
	adHocSubProcess: {
		label: "Ad-hoc Sub-Process",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/ad-hoc-subprocesses/",
		description:
			"A sub-process where contained activities can be executed in any order or in parallel.",
	},
	transaction: {
		label: "Transaction",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/transactions/",
		description: "A sub-process with ACID-like semantics. Can be cancelled via a cancel end event.",
	},
	exclusiveGateway: {
		label: "Exclusive Gateway (XOR)",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/exclusive-gateways/",
		description: "Routes to exactly one outgoing path based on FEEL conditions evaluated in order.",
		links: [
			{
				label: "Conditions (FEEL)",
				href: "https://docs.camunda.io/docs/components/modeler/feel/what-is-feel/",
			},
		],
	},
	parallelGateway: {
		label: "Parallel Gateway (AND)",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/parallel-gateways/",
		description:
			"Splits into all outgoing paths simultaneously, or joins by waiting for all incoming tokens.",
	},
	inclusiveGateway: {
		label: "Inclusive Gateway (OR)",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/inclusive-gateways/",
		description:
			"Activates one or more outgoing paths whose conditions are true. The join waits for all active branches.",
	},
	eventBasedGateway: {
		label: "Event-Based Gateway",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/event-based-gateways/",
		description: "Routes based on whichever following catch event occurs first.",
	},
	complexGateway: {
		label: "Complex Gateway",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/",
		description: "Custom split/join logic via a FEEL activation condition.",
	},
	messageCatchEvent: {
		label: "Message Intermediate Catch Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/message-events/",
		description: "Pauses the process until a correlated message arrives.",
		links: [
			{
				label: "Message correlation",
				href: "https://docs.camunda.io/docs/components/concepts/messages/",
			},
		],
	},
	timerCatchEvent: {
		label: "Timer Intermediate Catch Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/timer-events/",
		description: "Pauses the process for a duration or until a specific date/time.",
	},
	signalCatchEvent: {
		label: "Signal Intermediate Catch Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/signal-events/",
		description: "Waits for a named signal broadcast before continuing.",
	},
	sequenceFlow: {
		label: "Sequence Flow",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/",
		description:
			"Connects flow elements. Add a FEEL condition expression to make it a conditional flow.",
	},
	textAnnotation: {
		label: "Text Annotation",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/",
		description: "A non-executing comment attached to an element for documentation purposes.",
	},
}

const BPMN_REFERENCE = [
	{
		section: "Tasks",
		items: [
			"serviceTask",
			"userTask",
			"scriptTask",
			"businessRuleTask",
			"callActivity",
			"subProcess",
		],
	},
	{
		section: "Events",
		items: ["startEvent", "endEvent", "messageCatchEvent", "timerCatchEvent"],
	},
	{
		section: "Gateways",
		items: ["exclusiveGateway", "parallelGateway", "inclusiveGateway", "eventBasedGateway"],
	},
]

function DocLink({ href, label }: { href: string; label: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="flex items-center justify-between text-xs text-fg hover:text-accent py-1 px-2 rounded hover:bg-surface-2 transition-colors"
		>
			{label}
			<ExternalLink size={10} className="text-muted shrink-0" />
		</a>
	)
}

function StudioDocsPane({ elementType }: { elementType: string | null }) {
	const doc = elementType ? (ELEMENT_DOCS[elementType] ?? null) : null

	if (doc) {
		return (
			<div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
				<div>
					<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
						{doc.label}
					</p>
					<p className="text-xs text-fg leading-relaxed">{doc.description}</p>
				</div>
				<div className="flex flex-col gap-0.5">
					<DocLink href={doc.href} label="Camunda Docs ↗" />
					{doc.links?.map((l) => (
						<DocLink key={l.href} href={l.href} label={l.label} />
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
			<div className="flex items-center gap-1.5">
				<BookOpen size={13} className="text-muted" />
				<p className="text-xs font-semibold text-muted uppercase tracking-wider">BPMN Reference</p>
			</div>
			<p className="text-xs text-muted">Select an element to see its documentation.</p>
			{BPMN_REFERENCE.map((group) => (
				<div key={group.section}>
					<p className="text-xs font-semibold text-muted mb-1">{group.section}</p>
					<ul className="flex flex-col gap-0.5">
						{group.items.map((type) => {
							const d = ELEMENT_DOCS[type]
							if (!d) return null
							return (
								<li key={type}>
									<DocLink href={d.href} label={d.label} />
								</li>
							)
						})}
					</ul>
				</div>
			))}
		</div>
	)
}

// ── XML view dialog ───────────────────────────────────────────────────────────

function showXmlDialog(xml: string): void {
	const overlay = document.createElement("div")
	overlay.style.cssText =
		"position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove()
	})

	const panel = document.createElement("div")
	panel.style.cssText =
		"background:var(--bpmnkit-surface,#fff);border:1px solid var(--bpmnkit-border,#d0d0e8);border-radius:8px;width:min(800px,90vw);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;"

	const header = document.createElement("div")
	header.style.cssText =
		"display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--bpmnkit-border,#d0d0e8);"

	const title = document.createElement("span")
	title.style.cssText = "font-size:14px;font-weight:600;color:var(--bpmnkit-fg,#1a1a2e);"
	title.textContent = "XML Source"

	const actions = document.createElement("div")
	actions.style.cssText = "display:flex;gap:8px;"

	const copyBtn = document.createElement("button")
	copyBtn.style.cssText =
		"font-size:12px;padding:4px 10px;border-radius:4px;border:1px solid var(--bpmnkit-border,#d0d0e8);background:transparent;color:var(--bpmnkit-fg,#1a1a2e);cursor:pointer;"
	copyBtn.textContent = "Copy"
	copyBtn.addEventListener("click", () => {
		void navigator.clipboard.writeText(xml).then(() => {
			copyBtn.textContent = "Copied!"
			setTimeout(() => {
				copyBtn.textContent = "Copy"
			}, 1500)
		})
	})

	const closeBtn = document.createElement("button")
	closeBtn.style.cssText =
		"font-size:12px;padding:4px 10px;border-radius:4px;border:1px solid var(--bpmnkit-border,#d0d0e8);background:transparent;color:var(--bpmnkit-fg,#1a1a2e);cursor:pointer;"
	closeBtn.textContent = "Close"
	closeBtn.addEventListener("click", () => overlay.remove())

	actions.append(copyBtn, closeBtn)
	header.append(title, actions)

	const body = document.createElement("div")
	body.style.cssText = "overflow:auto;flex:1;"

	const pre = document.createElement("pre")
	pre.style.cssText =
		"margin:0;padding:16px;font-size:12px;font-family:var(--bpmnkit-font-mono,monospace);color:var(--bpmnkit-fg,#1a1a2e);white-space:pre;"
	pre.textContent = xml

	body.append(pre)
	panel.append(header, body)
	overlay.append(panel)
	document.body.append(overlay)

	const onKey = (e: KeyboardEvent): void => {
		if (e.key === "Escape") {
			overlay.remove()
			document.removeEventListener("keydown", onKey)
		}
	}
	document.addEventListener("keydown", onKey)
}

// ── ModelDetail ───────────────────────────────────────────────────────────────

export function ModelDetail() {
	const { id } = useParams<{ id: string }>()
	const [, navigate] = useLocation()
	const navigateRef = useRef(navigate)
	navigateRef.current = navigate
	const { models, saveModel, upsertModel, loaded } = useModelsStore()
	const model = models.find((m) => m.id === id)
	const editorContainerRef = useRef<HTMLDivElement>(null)
	const editorRef = useRef<BpmnEditor | null>(null)
	const dmnEditorRef = useRef<DmnEditor | null>(null)
	const dockRef = useRef<SideDock | null>(null)
	const presentationApiRef = useRef<PresentationApi | null>(null)
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const runVarsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
	const [runMode, setRunMode] = useState(false)
	const [activeInstanceKey, setActiveInstanceKey] = useState<string | null>(null)
	const [runVariables, setRunVariables] = useState(model?.runVariables ?? "{}")
	const [mdContent, setMdContent] = useState(model?.type === "md" ? (model.content ?? "") : "")
	const { theme } = useThemeStore()
	const { setBreadcrumbs, zenMode } = useUiStore()
	const activeProfile = useClusterStore((s) => s.activeProfile)
	const isWasm = activeProfile === "reebe-wasm"
	const deploy = useDeployProcess()
	const createInstance = useCreateProcessInstance()

	useEffect(() => {
		setBreadcrumbs([{ label: "Models", href: "/models" }, { label: model?.name ?? id }])
	}, [id, model?.name, setBreadcrumbs])

	// Initialize editor + dock
	// biome-ignore lint/correctness/useExhaustiveDependencies: editor created once per id+loaded; refs/closures handle the rest
	useEffect(() => {
		if (!loaded) return
		const container = editorContainerRef.current
		if (!container || !model) return

		// ── Markdown editor (short-circuit — plain textarea) ─────────────────
		if (model.type === "md") {
			// Rendered inline via JSX below; nothing imperative to set up here.
			return
		}

		// ── DMN editor (short-circuit — no dock/plugins needed) ──────────────
		if (model.type === "dmn") {
			const rawTheme = useThemeStore.getState().theme
			const editor = new DmnEditor({ container, theme: rawTheme === "light" ? "light" : "dark" })
			dmnEditorRef.current = editor
			if (model.content) {
				void editor.loadXML(model.content)
			}
			const off = editor.onChange(() => {
				setSaveStatus("unsaved")
				if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
				saveTimerRef.current = setTimeout(() => {
					void doSave()
				}, 2000)
			})
			return () => {
				off()
				if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
				editor.destroy()
				dmnEditorRef.current = null
			}
		}

		// ── Dock ──────────────────────────────────────────────────────────────
		const dock = createSideDock()
		dock.el.style.top = `${DOCK_TOP}px`
		document.body.appendChild(dock.el)
		dockRef.current = dock

		// History requires file-storage context — not available in Studio
		dock.setVisible(true)
		dock.setHistoryTabEnabled(false)
		// Play tab shown only when process runner enters play mode
		dock.setPlayTabVisible(false)
		// AI is handled by the Studio AI drawer — remove the dock's own AI tab
		dock.setAiTabVisible(false)

		// Render Studio-specific content into dock panes
		render(
			<QueryClientProvider client={queryClient}>
				<StudioDeployPane
					modelId={model.id}
					getXml={() => editorRef.current?.exportXml() ?? null}
				/>
			</QueryClientProvider>,
			dock.deployPane,
		)
		function renderDocs(elementType: string | null) {
			render(<StudioDocsPane elementType={elementType} />, dock.docsPane)
		}
		renderDocs(null)
		dock.setDeployTabClickHandler(() => {
			if (dock.collapsed) dock.expand()
		})
		dock.setDocsTabClickHandler(() => {
			if (dock.collapsed) dock.expand()
		})

		// ── Command palette bridge ────────────────────────────────────────────
		// Routes editor plugin commands into the Studio global command palette.
		const bridgePalette: CommandPalettePlugin = {
			name: "studio-palette-bridge",
			install() {},
			addCommands(cmds) {
				const items = cmds.map((cmd) => ({
					id: cmd.id,
					label: cmd.title,
					description: cmd.description,
					group: "Editor",
					action: cmd.action,
				}))
				return useUiStore.getState().addContextCommands(items)
			},
			pushView(cmds, opts) {
				useUiStore.getState().pushPaletteView({
					items: cmds.map((cmd) => ({
						id: cmd.id,
						label: cmd.title,
						description: cmd.description,
						group: "",
						action: cmd.action,
					})),
					placeholder: opts?.placeholder,
					onConfirm: opts?.onConfirm,
				})
			},
		}

		// Extra editor context commands not covered by the editor plugin
		const deregisterExtra = useUiStore.getState().addContextCommands([
			{
				id: "editor:export-bpmn",
				label: "Export as BPMN XML",
				description: "Download diagram file",
				group: "Editor",
				action() {
					const xml = editorRef.current?.exportXml()
					if (!xml) return
					const blob = new Blob([xml], { type: "application/xml" })
					const url = URL.createObjectURL(blob)
					const a = document.createElement("a")
					a.href = url
					a.download = `${model?.name ?? "diagram"}.bpmn`
					a.click()
					URL.revokeObjectURL(url)
				},
			},
			{
				id: "editor:auto-layout",
				label: "Auto Layout",
				description: "Arrange elements automatically",
				group: "Editor",
				action() {
					editorRef.current?.autoLayout()
				},
			},
			{
				id: "editor:zoom-fit",
				label: "Zoom to Fit",
				description: "Fit entire diagram in view",
				group: "Editor",
				action() {
					editorRef.current?.fitView()
				},
			},
		])

		// ── Process runner ────────────────────────────────────────────────────
		const engine = new Engine()
		const tokenHighlight = createTokenHighlightPlugin()
		// FS-mode scenario callbacks — persist to sidecar file instead of IndexedDB
		const fsAdapter = getFsAdapter()
		const modelPath = model.path
		const fsScenarioCbs =
			fsAdapter && modelPath
				? {
						onSaveScenarios: async (scenarios: unknown[]) => {
							const meta = (await fsAdapter.loadMeta(modelPath)) ?? {
								id: model.id,
								createdAt: model.createdAt,
							}
							await fsAdapter.saveMeta(modelPath, { ...meta, scenarios })
						},
						onLoadScenarios: async () => {
							const meta = await fsAdapter.loadMeta(modelPath)
							return (
								(meta?.scenarios as import("@bpmnkit/plugins/process-runner").ScenarioLike[]) ?? []
							)
						},
						onSaveInputVars: async (vars: Array<{ name: string; value: string }>) => {
							const meta = (await fsAdapter.loadMeta(modelPath)) ?? {
								id: model.id,
								createdAt: model.createdAt,
							}
							await fsAdapter.saveMeta(modelPath, { ...meta, inputVars: vars })
						},
						onLoadInputVars: async () => {
							const meta = await fsAdapter.loadMeta(modelPath)
							return meta?.inputVars ?? []
						},
					}
				: {}

		const processRunner = createProcessRunnerPlugin({
			engine,
			tokenHighlight,
			playContainer: dock.playPane,
			testsContainer: dock.testsPane,
			...fsScenarioCbs,
			onShowPlayTab() {
				dock.setPlayTabVisible(true)
				if (dock.collapsed) dock.expand()
				dock.switchTab("play")
			},
			onHidePlayTab() {
				dock.setPlayTabVisible(false)
			},
			runScenario: (scenario) => {
				const xml = editorRef.current?.exportXml()
				if (!xml) return Promise.reject(new Error("No diagram loaded"))
				return runScenarioWasm(
					xml,
					scenario,
					(decisionId) => {
						const { models: currentModels } = useModelsStore.getState()
						return (
							currentModels.find((m) => m.type === "dmn" && m.content.includes(decisionId))
								?.content ?? null
						)
					},
					(processId) => {
						const { models: currentModels } = useModelsStore.getState()
						return (
							currentModels.find(
								(m) => m.type === "bpmn" && m.content.includes(`id="${processId}"`),
							)?.content ?? null
						)
					},
				)
			},
			getProjectId: () => model.id,
			getDefinitions: () => {
				const defs = editorRef.current?.getDefinitions()
				if (!defs) return null
				return {
					processes: defs.processes.map((p) => ({
						...p,
						flowElements: p.flowElements.map((el) => ({
							...el,
							decisionId: el.extensionElements.find((e) => e.name === "zeebe:calledDecision")
								?.attributes.decisionId,
						})),
					})),
				}
			},
			getJobType: (elementId) => {
				const defs = editorRef.current?.getDefinitions()
				if (!defs) return null
				for (const process of defs.processes) {
					const el = process.flowElements.find((f) => f.id === elementId)
					if (el) {
						return (
							el.extensionElements.find((e) => e.name === "zeebe:taskDefinition")?.attributes
								.type ?? null
						)
					}
				}
				return null
			},
			getValidationDmn: (decisionId) => {
				const { models: currentModels } = useModelsStore.getState()
				return (
					currentModels.find((m) => m.type === "dmn" && m.content.includes(decisionId))?.content ??
					null
				)
			},
		})
		processRunner.toolbar.classList.add("bpmnkit-runner-toolbar--hud-bottom")
		processRunner.toolbar.style.display = "none"
		document.body.appendChild(processRunner.toolbar)
		dock.setPlayTabClickHandler(() => {
			if (dock.collapsed) dock.expand()
		})
		dock.setTestsTabVisible(true)
		dock.setTestsTabClickHandler(() => {
			if (dock.collapsed) dock.expand()
		})

		// ── Plugins ───────────────────────────────────────────────────────────
		const configPanel = createConfigPanelPlugin({
			getDefinitions: () => editorRef.current?.getDefinitions() ?? null,
			applyChange: (fn) => {
				editorRef.current?.applyChange(fn)
			},
			container: dock.propertiesPane,
			onPanelShow: () => {
				if (dock.collapsed) dock.expand()
				dock.showPanel()
			},
			onPanelHide: () => dock.hidePanel(),
		})
		const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel, {
			applyChange: (fn) => editorRef.current?.applyChange(fn),
			onCreateValidationDmn: (dmnXml, fileName, decisionId) => {
				const { saveModel: saveFn, upsertModel: upsertFn } = useModelsStore.getState()
				void saveFn({
					id: crypto.randomUUID(),
					name: fileName.replace(/\.dmn$/i, ""),
					type: "dmn",
					content: dmnXml,
					createdAt: Date.now(),
				}).then(upsertFn)
				toast.success(`Validation DMN "${fileName}" created`)
			},
			onEditValidationDmn: (decisionId) => {
				const { models: currentModels } = useModelsStore.getState()
				const dmn = currentModels.find((m) => m.type === "dmn" && m.content.includes(decisionId))
				if (dmn) navigateRef.current(`/models/${dmn.id}`)
			},
		})

		// Bridge: wire element:click → editor:select so the config panel activates on element click
		const bridgePlugin: CanvasPlugin = {
			name: "studio-config-bridge",
			install(api) {
				type AnyEmit = (event: string, ...args: unknown[]) => void
				const emit = api.emit.bind(api) as unknown as AnyEmit
				api.on("element:click", (elId) => emit("editor:select", [elId]))
			},
		}

		// ── Editor ────────────────────────────────────────────────────────────
		const paletteEditorPlugin = createCommandPaletteEditorPlugin(
			bridgePalette,
			() => editorRef.current,
		)
		const connectorCatalog = createConnectorCatalogPlugin(configPanelBpmn, bridgePalette, {
			proxyUrl: useClusterStore.getState().proxyUrl,
		})
		const presentation = createPresentationPlugin({
			palette: bridgePalette,
			onEnter: () => {
				if (dockRef.current) dockRef.current.el.style.display = "none"
				useUiStore.getState().enterZenMode()
			},
			onExit: () => {
				if (dockRef.current) dockRef.current.el.style.display = ""
				useUiStore.getState().exitZenMode()
			},
		})
		presentationApiRef.current = presentation.api

		const editor = new BpmnEditor({
			container,
			theme: useThemeStore.getState().theme,
			fit: "center",
			plugins: [
				paletteEditorPlugin,
				bridgePlugin,
				configPanel,
				configPanelBpmn,
				connectorCatalog,
				presentation,
				tokenHighlight,
				processRunner,
			],
		})
		// XML view button — placed in bottom-left HUD panel
		const xmlBtn = document.createElement("button")
		xmlBtn.type = "button"
		xmlBtn.title = "View XML source"
		xmlBtn.innerHTML =
			'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M5 4L2 8l3 4"/><path d="M11 4l3 4-3 4"/><path d="M9 3l-2 10"/></svg>'
		xmlBtn.addEventListener("click", () => {
			const xml = editorRef.current?.exportXml()
			if (!xml) return
			showXmlDialog(xml)
		})

		initEditorHud(editor, {
			rawModeButton: xmlBtn,
			onToggleSidebar: () => {
				if (dock.collapsed) dock.expand()
				else dock.collapse()
			},
			openDecision: (decisionId) => {
				const { models: currentModels } = useModelsStore.getState()
				const dmn = currentModels.find((m) => m.type === "dmn" && m.content.includes(decisionId))
				if (dmn) navigateRef.current(`/models/${dmn.id}`)
			},
			getAvailableDecisions: () => {
				const { models: currentModels } = useModelsStore.getState()
				const result: Array<{ id: string; name?: string }> = []
				for (const m of currentModels) {
					if (m.type !== "dmn") continue
					for (const match of m.content.matchAll(
						/<decision[^>]+id="([^"]+)"(?:[^>]+name="([^"]+)")?/g,
					)) {
						result.push({ id: match[1] ?? "", name: match[2] ?? m.name })
					}
				}
				return result
			},
		})
		editorRef.current = editor

		// Update docs pane when selection changes
		const offSelect = editor.on("editor:select", (ids) => {
			const type = ids.length === 1 && ids[0] ? editor.getElementType(ids[0]) : null
			renderDocs(type)
		})

		if (model.content) {
			editor.load(model.content)
		}

		const off = editor.on("diagram:change", () => {
			setSaveStatus("unsaved")
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
			saveTimerRef.current = setTimeout(() => {
				void doSave()
			}, 2000)
		})

		// Register editor AI context for the Studio AI drawer
		const { saveModel: saveModelFn, upsertModel: upsertModelFn } = useModelsStore.getState()
		useUiStore.getState().setEditorAiContext({
			getDefinitions: () => editorRef.current?.getDefinitions() ?? null,
			loadXml: (xml) => editorRef.current?.load(xml),
			getTheme: () => (useThemeStore.getState().theme === "light" ? "light" : "dark"),
			createCompanionFile: async (name, type, content) => {
				const newModel = await saveModelFn({
					id: crypto.randomUUID(),
					name,
					type,
					content,
					createdAt: Date.now(),
				})
				upsertModelFn(newModel)
			},
		})

		return () => {
			off()
			offSelect()
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
			processRunner.toolbar.remove()
			render(null, dock.deployPane)
			render(null, dock.docsPane)
			dock.el.remove()
			dockRef.current = null
			editor.destroy() // triggers paletteEditorPlugin.uninstall() → clears element commands
			deregisterExtra()
			useUiStore.getState().clearContextCommands()
			useUiStore.getState().setEditorAiContext(null)
			editorRef.current = null
			presentationApiRef.current = null
		}
	}, [id, loaded])

	// Sync editor theme
	useEffect(() => {
		editorRef.current?.setTheme(theme)
		dmnEditorRef.current?.setTheme(theme === "light" ? "light" : "dark")
	}, [theme])

	// Hide/show dock when entering/exiting run mode
	useEffect(() => {
		dockRef.current?.setVisible(!runMode)
	}, [runMode])

	const handleDeployAndRun = useCallback(async () => {
		const editor = editorRef.current
		if (!editor || !model) return
		// Save first
		const xml = editor.exportXml()
		if (!xml) return
		try {
			setSaveStatus("saving")
			const updated = await saveModel({ ...model, content: xml })
			upsertModel(updated)
			setSaveStatus("saved")
		} catch {
			setSaveStatus("unsaved")
			toast.error("Failed to save model")
			return
		}
		// Deploy
		let bpmnProcessId: string | undefined
		try {
			const companions = getCompanionDmns(xml, useModelsStore.getState().models)
			const deployResult = await deploy.mutateAsync({
				xml,
				fileName: `${model.name}.bpmn`,
				...(companions.length && { companions }),
			})
			bpmnProcessId = deployResult.processes?.[0]?.bpmnProcessId
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
			return
		}
		if (!bpmnProcessId) {
			toast.error("Deploy did not return a process ID")
			return
		}
		// Start instance
		let vars: Record<string, unknown> = {}
		try {
			const trimmed = runVariables.trim()
			if (trimmed && trimmed !== "{}") vars = JSON.parse(trimmed)
		} catch {
			toast.error("Variables must be valid JSON")
			return
		}
		try {
			const result = await createInstance.mutateAsync({ bpmnProcessId, variables: vars })
			setActiveInstanceKey(result.processInstanceKey)
			setRunMode(true)
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
		}
	}, [model, saveModel, upsertModel, deploy, createInstance, runVariables])

	const handleDeploy = useCallback(async () => {
		const editor = editorRef.current
		if (!editor || !model) return
		const xml = editor.exportXml()
		if (!xml) return
		try {
			const companions = getCompanionDmns(xml, useModelsStore.getState().models)
			await deploy.mutateAsync({
				xml,
				fileName: `${model.name}.bpmn`,
				...(companions.length && { companions }),
			})
			toast.success("Deployed")
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
		}
	}, [model, deploy])

	async function handleExportSource() {
		if (!model) return
		let content: string | null = null
		let ext: string
		let mimeType: string
		if (model.type === "dmn") {
			content = (await dmnEditorRef.current?.getXML()) ?? model.content
			ext = ".dmn"
			mimeType = "application/xml"
		} else if (model.type === "form") {
			content = model.content
			ext = ".form"
			mimeType = "application/json"
		} else {
			content = editorRef.current?.exportXml() ?? null
			ext = ".bpmn"
			mimeType = "application/xml"
		}
		if (!content) return
		const blob = new Blob([content], { type: mimeType })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `${model.name}${ext}`
		a.click()
		URL.revokeObjectURL(url)
	}

	function handleExportSvg() {
		const container = editorRef.current?.container
		const svg = container?.querySelector("svg")
		if (!svg) return
		const serializer = new XMLSerializer()
		const svgStr = serializer.serializeToString(svg)
		const blob = new Blob([svgStr], { type: "image/svg+xml" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `${model?.name ?? "diagram"}.svg`
		a.click()
		URL.revokeObjectURL(url)
	}

	function handleRunVariablesChange(v: string) {
		setRunVariables(v)
		if (runVarsSaveTimerRef.current) clearTimeout(runVarsSaveTimerRef.current)
		runVarsSaveTimerRef.current = setTimeout(() => {
			if (!model) return
			void saveModel({ ...model, runVariables: v }).then(upsertModel)
		}, 1000)
	}

	// ⌘S saves immediately
	// biome-ignore lint/correctness/useExhaustiveDependencies: doSave reads from refs; id/model trigger re-registration
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault()
				void doSave()
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [id, model])

	async function doSave() {
		if (!model) return
		let xml: string | null = null
		if (dmnEditorRef.current) {
			xml = await dmnEditorRef.current.getXML()
		} else if (editorRef.current) {
			xml = editorRef.current.exportXml()
		}
		if (!xml) return
		setSaveStatus("saving")
		try {
			const updated = await saveModel({ ...model, content: xml })
			upsertModel(updated)
			setSaveStatus("saved")
		} catch {
			setSaveStatus("unsaved")
			toast.error("Failed to save model")
		}
	}

	if (!model) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
				<p className="text-lg font-medium text-fg">Model not found</p>
				<Link href="/models" className="text-sm text-accent hover:underline">
					← Back to Models
				</Link>
			</div>
		)
	}

	const isPending = deploy.isPending || createInstance.isPending

	return (
		<div className="flex flex-col h-full">
			{/* Save bar — hidden in zen/presentation mode */}
			{!zenMode && (
				<div className="flex items-center h-10 shrink-0 gap-3 px-3 border-b border-border bg-surface">
					{runMode ? (
						<Button size="sm" variant="ghost" onClick={() => setRunMode(false)}>
							<ArrowLeft size={14} />
							Edit
						</Button>
					) : (
						<>
							<span
								className={`text-xs transition-colors ${
									saveStatus === "saved"
										? "text-success"
										: saveStatus === "saving"
											? "text-warn"
											: "text-muted"
								}`}
							>
								{saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : "Unsaved"}
							</span>
							<Button size="sm" variant="ghost" onClick={() => void doSave()}>
								<Save size={14} />
								Save
							</Button>
						</>
					)}
					{!runMode && (
						<div className="ml-auto flex items-center gap-2">
							<Button size="sm" variant="ghost" onClick={() => presentationApiRef.current?.enter()}>
								<MonitorPlay size={14} />
								Present
							</Button>
							{isWasm && (
								<>
									<Button
										size="sm"
										variant="outline"
										onClick={() => void handleDeploy()}
										disabled={isPending}
									>
										{deploy.isPending ? (
											<RotateCw size={13} className="animate-spin" />
										) : (
											<Rocket size={13} />
										)}
										Deploy
									</Button>
									<Button size="sm" onClick={() => void handleDeployAndRun()} disabled={isPending}>
										{isPending ? (
											<RotateCw size={13} className="animate-spin" />
										) : (
											<Play size={13} />
										)}
										Deploy &amp; Run
									</Button>
								</>
							)}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button size="sm" variant="ghost" aria-label="Export options">
										<MoreHorizontal size={14} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="z-[10000]">
									<DropdownMenuItem onClick={() => void handleExportSource()}>
										<FileCode size={13} />
										{model.type === "dmn"
											? "Export as DMN XML"
											: model.type === "form"
												? "Export as JSON"
												: "Export as BPMN XML"}
									</DropdownMenuItem>
									{model.type === "bpmn" && (
										<DropdownMenuItem onClick={handleExportSvg}>
											<Image size={13} />
											Export as SVG
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}
				</div>
			)}

			{/* Markdown editor */}
			{model.type === "md" && (
				<textarea
					className="flex-1 min-h-0 resize-none p-4 font-mono text-sm text-fg bg-bg border-0 outline-none"
					value={mdContent}
					onInput={(e) => {
						const v = (e.target as HTMLTextAreaElement).value
						setMdContent(v)
						setSaveStatus("unsaved")
						if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
						saveTimerRef.current = setTimeout(() => {
							if (!model) return
							void saveModel({ ...model, content: v })
								.then(upsertModel)
								.then(() => setSaveStatus("saved"))
						}, 1500)
					}}
					aria-label="Markdown editor"
				/>
			)}

			{/* BPMN/DMN/Form editor — hidden in run mode but kept mounted */}
			<div
				ref={editorContainerRef}
				className={`flex-1 overflow-hidden relative min-h-0 ${model.type === "md" || runMode ? "hidden" : ""}`}
			/>

			{/* Run mode — live instance view */}
			{runMode && activeInstanceKey && (
				<div className="flex-1 overflow-hidden min-h-0">
					<WasmInstanceDetail
						instanceKey={activeInstanceKey}
						initialVariables={runVariables}
						onVariablesChange={handleRunVariablesChange}
						hideNavLink
					/>
				</div>
			)}
		</div>
	)
}
