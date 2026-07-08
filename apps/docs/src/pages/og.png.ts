import { Resvg } from "@resvg/resvg-js"
import type { APIRoute } from "astro"
import logoSvg from "../assets/logo.svg?raw"

const logoB64 = btoa(logoSvg)
const logoUri = `data:image/svg+xml;base64,${logoB64}`

function ogSvg(title: string, subtitle: string): string {
	return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6b9df7"/>
      <stop offset="100%" stop-color="#2dd4bf"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0d0d16"/>
  <rect x="0" y="0" width="8" height="630" fill="url(#bar)"/>
  <image href="${logoUri}" x="80" y="70" width="120" height="120"/>
  <text x="80" y="334" font-family="system-ui,-apple-system,sans-serif" font-size="72" font-weight="700" fill="#cdd6f4">${title}</text>
  <text x="80" y="394" font-family="system-ui,-apple-system,sans-serif" font-size="30" fill="#6b9df7">${subtitle}</text>
  <text x="80" y="568" font-family="system-ui,-apple-system,sans-serif" font-size="22" fill="#8888a8">docs.bpmnkit.com</text>
</svg>`
}

export const GET: APIRoute = () => {
	const svg = ogSvg("BPMN Kit Docs", "API Reference &amp; Developer Guides")
	const resvg = new Resvg(svg, { font: { loadSystemFonts: true } })
	const rendered = resvg.render()
	const png = rendered.asPng()
	return new Response(png.buffer as ArrayBuffer, {
		headers: { "Content-Type": "image/png" },
	})
}
