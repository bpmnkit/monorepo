import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [preact(), tailwindcss()],
	server: { port: 5174 },
	build: {
		outDir: "dist",
		emptyOutDir: true,
		chunkSizeWarningLimit: 600,
		rolldownOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("/preact") || id.includes("/preact/")) return "vendor-preact"
					if (id.includes("/@tanstack/react-query")) return "vendor-query"
					if (id.includes("/@radix-ui/")) return "vendor-ui"
					if (id.includes("/@bpmnkit/core")) return "vendor-bpmnkit-core"
				},
			},
		},
	},
})
