import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { type Plugin, defineConfig } from "vite"

// `@preact/signals-react/runtime` (pulled in by cascivo) does default imports —
// `import v from "react/jsx-runtime"` / `import m from "react/jsx-dev-runtime"` —
// but those bindings are unused, and under the preact alias the targets have no
// default export, so the production bundle fails with MISSING_EXPORT. Rewrite
// the dead default imports to side-effect imports so they resolve.
function fixSignalsReactJsxImport(): Plugin {
	return {
		name: "fix-signals-react-jsx-import",
		enforce: "pre",
		transform(code, id) {
			if (!id.includes("@preact/signals-react") || !id.includes("runtime")) return null
			const fixed = code.replace(
				/import\s+\w+\s+from\s*("react\/jsx-(?:dev-)?runtime")/g,
				"import $1",
			)
			return fixed === code ? null : { code: fixed, map: null }
		},
	}
}

export default defineConfig({
	plugins: [fixSignalsReactJsxImport(), preact(), tailwindcss()],
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
