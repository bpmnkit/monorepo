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
			// Exact match only — POST /recordings is the only request this app ever
			// sends to that literal path. Anything under /recordings/* is a static
			// JSON file (e.g. /recordings/<name>.json?import, fetched by Vite's dev
			// server for import.meta.glob) and must NOT be proxied to the backend,
			// which has no GET route for it and would 404.
			"^/recordings$": "http://localhost:3001",
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
})
