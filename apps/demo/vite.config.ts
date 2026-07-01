import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [preact(), tailwindcss()],
	server: {
		port: 3000,
		proxy: {
			"/stream": "http://localhost:3001",
			"/health": "http://localhost:3001",
			"/prompts": "http://localhost:3001",
			"/recordings": "http://localhost:3001",
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
})
