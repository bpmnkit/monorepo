import { Form } from "@bpmn-sdk/core"
import type { FormComponent, FormUnknownComponent } from "@bpmn-sdk/core"

// FormUnknownComponent's `[key: string]: unknown` index signature prevents TypeScript from
// narrowing properties inside switch cases. Exclude it so the switch can narrow correctly;
// the default branch still handles unknown types at runtime.
type KnownFormComponent = Exclude<FormComponent, FormUnknownComponent>
import type { RenderOptions } from "./types.js"

// ── Width ────────────────────────────────────────────────────────────────────

const WIDTH = 48 // inner content width (chars)

function hline(ch = "─"): string {
	return ch.repeat(WIDTH)
}

function required(req: boolean | undefined): string {
	return req ? " *" : ""
}

// ── Component renderers ───────────────────────────────────────────────────────

function renderComponent(c: FormComponent, depth = 0): string[] {
	const indent = "  ".repeat(depth)
	const lines: string[] = []
	const k = c as KnownFormComponent

	switch (k.type) {
		case "text": {
			// Render each line of the text content, prefixed with indent
			for (const line of k.text.split("\n")) {
				lines.push(indent + line)
			}
			break
		}

		case "textfield":
		case "textarea": {
			const lbl = k.label + required(k.validate?.required)
			const inputBox =
				k.type === "textarea"
					? "┌──────────────────────┐\n│                      │\n│                      │\n└──────────────────────┘"
					: "[ ______________________ ]"
			lines.push(indent + lbl)
			for (const l of inputBox.split("\n")) lines.push(indent + l)
			break
		}

		case "number": {
			const lbl = k.label + required(k.validate?.required)
			lines.push(indent + lbl)
			lines.push(`${indent}[ 0 ▲▼ ]`)
			break
		}

		case "datetime": {
			const lbl = k.dateLabel ?? k.timeLabel ?? "Date/Time"
			lines.push(indent + lbl + required(k.validate?.required))
			lines.push(`${indent}[ YYYY-MM-DD ]  [ HH:MM ]`)
			break
		}

		case "select": {
			const lbl = k.label + required(k.validate?.required)
			lines.push(indent + lbl)
			lines.push(`${indent}[ ▼ Select...            ]`)
			break
		}

		case "taglist": {
			const lbl = k.label + required(k.validate?.required)
			lines.push(indent + lbl)
			lines.push(`${indent}[ × Tag1  × Tag2  +Add  ]`)
			break
		}

		case "radio": {
			const lbl = k.label + required(k.validate?.required)
			lines.push(indent + lbl)
			if (k.values) {
				for (const opt of k.values) {
					lines.push(`${indent}  ○ ${opt.label}`)
				}
			} else {
				lines.push(`${indent}  ○ (dynamic options)`)
			}
			break
		}

		case "checkbox": {
			const req = k.validate?.required
			lines.push(`${indent}☐  ${k.label}${required(req)}`)
			break
		}

		case "checklist": {
			const lbl = k.label + required(k.validate?.required)
			lines.push(indent + lbl)
			if (k.values) {
				for (const opt of k.values) {
					lines.push(`${indent}  ☐  ${opt.label}`)
				}
			} else {
				lines.push(`${indent}  ☐  (dynamic options)`)
			}
			break
		}

		case "button": {
			const label = k.label
			const inner = `  ${label}  `
			lines.push(`${indent}[${inner}]`)
			break
		}

		case "separator": {
			lines.push(indent + hline())
			break
		}

		case "spacer": {
			lines.push("")
			break
		}

		case "group": {
			const top = `┌─ ${k.label} ${"─".repeat(Math.max(0, WIDTH - k.label.length - 4))}┐`
			lines.push(indent + top)
			for (const child of k.components) {
				for (const l of renderComponent(child, depth + 1)) {
					lines.push(l)
				}
			}
			lines.push(`${indent}└${"─".repeat(WIDTH - 1)}┘`)
			break
		}

		case "dynamiclist": {
			const label = k.label ?? "List"
			const top = `┌─ ${label} ${"─".repeat(Math.max(0, WIDTH - label.length - 4))}┐`
			lines.push(indent + top)
			for (const child of k.components) {
				for (const l of renderComponent(child, depth + 1)) {
					lines.push(l)
				}
			}
			lines.push(`${indent}└${"─".repeat(WIDTH - 1)}┘`)
			lines.push(`${indent}  [+ Add item]`)
			break
		}

		case "table": {
			const cols = k.columns ?? []
			if (cols.length === 0) {
				lines.push(`${indent}[ Table: ${k.label ?? "(no label)"} ]`)
			} else {
				const colW = Math.max(8, Math.floor((WIDTH - cols.length - 1) / cols.length))
				const bar = cols.map(() => "─".repeat(colW))
				lines.push(indent + (k.label ? k.label : "Table"))
				lines.push(`${indent}┌${bar.join("┬")}┐`)
				lines.push(
					`${indent}│${cols.map((col) => col.label.slice(0, colW).padEnd(colW)).join("│")}│`,
				)
				lines.push(`${indent}├${bar.join("┼")}┤`)
				lines.push(`${indent}│${bar.map(() => " ".repeat(colW)).join("│")}│`)
				lines.push(`${indent}└${bar.join("┴")}┘`)
			}
			break
		}

		case "image": {
			lines.push(`${indent}[ 🖼  ${k.alt ?? "Image"} ]`)
			break
		}

		case "iframe": {
			lines.push(`${indent}[ iframe: ${k.url ?? "(url)"} ]`)
			break
		}

		case "html": {
			lines.push(`${indent}[ HTML content ]`)
			break
		}

		case "expression": {
			lines.push(`${indent}[ expr: ${k.expression ?? ""} ]`)
			break
		}

		case "filepicker": {
			const lbl = k.label ?? "File"
			lines.push(indent + lbl + required(undefined))
			lines.push(`${indent}[ 📎 Choose file... ]`)
			break
		}

		case "documentPreview": {
			lines.push(`${indent}[ 📄 ${k.label ?? "Document"} ]`)
			break
		}

		default: {
			lines.push(`${indent}[ ${c.type} ]`)
			break
		}
	}

	return lines
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a Camunda Form JSON string as ASCII art.
 *
 * Each form component is drawn in document order as a text mock-up,
 * showing labels, input placeholders, options, and buttons.
 */
export function renderFormAscii(json: string, options?: RenderOptions): string {
	const form = Form.parse(json)

	const lines: string[] = []
	for (const comp of form.components) {
		const compLines = renderComponent(comp)
		lines.push(...compLines)
		lines.push("") // blank line between top-level components
	}

	// Remove trailing blank line
	while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()

	const body = lines.join("\n")

	const title = resolveTitle(options, form.id)
	if (!title) return body

	const line = "─".repeat(title.length)
	return `${title}\n${line}\n\n${body}`
}

function resolveTitle(
	options: RenderOptions | undefined,
	formId: string | undefined,
): string | undefined {
	if (options?.title === false) return undefined
	if (typeof options?.title === "string") return options.title
	return formId ?? undefined
}
