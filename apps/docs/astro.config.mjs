import starlight from "@astrojs/starlight"
import { defineConfig } from "astro/config"
import starlightLlmsTxt from "starlight-llms-txt"

export default defineConfig({
	site: "https://bpmn-sdk-docs.pages.dev",
	integrations: [
		starlight({
			title: "BPMN SDK",
			description:
				"TypeScript SDK for generating, editing, and executing BPMN 2.0 diagrams programmatically.",
			favicon: "/favicon.svg",
			social: {
				github: "https://github.com/bpmn-sdk/monorepo",
			},
			editLink: {
				baseUrl: "https://github.com/bpmn-sdk/monorepo/edit/main/apps/docs/src/content/docs/",
			},
			plugins: [
				starlightLlmsTxt({
					projectName: "BPMN SDK",
					description:
						"An open-source TypeScript SDK for generating, editing, and executing BPMN 2.0 " +
						"diagrams programmatically. Designed for AI agents, automation platforms, and " +
						"Camunda 8 / Zeebe workflow deployments. Zero runtime dependencies in the core packages.",
					details:
						"BPMN SDK is a TypeScript monorepo: @bpmn-sdk/core (fluent builder, parser, " +
						"auto-layout, compact format), @bpmn-sdk/engine (simulation, no Camunda needed), " +
						"@bpmn-sdk/api (Camunda 8 REST client, 180 methods), @bpmn-sdk/canvas (SVG viewer), " +
						"@bpmn-sdk/editor (full editor with AI bridge), casen (CLI TUI). ESM-only, " +
						"strict TypeScript, runs in browsers/Node.js/Deno/Bun/edge.",
					promote: ["index*", "getting-started/quick-start*"],
				}),
			],
			components: {
				Hero: "./src/components/Hero.astro",
			},
			expressiveCode: {
				themes: ["one-dark-pro", "github-light"],
				styleOverrides: {
					borderRadius: "8px",
				},
			},
			sidebar: [
				{
					label: "Getting Started",
					autogenerate: { directory: "getting-started" },
				},
				{
					label: "Guides",
					autogenerate: { directory: "guides" },
				},
				{
					label: "Packages",
					autogenerate: { directory: "packages" },
				},
				{
					label: "CLI",
					autogenerate: { directory: "cli" },
				},
			],
			customCss: ["./src/styles/custom.css"],
			head: [
				{
					tag: "link",
					attrs: {
						rel: "icon",
						href: "/favicon.svg",
						type: "image/svg+xml",
					},
				},
			],
		}),
	],
})
