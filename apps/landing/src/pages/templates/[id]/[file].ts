import type { APIRoute, GetStaticPaths } from "astro"
import { TEMPLATE_VIEWS } from "../../../data/templates"

// Each template's files — the .bpmn, its scenarios, DMN and forms — plus the
// rendered diagram, served as static files next to the template's page. The
// editor's `?template=` hand-off and the download buttons both read these.

const TYPES: Record<string, string> = {
	".bpmn": "application/xml; charset=utf-8",
	".dmn": "application/xml; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".form": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
}

export const getStaticPaths = (() =>
	TEMPLATE_VIEWS.flatMap((view) => [
		...view.files.map((file) => ({
			params: { id: view.template.id, file: file.path },
			props: { content: file.content },
		})),
		{ params: { id: view.template.id, file: "diagram.svg" }, props: { content: view.svg } },
	])) satisfies GetStaticPaths

export const GET: APIRoute = ({ params, props }) => {
	const file = params.file ?? ""
	const type = Object.entries(TYPES).find(([ext]) => file.endsWith(ext))?.[1] ?? "text/plain"
	return new Response((props as { content: string }).content, { headers: { "Content-Type": type } })
}
