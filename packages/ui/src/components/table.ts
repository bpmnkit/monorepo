export interface Column<T> {
	label: string
	/** Width hint, e.g. "120px" */
	width?: string
	render(row: T): string | HTMLElement
}

export interface TableOptions<T> {
	columns: Column<T>[]
	onRowClick?: (row: T) => void
	emptyText?: string
}

export function createTable<T>(options: TableOptions<T>): {
	el: HTMLElement
	setRows(rows: T[]): void
} {
	const el = document.createElement("div")
	el.className = "bpmn-table-wrap"

	const header = document.createElement("div")
	header.className = "bpmn-table-header"
	for (const col of options.columns) {
		const th = document.createElement("div")
		th.className = "bpmn-table-th"
		th.textContent = col.label
		if (col.width) th.style.width = col.width
		header.appendChild(th)
	}
	el.appendChild(header)

	const body = document.createElement("div")
	body.className = "bpmn-table-body"
	el.appendChild(body)

	function setRows(rows: T[]): void {
		body.innerHTML = ""
		if (rows.length === 0) {
			const empty = document.createElement("div")
			empty.className = "bpmn-table-empty"
			empty.textContent = options.emptyText ?? "No data"
			body.appendChild(empty)
			return
		}
		for (const row of rows) {
			const tr = document.createElement("div")
			tr.className = "bpmn-table-row"
			if (options.onRowClick) {
				tr.classList.add("bpmn-table-row--clickable")
				tr.addEventListener("click", () => options.onRowClick?.(row))
			}
			for (const col of options.columns) {
				const td = document.createElement("div")
				td.className = "bpmn-table-td"
				if (col.width) td.style.width = col.width
				const content = col.render(row)
				if (typeof content === "string") {
					td.textContent = content
				} else {
					td.appendChild(content)
				}
				tr.appendChild(td)
			}
			body.appendChild(tr)
		}
	}

	return { el, setRows }
}
