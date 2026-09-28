/**
 * `/editor?template=<id>` opens a gallery template. The id only ever selects a
 * same-origin file the site built (`/templates/<id>/<id>.bpmn`): anything that
 * is not a plain slug is refused, so the parameter cannot point the editor at
 * another path or origin.
 */
const TEMPLATE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The BPMN file for a `?template=` value, or null when the value is not a template slug. */
export function templateBpmnPath(id: string): string | null {
	return TEMPLATE_ID.test(id) ? `/templates/${id}/${id}.bpmn` : null
}
