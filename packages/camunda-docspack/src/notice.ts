/**
 * The attribution this package is legally obliged to carry.
 *
 * camunda-docs is licensed CC BY-SA 3.0. Chunking the prose, rendering embedded BPMN as text
 * and rewriting links make this package an *Adaptation* under §1 of that licence rather than a
 * Collection, which obliges it to credit the Original Author, to "clearly label, demarcate or
 * otherwise identify that changes were made", and to license the result under the same terms.
 *
 * It is generated on every build so the commit it names is the one actually adapted.
 */

export const UPSTREAM = "https://github.com/camunda/camunda-docs"
export const LICENCE_URL = "https://creativecommons.org/licenses/by-sa/3.0/"

/** The changes this package makes to the original work, as §4(b) requires them to be stated. */
const CHANGES = [
	"pages split into retrieval chunks",
	"embedded BPMN diagrams rendered as text flow descriptions",
	"MDX components removed or reduced to text, and Markdown partials inlined",
	"relative links rewritten to absolute docs.camunda.io URLs",
	"page descriptions promoted into the body text",
]

export function notice(commit: string): string {
	return `${[
		"This package repackages existing Camunda documentation for offline retrieval by",
		"AI agents. It contains no documentation written by BPMN Kit.",
		"",
		"The documentation content is the work of Camunda Services GmbH. Copyright in it",
		"remains with Camunda Services GmbH; BPMN Kit claims no ownership of it and",
		"asserts no rights over it. BPMN Kit's contribution is the build tooling only.",
		"",
		`Source: ${UPSTREAM} @ ${commit}`,
		"Published at: https://docs.camunda.io/docs/next/",
		`Licensed by Camunda under CC BY-SA 3.0: ${LICENCE_URL}`,
		"",
		"The original work has been modified. Changes:",
		...CHANGES.map((change) => `  - ${change}`),
		"",
		"This adaptation is redistributed under CC BY-SA 3.0, as that licence requires.",
		"Those terms are unchanged: you may share and adapt this content, provided you",
		"credit Camunda, state what you changed, and license your result alike.",
		"",
		"BPMN Kit is not affiliated with, endorsed by, or sponsored by Camunda Services",
		"GmbH. For canonical and current documentation, prefer https://docs.camunda.io.",
	].join("\n")}\n`
}
