import type { TokenUsage } from "../shared/recording-types.js"
import { formatTokenCount } from "./format-tokens.js"

const MIN_AXIS_MAX_MS = 5 * 60 * 1000
const MINUTE_MS = 60 * 1000

export interface RaceChartPanelData {
	elapsedMs: number
	streaming: boolean
	text: string
	usage: TokenUsage | null
	finished: boolean
}

export interface RaceChartRow {
	id: string
	label: string
	colorVar: string
	data: RaceChartPanelData
}

export interface RaceChartProps {
	rows: RaceChartRow[]
}

function computeAxisMaxMs(elapsedTimes: number[]): number {
	const maxElapsed = Math.max(...elapsedTimes)
	if (maxElapsed <= MIN_AXIS_MAX_MS) return MIN_AXIS_MAX_MS
	return Math.ceil(maxElapsed / MINUTE_MS) * MINUTE_MS
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

interface BarProps {
	label: string
	colorVar: string
	data: RaceChartPanelData
	axisMaxMs: number
}

function Bar({ label, colorVar, data, axisMaxMs }: BarProps) {
	const widthPct = Math.min((data.elapsedMs / axisMaxMs) * 100, 100)
	const tickerText = data.streaming ? data.text.slice(-70) : null

	return (
		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between text-xs">
				<span style={`color: var(${colorVar});`} class="font-bold uppercase">
					{label}
				</span>
				<span style="color: var(--bpmnkit-fg-muted, #8888a8);" class="font-mono">
					{formatDuration(data.elapsedMs)}
					{data.finished &&
						data.usage &&
						` · ${formatTokenCount(data.usage.inputTokens)} in / ${formatTokenCount(data.usage.outputTokens)} out`}
				</span>
			</div>
			<div
				class="h-8 rounded overflow-hidden"
				style="background: var(--bpmnkit-surface-2, #1e1e2e);"
			>
				<div
					class="h-full rounded transition-[width]"
					style={`width: ${widthPct}%; background: var(${colorVar});`}
				/>
			</div>
			{tickerText && (
				<div class="text-xs truncate font-mono" style="color: var(--bpmnkit-fg-muted, #8888a8);">
					…{tickerText}
				</div>
			)}
		</div>
	)
}

export function RaceChart({ rows }: RaceChartProps) {
	const axisMaxMs = computeAxisMaxMs(rows.map((row) => row.data.elapsedMs))
	const tickCount = Math.round(axisMaxMs / MINUTE_MS)

	return (
		<div class="flex flex-col gap-6 p-8 h-full justify-center">
			{rows.map((row) => (
				<Bar
					key={row.id}
					label={row.label}
					colorVar={row.colorVar}
					data={row.data}
					axisMaxMs={axisMaxMs}
				/>
			))}
			<div
				class="flex justify-between text-xs font-mono"
				style="color: var(--bpmnkit-fg-muted, #8888a8);"
			>
				{Array.from({ length: tickCount + 1 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: axis is static, no reordering
					<span key={i}>{formatDuration(i * MINUTE_MS)}</span>
				))}
			</div>
		</div>
	)
}
