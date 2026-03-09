import type { APIRoute } from "astro"
import { CODE, FEATURES, PACKAGES, SITE } from "../data/content"

const packageList = PACKAGES.map((p) => `- [${p.name}](${p.url}): ${p.description}`).join("\n")
const featureList = FEATURES.map((f) => `- ${f}`).join("\n")

const content = `\
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

## Links

- [Live Editor](${SITE.url}/editor): Visual BPMN editor with AI-assisted editing and process simulation
- [GitHub](${SITE.github}): Source code, issues, and contribution guide
- [npm](${SITE.npm}): Package registry

## Optional

- [Full content (llms-full.txt)](${SITE.url}/llms-full.txt): All landing page content with extended code examples
`

export const GET: APIRoute = () =>
	new Response(content, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	})
