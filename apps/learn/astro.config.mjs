import sitemap from "@astrojs/sitemap"
import { defineConfig } from "astro/config"

export default defineConfig({
	site: "https://learn.bpmnkit.com",
	build: { format: "file" },
	devToolbar: { enabled: false },
	integrations: [sitemap()],
})
