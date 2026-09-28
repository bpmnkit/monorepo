import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
		// Each test spawns the scaffolder, and one runs tsc on its output.
		testTimeout: 30_000,
		hookTimeout: 60_000,
	},
})
