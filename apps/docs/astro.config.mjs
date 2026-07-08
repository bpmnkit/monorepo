import starlight from "@astrojs/starlight"
import { organizationJsonLd, softwareApplicationJsonLd } from "@bpmnkit/astro-shared/seo.js"
import { defineConfig } from "astro/config"
import starlightLlmsTxt from "starlight-llms-txt"

const jsonLd = [
	organizationJsonLd(),
	softwareApplicationJsonLd({
		name: "BPMN Kit",
		description:
			"TypeScript SDK for generating, editing, and executing BPMN 2.0 diagrams programmatically.",
		url: "https://docs.bpmnkit.com",
		applicationCategory: "DeveloperApplication",
	}),
]

export default defineConfig({
	site: "https://docs.bpmnkit.com",
	integrations: [
		starlight({
			title: "BPMN Kit",
			logo: { src: "./src/assets/logo.svg", alt: "BPMN Kit" },
			description:
				"TypeScript SDK for generating, editing, and executing BPMN 2.0 diagrams programmatically.",
			favicon: "/favicon.svg",
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/bpmnkit/monorepo" }],
			editLink: {
				baseUrl: "https://github.com/bpmnkit/monorepo/edit/main/apps/docs/src/content/docs/",
			},
			plugins: [
				starlightLlmsTxt({
					projectName: "BPMN Kit",
					description:
						"An open-source TypeScript SDK for generating, editing, and executing BPMN 2.0 " +
						"diagrams programmatically. Designed for AI agents, automation platforms, and " +
						"Camunda 8 / Zeebe workflow deployments. Zero runtime dependencies in the core packages.",
					details:
						"BPMN Kit is a TypeScript monorepo: @bpmnkit/core (fluent builder, parser, " +
						"auto-layout, compact format), @bpmnkit/engine (simulation, no Camunda needed), " +
						"@bpmnkit/api (Camunda 8 REST client, 180 methods), @bpmnkit/canvas (SVG viewer), " +
						"@bpmnkit/editor (full editor with AI bridge), casen (CLI TUI). ESM-only, " +
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
				{
					tag: "meta",
					attrs: {
						property: "og:image",
						content: "https://docs.bpmnkit.com/og.png",
					},
				},
				{
					tag: "meta",
					attrs: { name: "twitter:card", content: "summary_large_image" },
				},
				{
					tag: "meta",
					attrs: {
						name: "twitter:image",
						content: "https://docs.bpmnkit.com/og.png",
					},
				},
				...jsonLd.map((item) => ({
					tag: "script",
					attrs: { type: "application/ld+json" },
					content: JSON.stringify(item),
				})),
			],
		}),
	],
})
