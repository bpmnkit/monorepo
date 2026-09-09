/**
 * The FEEL playground, as a panel of its own.
 *
 * The panel is `buildFeelPlaygroundPanel()` from `@bpmnkit/plugins`, unchanged —
 * the same evaluator, the same examples, the same syntax highlighting the studio
 * has. What the editor adds is where the expression comes from: select one in a
 * `.bpmn` file and it opens already filled in, which is the difference between
 * a playground and a debugger.
 */

import { buildFeelPlaygroundPanel } from "@bpmnkit/plugins/feel-playground"
import { injectUiStyles } from "@bpmnkit/ui"
import { applyTheme, onHostMessage, ready } from "./vscode-api.js"

injectUiStyles()

const root = document.getElementById("root") as HTMLDivElement

onHostMessage((message) => {
	if (message.type === "feel") {
		applyTheme(message.theme)
		// The panel reads its seed once, at construction, so a new expression
		// means a new panel rather than a mutation nobody can see happening.
		root.replaceChildren(buildFeelPlaygroundPanel(undefined, message.expression))
	} else if (message.type === "theme") {
		applyTheme(message.theme)
	}
})

ready()
