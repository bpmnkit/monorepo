import { BpmnCanvas } from "@bpmnkit/canvas"
import { FileText } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"

interface DiagramPreviewProps {
	xml: string
	width: number
	height: number
	className?: string
}

export function DiagramPreview({ xml, width, height, className }: DiagramPreviewProps) {
	const [svgUrl, setSvgUrl] = useState<string | null>(null)
	const [error, setError] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const observerRef = useRef<IntersectionObserver | null>(null)
	const canvasRef = useRef<BpmnCanvas | null>(null)
	const blobUrlRef = useRef<string | null>(null)
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		const el = containerRef.current
		if (!el) return

		observerRef.current = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setVisible(true)
					observerRef.current?.disconnect()
				}
			},
			{ rootMargin: "100px" },
		)
		observerRef.current.observe(el)

		return () => {
			observerRef.current?.disconnect()
		}
	}, [])

	useEffect(() => {
		if (!visible || !xml) return

		const offscreen = document.createElement("div")
		offscreen.style.cssText =
			"position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;pointer-events:none;"
		document.body.appendChild(offscreen)

		const canvas = new BpmnCanvas({
			container: offscreen,
			theme: "dark",
			grid: false,
			fit: "contain",
		})
		canvasRef.current = canvas

		try {
			canvas.load(xml)
			// Extract SVG from the canvas element
			const svg = offscreen.querySelector("svg")
			if (!svg) {
				setError(true)
			} else {
				const clone = svg.cloneNode(true) as SVGElement
				clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
				const serializer = new XMLSerializer()
				const svgString = serializer.serializeToString(clone)
				const blob = new Blob([svgString], { type: "image/svg+xml" })
				const url = URL.createObjectURL(blob)
				blobUrlRef.current = url
				setSvgUrl(url)
			}
		} catch {
			setError(true)
		}

		canvas.destroy()
		canvasRef.current = null
		document.body.removeChild(offscreen)

		return () => {
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current)
				blobUrlRef.current = null
			}
		}
	}, [visible, xml])

	return (
		<div ref={containerRef} style={{ width, height }} className={className}>
			{error ? (
				<div
					className="flex h-full w-full items-center justify-center bg-canvas text-muted"
					aria-label="Preview unavailable"
				>
					<FileText size={24} />
				</div>
			) : svgUrl ? (
				<img
					src={svgUrl}
					alt="Diagram preview"
					width={width}
					height={height}
					className="h-full w-full object-contain"
				/>
			) : (
				<div className="h-full w-full animate-pulse bg-surface-2" />
			)}
		</div>
	)
}
