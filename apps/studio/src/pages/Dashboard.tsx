import {
	AlertTriangle,
	CheckSquare,
	ChevronDown,
	ChevronUp,
	GitBranch,
	Layers,
	Play,
	RefreshCw,
	WifiOff,
	X,
	Zap,
} from "lucide-react"
import type { ComponentChildren } from "preact"
import { useEffect, useState } from "preact/hooks"
import { Link, useLocation } from "wouter"
import {
	useDashboardStats,
	useDefinitions,
	useIncidents,
	useInstances,
	useJobs,
	useUserTasks,
} from "../api/queries.js"
import type { ProcessDefinition } from "../api/types.js"
import { ProfileTag } from "../components/ProfileTag.js"
import { StatusPill } from "../components/StatusPill.js"
import { Button } from "../components/ui/button.js"
import {
	getOnboardingState,
	hideOnboarding,
	markExampleOpened,
	markInstanceStarted,
	setCollapsed,
} from "../lib/onboarding.js"
import { useClusterStore } from "../stores/cluster.js"
import { useModeStore } from "../stores/mode.js"
import { useModelsStore } from "../stores/models.js"
import { useUiStore } from "../stores/ui.js"
import { PROCESS_TEMPLATES } from "../templates/index.js"

// ── Time series ───────────────────────────────────────────────────────────────

const TS_KEY = "bpmnkit:timeseries"
const TS_MAX = 24

interface TsPoint {
	t: number
	running: number
	incidents: number
}

function loadTimeSeries(): TsPoint[] {
	try {
		return JSON.parse(localStorage.getItem(TS_KEY) ?? "[]") as TsPoint[]
	} catch {
		return []
	}
}

function saveTimeSeries(pts: TsPoint[]): void {
	try {
		localStorage.setItem(TS_KEY, JSON.stringify(pts.slice(-TS_MAX)))
	} catch {
		/* ignore */
	}
}

function appendPoint(running: number, incidents: number): TsPoint[] {
	const pts = loadTimeSeries()
	pts.push({ t: Date.now(), running, incidents })
	const next = pts.slice(-TS_MAX)
	saveTimeSeries(next)
	return next
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
	if (values.length < 2) return null
	const w = 64
	const h = 28
	const pad = 2
	const min = Math.min(...values)
	const max = Math.max(...values)
	const range = max - min || 1
	const pts = values
		.map((v, i) => {
			const x = pad + (i / (values.length - 1)) * (w - pad * 2)
			const y = pad + (1 - (v - min) / range) * (h - pad * 2)
			return `${x.toFixed(1)},${y.toFixed(1)}`
		})
		.join(" ")
	return (
		<svg width={w} height={h} className="shrink-0 opacity-50" role="img" aria-label="Trend chart">
			<polyline
				points={pts}
				fill="none"
				stroke={stroke}
				strokeWidth="1.5"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
		</svg>
	)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(date: string): string {
	const diff = Date.now() - new Date(date).getTime()
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
	if (diff < 60_000) return rtf.format(-Math.floor(diff / 1000), "second")
	if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), "minute")
	if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), "hour")
	return rtf.format(-Math.floor(diff / 86_400_000), "day")
}

function SkeletonList() {
	return (
		<>
			<div className="h-4 animate-pulse bg-surface-2" />
			<div className="h-4 w-5/6 animate-pulse bg-surface-2" />
			<div className="h-4 w-4/6 animate-pulse bg-surface-2" />
		</>
	)
}

function MiniRow({ href, children }: { href: string; children: ComponentChildren }) {
	return (
		<Link
			href={href}
			className="ds-datum -mx-1 flex items-center gap-2 px-1 py-0.5 text-[11px] transition-colors duration-100 hover:bg-bg"
		>
			{children}
		</Link>
	)
}

