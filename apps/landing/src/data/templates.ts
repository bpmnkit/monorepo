import { exportSvg } from "@bpmnkit/core"
import {
	ALL_TEMPLATES,
	TEMPLATE_CATEGORIES,
	listJobTypes,
	templateFiles,
} from "@bpmnkit/patterns/templates"
import type {
	ProcessTemplate,
	TemplateCategoryInfo,
	TemplateFile,
	TemplateJobType,
	TemplateScenario,
} from "@bpmnkit/patterns/templates"

/** Everything a gallery page shows about one template, computed once at build time. */
export interface TemplateView {
	template: ProcessTemplate
	category: TemplateCategoryInfo
	/** `exportSvg()` of the built process, retinted to the site palette. */
	svg: string
	jobTypes: TemplateJobType[]
	files: TemplateFile[]
	scenarios: TemplateScenario[]
	/** Site path of a written file, e.g. `/templates/order-to-cash/order-to-cash.bpmn`. */
	fileHref(path: string): string
	bpmnHref: string
	svgHref: string
	editorHref: string
	command: string
}

function categoryOf(template: ProcessTemplate): TemplateCategoryInfo {
	const found = TEMPLATE_CATEGORIES.find((c) => c.id === template.category)
	if (found === undefined)
		throw new Error(`Template ${template.id} has unknown category ${template.category}`)
	return found
}

function toView(template: ProcessTemplate): TemplateView {
	const defs = template.build()
	const base = `/templates/${template.id}`
	const fileHref = (path: string) => `${base}/${path}`
	return {
		template,
		category: categoryOf(template),
		// Same retint as the homepage hero: the exporter's stock light theme,
		// moved onto the page's paper and ink.
		svg: exportSvg(defs)
			.replaceAll("#f8f9fa", "#fbfbfc")
			.replaceAll("#404040", "#14161a")
			.replaceAll("#333333", "#14161a"),
		jobTypes: listJobTypes(defs),
		files: templateFiles(template),
		scenarios: template.scenarios,
		fileHref,
		bpmnHref: fileHref(`${template.id}.bpmn`),
		svgHref: fileHref("diagram.svg"),
		editorHref: `/editor?template=${encodeURIComponent(template.id)}`,
		command: `casen template use ${template.id}`,
	}
}

export const TEMPLATE_VIEWS: TemplateView[] = ALL_TEMPLATES.map(toView)
export { TEMPLATE_CATEGORIES }
