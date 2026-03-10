import { defineConfig } from "astro/config"

export default defineConfig({
	build: {
		format: "file",
	},
	devToolbar: {
		enabled: false,
	},
})