function groupDefinitions(
	items: ProcessDefinition[],
): Array<{ id: string; name: string; latest: ProcessDefinition }> {
	const map = new Map<string, ProcessDefinition[]>()
	for (const def of items) {
		const existing = map.get(def.processDefinitionId)
		if (existing) existing.push(def)
		else map.set(def.processDefinitionId, [def])
	}
	return Array.from(map.entries()).map(([id, versions]) => {
		const sorted = [...versions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
		const latest = sorted[0] as ProcessDefinition
		return { id, name: latest.name || id, latest }
	})
}

// ── Stat card ─────────────────────────────────────────────────────────────────

/**
 * One reading in the dashboard grid. The grid is a single bordered box
 * subdivided by hairlines, so the card draws no border of its own and does not
 * lift on hover — an alarming metric is marked by its accent, not by depth.
 */
function StatCard({
	icon: Icon,
	value,
	label,
	href,
	danger,
	sparkline,
	offline,
	children,
}: {
	icon: typeof Play
	value: number | undefined
	label: string
	href: string
	danger?: boolean
	sparkline?: ComponentChildren
	offline?: boolean
	children: ComponentChildren
}) {
	const isDangerous = !offline && danger && (value ?? 0) > 0
	return (
		<div className={`ds-cell relative flex flex-col p-0 ${offline ? "opacity-60" : ""}`}>
			{/* Live alert indicator — pulses when danger state is active */}
			{isDangerous && (
				<span className="absolute top-3 right-3 flex h-2 w-2" aria-hidden="true">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
					<span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
				</span>
			)}

			<Link
				href={href}
				className="flex items-start gap-3 p-4 transition-colors duration-150 hover:bg-bg"
			>
				<Icon
					size={16}
					className={`mt-0.5 shrink-0 ${isDangerous ? "text-danger" : "text-muted"}`}
					aria-hidden="true"
				/>
				<div className="min-w-0 flex-1">
					<div className="ds-label">{label}</div>
					<div
						className={`ds-datum mt-1.5 text-[28px] leading-none ${
							isDangerous ? "text-danger" : "text-fg"
						}`}
					>
						{offline ? (
							<span className="text-muted">—</span>
						) : value === undefined ? (
							<span className="inline-block h-6 w-12 animate-pulse bg-surface-2" />
						) : (
							value.toLocaleString()
						)}
					</div>
				</div>
				{!offline && sparkline}
			</Link>

			<div className="flex flex-1 flex-col gap-1 border-t border-border/60 px-4 py-3">
				{offline ? <p className="text-muted text-xs">No data — proxy not running.</p> : children}
			</div>
		</div>
	)
}

// ── Status header ─────────────────────────────────────────────────────────────

function StatusHeader({
	activeProfile,
	profileTags,
	status,
	lastUpdatedAt,
	onRefresh,
	refreshing,
}: {
	activeProfile: string | null
	profileTags?: string[]
	status: "connected" | "offline" | "loading"
	lastUpdatedAt: number
	onRefresh: () => void
	refreshing: boolean
}) {
	// Tick every 10 s so the "Updated X ago" label stays current
	const [, setTick] = useState(0)
	useEffect(() => {
		const id = setInterval(() => setTick((n) => n + 1), 10_000)
		return () => clearInterval(id)
	}, [])

	const dotClass =
		status === "connected"
			? "bg-success"
			: status === "loading"
				? "bg-warn animate-pulse"
				: "bg-danger"

	const statusLabel =
		status === "connected" ? "Connected" : status === "loading" ? "Connecting…" : "Offline"

	const updatedLabel =
		lastUpdatedAt > 0
			? `Updated ${formatRelativeTime(new Date(lastUpdatedAt).toISOString())}`
			: null

	return (
		<div className="ds-head">
			<span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
			<span className="ds-datum min-w-0 flex-1 truncate text-fg text-sm">
				{activeProfile ?? "No profile selected"}
			</span>
			{profileTags && profileTags.length > 0 && (
				<div className="flex shrink-0 items-center gap-1">
					{profileTags.map((t) => (
						<ProfileTag key={t} tag={t} />
					))}
				</div>
			)}
			<span className="ds-label shrink-0">{statusLabel}</span>
			{updatedLabel && (
				<span className="ds-label ds-label--micro hidden shrink-0 md:block">{updatedLabel}</span>
			)}
			<button
				type="button"
				onClick={onRefresh}
				disabled={refreshing || status === "loading"}
				className="ds-btn ml-auto shrink-0 text-xs"
				aria-label={status === "offline" ? "Retry proxy connection" : "Refresh dashboard"}
			>
				<RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
				{status === "offline" ? "Retry" : "Refresh"}
			</button>
		</div>
	)
}

// ── Incident alert banner ─────────────────────────────────────────────────────

function IncidentBanner({ count, onDismiss }: { count: number; onDismiss: () => void }) {
	return (
		<div className="ds-note ds-note--danger">
			<AlertTriangle size={15} className="shrink-0 text-danger" />
			<span className="flex-1 text-fg">
				{count === 1 ? "1 active incident" : `${count.toLocaleString()} active incidents`} requiring
				attention
			</span>
			<Link href="/incidents" className="shrink-0 whitespace-nowrap text-danger hover:underline">
				View all →
			</Link>
			<button
				type="button"
				onClick={onDismiss}
				className="ml-1 shrink-0 text-muted transition-colors duration-150 hover:text-danger"
				aria-label="Dismiss alert"
			>
				<X size={14} />
			</button>
		</div>
	)
}

// ── Offline panel ─────────────────────────────────────────────────────────────

function OfflinePanel({
	proxyUrl,
	onRetry,
	retrying,
}: {
	proxyUrl: string
	onRetry: () => void
	retrying: boolean
}) {
	return (
		<div className="ds-box ds-empty">
			<WifiOff size={24} className="text-muted" />
			<div className="flex flex-col gap-1.5">
				<h3 className="ds-title text-base">Proxy not running</h3>
				<p className="ds-lede max-w-xs">
					Start the proxy server to connect to your Camunda cluster and see live data.
				</p>
			</div>
			<div className="flex flex-col items-center gap-2">
				<code className="ds-code select-all">pnpm proxy</code>
				<span className="text-muted text-xs">
					or set a different URL in{" "}
					<Link href="/settings" className="text-accent hover:underline">
						Settings
					</Link>
				</span>
			</div>
			<button type="button" onClick={onRetry} disabled={retrying} className="ds-btn">
				<RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
				{retrying ? "Connecting…" : "Retry connection"}
			</button>
			<p className="ds-datum text-[11px] text-muted">{proxyUrl}</p>
		</div>
	)
}

// ── Onboarding checklist ──────────────────────────────────────────────────────

function OnboardingChecklist() {
	const { data: stats } = useDashboardStats()
	const { activeProfile } = useClusterStore()
	const { saveModel } = useModelsStore()
	const { openWelcomeModal } = useUiStore()
	const [, navigate] = useLocation()

	const obs = getOnboardingState()
	const [hidden, setHidden] = useState(obs.hidden)
	const [collapsed, setLocalCollapsed] = useState(obs.collapsed)
	const [exampleOpened, setExampleOpened] = useState(obs.exampleOpened)
	const [instanceStarted, setInstanceStarted] = useState(obs.instanceStarted)

	if (!obs.seen || hidden) return null

	const step1Done = exampleOpened
	const step2Done = !!activeProfile
	const step3Done = (stats?.deployedDefinitions ?? 0) > 0
	const step4Done = (stats?.runningInstances ?? 0) > 0 || instanceStarted

	const completedCount = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length
	const allDone = completedCount === 4

	// Auto-hide 3s after all steps complete
	useEffect(() => {
		if (allDone) {
			const t = setTimeout(() => {
				hideOnboarding()
				setHidden(true)
			}, 3000)
			return () => clearTimeout(t)
		}
	}, [allDone])

	function handleHide() {
		hideOnboarding()
		setHidden(true)
	}

	function handleToggleCollapse() {
		const next = !collapsed
		setLocalCollapsed(next)
		setCollapsed(next)
	}

	async function handleOpenExample() {
		const tpl = PROCESS_TEMPLATES.find((t) => t.id === "tpl-fetch-summarize-webpage")
		if (!tpl) {
			console.error("onboarding: template tpl-fetch-summarize-webpage not found")
			return
		}
		markExampleOpened()
		setExampleOpened(true)
		try {
			const model = await saveModel({
				id: crypto.randomUUID(),
				name: tpl.name,
				type: "bpmn",
				content: tpl.bpmn,
				createdAt: Date.now(),
			})
			navigate(`/models/${model.id}`)
		} catch (err) {
			console.error("onboarding: failed to save example model", err)
		}
	}

	const steps = [
		{
			label: "Open an example process",
			description: "See a real BPMN workflow with HTTP and AI steps.",
			done: step1Done,
			action: !step1Done ? (
				<Button size="sm" variant="outline" onClick={() => void handleOpenExample()}>
					Open example →
				</Button>
			) : null,
		},
		{
			label: "Connect a Zeebe cluster",
			description: "Use the CLI to connect Studio to your Camunda cluster.",
			done: step2Done,
			action: !step2Done ? (
				<div className="flex flex-col gap-2 mt-2">
					<pre className="ds-code">{`# Install CLI
npm install -g @bpmnkit/cli

# Add a Zeebe profile
casen profile add my-cluster \\
  --base-url https://... \\
  --auth-type oauth2 \\
  --client-id YOUR_ID \\
  --client-secret YOUR_SECRET

# Launch Studio with that profile
casen studio --profile my-cluster`}</pre>
					<Button size="sm" variant="outline" onClick={() => navigate("/settings")}>
						Configure in Settings →
					</Button>
				</div>
			) : null,
		},
		{
			label: "Deploy a definition",
			description: "Push a process model to your connected cluster.",
			done: step3Done,
			action:
				!step3Done && step2Done ? (
					<Button size="sm" variant="outline" onClick={() => navigate("/definitions")}>
						Go to Definitions →
					</Button>
				) : null,
		},
		{
			label: "Run your first instance",
			description: "Trigger an instance and watch it execute.",
			done: step4Done,
			action:
				!step4Done && step3Done ? (
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							markInstanceStarted()
							setInstanceStarted(true)
							navigate("/instances")
						}}
					>
						Start an instance →
					</Button>
				) : null,
		},
	]

	return (
		<div className="ds-box border-accent border-l-2">
			{/* Header */}
			<div className="ds-box-head">
				<button
					type="button"
					onClick={handleToggleCollapse}
					className="flex flex-1 items-center gap-2 text-fg transition-colors hover:text-accent"
				>
					{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
					{allDone ? (
						<span className="ds-label text-success">All set — you're ready to automate</span>
					) : (
						<>
							<span className="ds-label text-fg">Get started</span>
							<span className="ds-datum text-[11px] text-muted">
								{completedCount}/{steps.length}
							</span>
						</>
					)}
				</button>
				<button
					type="button"
					onClick={() => openWelcomeModal()}
					className="ds-label transition-colors hover:text-fg"
				>
					Welcome guide
				</button>
				<button
					type="button"
					onClick={handleHide}
					className="text-muted transition-colors hover:text-fg"
					aria-label="Hide checklist"
				>
					<X size={14} />
				</button>
			</div>

			{/* Progress — a hairline that fills, not a bar with a shape */}
			<div className="h-px bg-border">
				<div
					className="h-full bg-accent transition-all duration-500"
					style={{ width: `${(completedCount / steps.length) * 100}%` }}
				/>
			</div>

			{/* Steps */}
			{!collapsed && (
				<div className="ds-rows flex flex-col">
					{steps.map((step) => (
						<div key={step.label} className="flex gap-3 px-3 py-2.5">
							<span
								className={`ds-datum mt-px shrink-0 text-xs ${
									step.done ? "text-success" : "text-muted"
								}`}
								aria-hidden="true"
							>
								{step.done ? "[x]" : "[ ]"}
							</span>
							<div className="flex flex-col gap-1">
								<span className={`text-sm ${step.done ? "text-muted line-through" : "text-fg"}`}>
									{step.label}
								</span>
								{!step.done && <span className="text-muted text-xs">{step.description}</span>}
								{!step.done && step.action}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
	const { data: stats, isLoading, refetch, dataUpdatedAt } = useDashboardStats()
	const { data: recentDefs } = useDefinitions()
	const { data: activeIncidents } = useIncidents({ state: "ACTIVE" })
	const { data: recentInstances } = useInstances({ state: "ACTIVE" })
	const { data: recentTasks } = useUserTasks()
	const { data: recentJobs } = useJobs({ state: "CREATED" })
	const { models } = useModelsStore()
	const { mode } = useModeStore()
	const { setBreadcrumbs } = useUiStore()
	const { status, proxyUrl, profiles, activeProfile, loadProfiles } = useClusterStore()
	const [refreshing, setRefreshing] = useState(false)
	const [timeSeries, setTimeSeries] = useState<TsPoint[]>(loadTimeSeries)
	const [bannerDismissed, setBannerDismissed] = useState(false)

	const isOffline = status === "offline"
	const isDataLoading = status === "loading" || isLoading

	const definitionGroups = groupDefinitions(recentDefs?.items ?? [])
	const runningValues = timeSeries.map((p) => p.running)
	const incidentValues = timeSeries.map((p) => p.incidents)
	const activeProfileData = profiles.find((p) => p.name === activeProfile)
	const activeIncidentCount = stats?.activeIncidents ?? 0
	const showBanner = !isOffline && !bannerDismissed && activeIncidentCount > 0

	useEffect(() => {
		setBreadcrumbs([{ label: "Dashboard" }])
	}, [setBreadcrumbs])

	// biome-ignore lint/correctness/useExhaustiveDependencies: dataUpdatedAt triggers when stats are fresh
	useEffect(() => {
		if (stats) {
			setTimeSeries(appendPoint(stats.runningInstances, stats.activeIncidents))
		}
	}, [dataUpdatedAt, stats])

	// Re-surface the banner when incident count rises
	useEffect(() => {
		if (activeIncidentCount > 0) setBannerDismissed(false)
	}, [activeIncidentCount])

	async function handleRefresh() {
		setRefreshing(true)
		if (isOffline) {
			await loadProfiles()
		} else {
			await refetch()
		}
		setRefreshing(false)
	}

	return (
		<div className="ds-page flex animate-in flex-col gap-4 fade-in slide-in-from-bottom-2 duration-300">
			<OnboardingChecklist />

			{/* Status header */}
			<StatusHeader
				activeProfile={activeProfile}
				profileTags={activeProfileData?.tags}
				status={status}
				lastUpdatedAt={dataUpdatedAt}
				onRefresh={() => void handleRefresh()}
				refreshing={refreshing}
			/>

			{/* Incident alert banner */}
			{showBanner && (
				<IncidentBanner count={activeIncidentCount} onDismiss={() => setBannerDismissed(true)} />
			)}

			{isOffline ? (
				/* ── Offline state ──────────────────────────────────────────────── */
				<div className="flex flex-col gap-4">
					<OfflinePanel
						proxyUrl={proxyUrl}
						onRetry={() => void handleRefresh()}
						retrying={refreshing}
					/>
					{/* Local models are still accessible when offline */}
					{mode === "developer" && models.length > 0 && (
						<div className="ds-box">
							<div className="ds-box-head">
								<span className="ds-label">Local Models</span>
							</div>
							<div className="ds-rows">
								{models.slice(0, 6).map((m) => (
									<Link key={m.id} href={`/models/${m.id}`} className="ds-row py-2 text-sm">
										<span className="flex-1 truncate text-fg">{m.name}</span>
										<span className="ds-mark">{m.type}</span>
									</Link>
								))}
							</div>
						</div>
					)}
				</div>
			) : (
				/* ── Connected state ────────────────────────────────────────────── */
				<>
					<div className="ds-grid [--ds-col:230px]">
						{/* Operator: tasks first — highest urgency */}
						{mode === "operator" && (
							<StatCard
								icon={CheckSquare}
								value={isDataLoading ? undefined : stats?.pendingTasks}
								label="Pending Tasks"
								href="/tasks"
								offline={isOffline}
								danger={recentTasks?.items.some(
									(t) => t.dueDate && new Date(t.dueDate) < new Date(),
								)}
							>
								{!recentTasks ? (
									<SkeletonList />
								) : recentTasks.items.length === 0 ? (
									<p className="text-xs text-muted">No pending tasks.</p>
								) : (
									[...recentTasks.items]
										.sort((a, b) => {
											const aOver = a.dueDate && new Date(a.dueDate) < new Date() ? 0 : 1
											const bOver = b.dueDate && new Date(b.dueDate) < new Date() ? 0 : 1
											return aOver - bOver
										})
										.slice(0, 4)
										.map((task) => {
											const overdue = task.dueDate && new Date(task.dueDate) < new Date()
											return (
												<MiniRow key={task.userTaskKey} href={`/tasks/${task.userTaskKey}`}>
													<span
														className={`flex-1 truncate ${overdue ? "text-danger" : "text-fg"}`}
													>
														{task.name || `Task ${task.userTaskKey}`}
													</span>
													<span className="shrink-0 italic text-muted">
														{task.assignee ?? "Unassigned"}
													</span>
												</MiniRow>
											)
										})
								)}
							</StatCard>
						)}

						{/* Active incidents — always prominent, live indicator when count > 0 */}
						<StatCard
							icon={AlertTriangle}
							value={isDataLoading ? undefined : stats?.activeIncidents}
							label="Active Incidents"
							href="/incidents"
							offline={isOffline}
							danger
							sparkline={<Sparkline values={incidentValues} stroke="var(--bpmnkit-danger)" />}
						>
							{!activeIncidents ? (
								<SkeletonList />
							) : activeIncidents.items.length === 0 ? (
								<p className="text-xs text-success">No active incidents — processes healthy.</p>
							) : (
								activeIncidents.items.slice(0, 4).map((inc) => (
									<MiniRow key={inc.incidentKey} href={`/incidents/${inc.incidentKey}`}>
										<span className="flex-1 truncate text-danger">{inc.errorType}</span>
										{inc.creationTime && (
											<span className="shrink-0 text-muted">
												{formatRelativeTime(inc.creationTime)}
											</span>
										)}
									</MiniRow>
								))
							)}
						</StatCard>

						{/* Running instances */}
						<StatCard
							icon={Play}
							value={isDataLoading ? undefined : stats?.runningInstances}
							label="Running Instances"
							href="/instances"
							offline={isOffline}
							sparkline={<Sparkline values={runningValues} stroke="var(--bpmnkit-accent)" />}
						>
							{!recentInstances ? (
								<SkeletonList />
							) : recentInstances.items.length === 0 ? (
								<p className="text-xs text-muted">
									No active instances.{" "}
									<Link href="/definitions" className="text-accent hover:underline">
										Deploy a definition
									</Link>{" "}
									to start one.
								</p>
							) : (
								recentInstances.items.slice(0, 4).map((inst) => (
									<MiniRow
										key={inst.processInstanceKey}
										href={`/instances/${inst.processInstanceKey}`}
									>
										<span className="flex-1 truncate text-fg">{inst.processDefinitionId}</span>
										<StatusPill state={inst.state} />
										{inst.startDate && (
											<span className="shrink-0 text-muted">
												{formatRelativeTime(inst.startDate)}
											</span>
										)}
									</MiniRow>
								))
							)}
						</StatCard>

						{/* Developer: tasks in third slot */}
						{mode === "developer" && (
							<StatCard
								icon={CheckSquare}
								value={isDataLoading ? undefined : stats?.pendingTasks}
								label="Pending Tasks"
								href="/tasks"
								offline={isOffline}
							>
								{!recentTasks ? (
									<SkeletonList />
								) : recentTasks.items.length === 0 ? (
									<p className="text-xs text-muted">No pending tasks.</p>
								) : (
									recentTasks.items.slice(0, 4).map((task) => (
										<MiniRow key={task.userTaskKey} href={`/tasks/${task.userTaskKey}`}>
											<span className="flex-1 truncate text-fg">
												{task.name || `Task ${task.userTaskKey}`}
											</span>
											<span className="shrink-0 italic text-muted">
												{task.assignee ?? "Unassigned"}
											</span>
										</MiniRow>
									))
								)}
							</StatCard>
						)}

						{/* Deployed definitions */}
						<StatCard
							icon={Layers}
							value={isDataLoading ? undefined : stats?.deployedDefinitions}
							label="Deployed Definitions"
							href="/definitions"
							offline={isOffline}
						>
							{!recentDefs ? (
								<SkeletonList />
							) : definitionGroups.length === 0 ? (
								<p className="text-xs text-muted">
									No definitions deployed.{" "}
									<Link href="/models" className="text-accent hover:underline">
										Create a model
									</Link>{" "}
									to get started.
								</p>
							) : (
								definitionGroups.slice(0, 4).map((g) => (
									<MiniRow key={g.id} href={`/definitions/${g.latest.processDefinitionKey}`}>
										<span className="flex-1 truncate text-fg">{g.name}</span>
										<span className="shrink-0 text-muted">v{g.latest.version}</span>
										{g.latest.deploymentTime && (
											<span className="shrink-0 text-muted">
												{formatRelativeTime(g.latest.deploymentTime)}
											</span>
										)}
									</MiniRow>
								))
							)}
						</StatCard>

						{/* Active jobs */}
						<StatCard
							icon={Zap}
							value={isDataLoading ? undefined : stats?.activeJobs}
							label="Active Jobs"
							href="/instances"
							offline={isOffline}
						>
							{!recentJobs ? (
								<SkeletonList />
							) : recentJobs.items.length === 0 ? (
								<p className="text-xs text-muted">No active jobs.</p>
							) : (
								recentJobs.items.slice(0, 4).map((job) => (
									<MiniRow
										key={job.jobKey}
										href={
											job.processInstanceKey ? `/instances/${job.processInstanceKey}` : "/instances"
										}
									>
										<span className="flex-1 truncate text-fg">{job.type}</span>
										{job.processInstanceKey && (
											<span className="shrink-0 text-muted">
												…{job.processInstanceKey.slice(-6)}
											</span>
										)}
									</MiniRow>
								))
							)}
						</StatCard>

						{/* Developer only: local models */}
						{mode === "developer" && (
							<StatCard icon={GitBranch} value={models.length} label="Local Models" href="/models">
								{models.length === 0 ? (
									<p className="text-xs text-muted">
										No local models.{" "}
										<Link href="/models" className="text-accent hover:underline">
											Create your first model
										</Link>
										.
									</p>
								) : (
									models.slice(0, 4).map((m) => (
										<MiniRow key={m.id} href={`/models/${m.id}`}>
											<span className="flex-1 truncate text-fg">{m.name}</span>
											<span className="ds-mark shrink-0">{m.type}</span>
										</MiniRow>
									))
								)}
							</StatCard>
						)}
					</div>
				</>
			)}
		</div>
	)
}
