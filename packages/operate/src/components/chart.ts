import type { DashboardData } from "../types.js"

// ── Metric definitions ────────────────────────────────────────────────────────

type MetricKey = "activeInstances" | "openIncidents" | "activeJobs" | "pendingTasks"

const METRICS: ReadonlyArray<{ key: MetricKey; label: string; cssVar: string }> = [
	{ key: "activeInstances", label: "Active Instances", cssVar: "--bpmn-accent" },
	{ key: "openIncidents", label: "Open Incidents", cssVar: "--op-c-amber" },
	{ key: "activeJobs", label: "Active Jobs", cssVar: "--op-c-green" },
	{ key: "pendingTasks", label: "Pending Tasks", cssVar: "--op-c-purple" },
]

const MARGIN = { top: 12, right: 16, bottom: 36, left: 36 }
const SVG_NS = "http://www.w3.org/2000/svg"

function niceMax(raw: number): number {
	if (raw <= 0) return 4
	const mag = 10 ** Math.floor(Math.log10(raw))
	const nice = Math.ceil(raw / mag) * mag
	return Math.max(nice, 4)
}

function makeSvgEl(tag: string): SVGElement {
	return document.createElementNS(SVG_NS, tag) as SVGElement
}

// ── Chart factory ─────────────────────────────────────────────────────────────

export function createBarChart(container: HTMLElement): {
	update(data: DashboardData | null): void
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-chart"
	container.appendChild(el)

	const svg = makeSvgEl("svg") as SVGSVGElement
	svg.setAttribute("class", "op-chart-svg")
	svg.setAttribute("aria-hidden", "true")
	el.appendChild(svg as unknown as HTMLElement)

	let lastData: DashboardData | null = null
	let svgWidth = 0
	let svgHeight = 0

	function clearSvg(): void {
		while (svg.firstChild) svg.removeChild(svg.firstChild)
	}

	function draw(data: DashboardData | null): void {
		clearSvg()
		if (svgWidth <= 0 || svgHeight <= 0) return

		if (!data) {
			// Loading dots
			const cx = svgWidth / 2
			const cy = svgHeight / 2
			for (let i = 0; i < 3; i++) {
				const circle = makeSvgEl("circle")
				circle.setAttribute("cx", String(cx + (i - 1) * 16))
				circle.setAttribute("cy", String(cy))
				circle.setAttribute("r", "4")
				circle.setAttribute("class", "op-chart-dot-pulse")
				circle.setAttribute("style", `animation-delay: ${i * 0.2}s`)
				svg.appendChild(circle)
			}
			return
		}

		const plotW = Math.max(1, svgWidth - MARGIN.left - MARGIN.right)
		const plotH = Math.max(1, svgHeight - MARGIN.top - MARGIN.bottom)

		// Y scale
		let yMax = 0
		for (const m of METRICS) {
			const v = data[m.key]
			if (v > yMax) yMax = v
		}
		yMax = niceMax(yMax)

		function toY(v: number): number {
			return MARGIN.top + plotH - (v / yMax) * plotH
		}

		// Y grid + labels
		for (let i = 0; i <= 4; i++) {
			const v = Math.round((i / 4) * yMax)
			const y = toY(v)

			const line = makeSvgEl("line")
			line.setAttribute("x1", String(MARGIN.left))
			line.setAttribute("x2", String(MARGIN.left + plotW))
			line.setAttribute("y1", String(y))
			line.setAttribute("y2", String(y))
			line.setAttribute("class", i === 0 ? "op-chart-axis" : "op-chart-grid")
			svg.appendChild(line)

			const lbl = makeSvgEl("text")
			lbl.setAttribute("x", String(MARGIN.left - 6))
			lbl.setAttribute("y", String(y + 4))
			lbl.setAttribute("text-anchor", "end")
			lbl.setAttribute("class", "op-chart-axis-label")
			lbl.textContent = String(v)
			svg.appendChild(lbl)
		}

		// X axis baseline
		const xBase = makeSvgEl("line")
		xBase.setAttribute("x1", String(MARGIN.left))
		xBase.setAttribute("x2", String(MARGIN.left + plotW))
		xBase.setAttribute("y1", String(MARGIN.top + plotH))
		xBase.setAttribute("y2", String(MARGIN.top + plotH))
		xBase.setAttribute("class", "op-chart-axis")
		svg.appendChild(xBase)

		// Bars — one per metric, evenly spaced
		const n = METRICS.length
		const groupGap = Math.max(8, plotW * 0.06)
		const barW = Math.max(1, (plotW - groupGap * (n + 1)) / n)

		for (let i = 0; i < METRICS.length; i++) {
			const m = METRICS[i]
			if (!m) continue
			const v = data[m.key]
			const barH = (v / yMax) * plotH
			const x = MARGIN.left + groupGap * (i + 1) + barW * i
			const y = MARGIN.top + plotH - barH

			const rect = makeSvgEl("rect")
			rect.setAttribute("x", String(x))
			rect.setAttribute("y", String(y))
			rect.setAttribute("width", String(barW))
			rect.setAttribute("height", String(Math.max(1, barH)))
			rect.setAttribute("fill", `var(${m.cssVar})`)
			rect.setAttribute("opacity", "0.85")
			rect.setAttribute("rx", "2")
			svg.appendChild(rect)

			// Value label above bar
			if (barH > 0) {
				const valLbl = makeSvgEl("text")
				valLbl.setAttribute("x", String(x + barW / 2))
				valLbl.setAttribute("y", String(Math.max(MARGIN.top + 10, y - 4)))
				valLbl.setAttribute("text-anchor", "middle")
				valLbl.setAttribute("class", "op-chart-axis-label")
				valLbl.textContent = String(v)
				svg.appendChild(valLbl)
			}

			// X label below bar
			const xLbl = makeSvgEl("text")
			xLbl.setAttribute("x", String(x + barW / 2))
			xLbl.setAttribute("y", String(MARGIN.top + plotH + 20))
			xLbl.setAttribute("text-anchor", "middle")
			xLbl.setAttribute("class", "op-chart-axis-label")
			// Abbreviate for space
			const short = m.label.replace("Active ", "").replace("Open ", "").replace("Pending ", "")
			xLbl.textContent = short
			svg.appendChild(xLbl)
		}
	}

	function drawLast(): void {
		draw(lastData)
	}

	const ro = new ResizeObserver((entries) => {
		const entry = entries[0]
		if (!entry) return
		svgWidth = Math.floor(entry.contentRect.width)
		svgHeight = Math.floor(entry.contentRect.height)
		svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
		drawLast()
	})
	ro.observe(svg as unknown as Element)

	return {
		update(data: DashboardData | null): void {
			lastData = data
			draw(data)
		},
		destroy(): void {
			ro.disconnect()
			el.remove()
		},
	}
}
