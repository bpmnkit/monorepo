import sitemap from "@astrojs/sitemap"
import { remarkBpmn } from "@bpmnkit/markdown"
import { defineConfig } from "astro/config"
import { inkTheme } from "./shiki-theme.mjs"

// In production `bpmnkit.com/drop*` is carved out to the Drop Worker, so the
// editor's "Share as a drop" upload is same-origin. Proxy the same prefix in dev
// to a local `wrangler dev`, which keeps it same-origin there too — no CORS, and
// nothing to change in the Worker. Only the dev server reads this; the static
// build is unaffected.
const DROP_DEV_ORIGIN = process.env.DROP_DEV_ORIGIN ?? "http://localhost:8787"

export default defineConfig({
	site: "https://bpmnkit.com",
	vite: {
		server: {
			proxy: {
				"/drop": { target: DROP_DEV_ORIGIN, changeOrigin: true },
			},
		},
	},
	build: {
		format: "file",
	},
	devToolbar: {
		enabled: false,
	},
	markdown: {
		shikiConfig: { theme: inkTheme },
		// ```bpmn / ```bpmn-compact fences in docs and blog posts render as inline SVG diagrams
		remarkPlugins: [[remarkBpmn, { maxWidth: 760 }]],
	},
	integrations: [sitemap()],
})
