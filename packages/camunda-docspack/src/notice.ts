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
		"This package contains documentation from camunda/camunda-docs,",
		"(C) Camunda Services GmbH, licensed under CC BY-SA 3.0:",
		LICENCE_URL,
		"",
		`Source: ${UPSTREAM} @ ${commit}`,
		"Published at: https://docs.camunda.io/docs/next/",
		"",
		"The original work has been modified. Changes:",
		...CHANGES.map((change) => `  - ${change}`),
		"",
		"This adaptation is distributed under CC BY-SA 3.0, as that licence requires.",
		"BPMN Kit is not affiliated with or endorsed by Camunda Services GmbH.",
	].join("\n")}\n`
}
