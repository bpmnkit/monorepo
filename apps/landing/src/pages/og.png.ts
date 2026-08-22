import { Resvg } from "@resvg/resvg-js"
import type { APIRoute } from "astro"
import logoSvg from "../assets/logo.svg?raw"

const logoB64 = btoa(logoSvg)
const logoUri = `data:image/svg+xml;base64,${logoB64}`

function ogSvg(title: string, subtitle: string): string {
	return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#f4f5f7"/>
  <rect x="0" y="0" width="8" height="630" fill="#a8503a"/>
  <image href="${logoUri}" x="80" y="70" width="120" height="120"/>
  <text x="80" y="334" font-family="system-ui,-apple-system,sans-serif" font-size="72" font-weight="600" fill="#14161a">${title}</text>
  <text x="80" y="394" font-family="system-ui,-apple-system,sans-serif" font-size="30" fill="#a8503a">${subtitle}</text>
  <line x1="80" y1="520" x2="1120" y2="520" stroke="#dcdfe4" stroke-width="1"/>
  <text x="80" y="568" font-family="monospace" font-size="22" fill="#7a828e">bpmnkit.com</text>
</svg>`
}

export const GET: APIRoute = () => {
	const svg = ogSvg("BPMN Kit", "TypeScript SDK for BPMN 2.0")
	const resvg = new Resvg(svg, { font: { loadSystemFonts: true } })
	const rendered = resvg.render()
	const png = rendered.asPng()
	return new Response(png.buffer as ArrayBuffer, {
		headers: { "Content-Type": "image/png" },
	})
}
