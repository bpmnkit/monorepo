import type { APIRoute } from "astro"
import { CODE, FEATURES, PACKAGES, SITE } from "../data/content"
import { getDocsNav } from "../data/docs-nav"

const packageList = PACKAGES.map((p) => `- [${p.name}](${p.url}): ${p.description}`).join("\n")

/** Every documentation page, in sidebar order. */
async function documentationList(): Promise<string> {
	const nav = await getDocsNav()
	return nav
		.map((section) => {
			const pages = section.items
				.map((item) => `- [${item.title}](${SITE.url}${item.href}): ${item.description}`)
				.join("\n")
			return `### ${section.label}\n\n${pages}`
		})
		.join("\n\n")
}

const featureList = FEATURES.map((f) => `- ${f}`).join("\n")

async function build(): Promise<string> {
	return `\
# ${SITE.name}

> ${SITE.description}

## Packages

${packageList}

## Key Features

${featureList}

## Quick Start

\`\`\`typescript
${CODE.createProcess}
\`\`\`

## Documentation

${await documentationList()}

## Links

- [Live Editor](${SITE.url}/editor): Visual BPMN editor with AI-assisted editing and process simulation
- [GitHub](${SITE.github}): Source code, issues, and contribution guide
- [npm](${SITE.npm}): Package registry

## Optional

- [Full content (llms-full.txt)](${SITE.url}/llms-full.txt): All site and documentation content with extended code examples
`
}

export const GET: APIRoute = async () =>
	new Response(await build(), {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	})
