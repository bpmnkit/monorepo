import sitemap from "@astrojs/sitemap"
import { defineConfig } from "astro/config"
import { inkTheme } from "./shiki-theme.mjs"

export default defineConfig({
	site: "https://bpmnkit.com",
	build: {
		format: "file",
	},
	devToolbar: {
		enabled: false,
	},
	markdown: {
		shikiConfig: { theme: inkTheme },
	},
	integrations: [sitemap()],
})
