export interface FilterColumn<T> {
	label: string
	width?: string
	render(row: T): string | HTMLElement
	/** If provided, column header becomes clickable for sort */
	sortValue?: (row: T) => string | number | null | undefined
}

export function createFilterTable<T>(options: {
	columns: FilterColumn<T>[]
	/** Function returning searchable text for a row */
	searchFn?: (row: T) => string
	onRowClick?: (row: T) => void
	emptyText?: string
	/** Initial page size (default: 10) */
	pageSize?: number
}): {
	el: HTMLElement
	/**
	 * Replace the rows. Resets to the first page unless `keepPage` is set —
	 * polling views pass it so a refresh does not throw the user back to page 1.
	 */
	setRows(rows: T[], keepPage?: boolean): void
} {
	let allRows: T[] = []
	let searchQuery = ""
	let sortState: { col: number; dir: "asc" | "desc" } | null = null
	let currentPage = 0
	let pageSize = options.pageSize ?? 10

	const el = document.createElement("div")
	el.className = "op-filter-table"

	// Toolbar row: search input + count
	const toolbar = document.createElement("div")
	toolbar.className = "op-toolbar"

	const searchInput = document.createElement("input")
	searchInput.type = "text"
	searchInput.className = "op-search"
	searchInput.placeholder = "Search…"
	toolbar.appendChild(searchInput)

	const countEl = document.createElement("span")
	countEl.className = "op-search-count"
	toolbar.appendChild(countEl)
	el.appendChild(toolbar)

	// Table wrap
	const tableWrap = document.createElement("div")
	tableWrap.className = "bpmnkit-table-wrap"
	el.appendChild(tableWrap)

	// Header with sort support
	const headerEl = document.createElement("div")
	headerEl.className = "bpmnkit-table-header"
	const headerCells: HTMLElement[] = []

	for (let i = 0; i < options.columns.length; i++) {
		const col = options.columns[i]
		if (!col) continue
		const th = document.createElement("div")
		th.className = "bpmnkit-table-th"
		if (col.width) th.style.width = col.width

		if (col.sortValue) {
			th.classList.add("op-th-sort")
			const labelSpan = document.createElement("span")
			labelSpan.textContent = col.label
			th.appendChild(labelSpan)
			const icon = document.createElement("span")
			icon.className = "op-sort-icon"
			icon.textContent = "↕"
			th.appendChild(icon)
			const idx = i
			th.addEventListener("click", () => {
				if (sortState?.col === idx) {
					sortState = sortState.dir === "asc" ? { col: idx, dir: "desc" } : null
				} else {
					sortState = { col: idx, dir: "asc" }
				}
				currentPage = 0
				updateSortIcons()
				renderRows()
			})
		} else {
			th.textContent = col.label
		}
		headerCells.push(th)
		headerEl.appendChild(th)
	}
	tableWrap.appendChild(headerEl)

	const bodyEl = document.createElement("div")
	bodyEl.className = "bpmnkit-table-body"
	tableWrap.appendChild(bodyEl)

	// Pagination bar (outside scroll area, always visible)
	const paginationEl = document.createElement("div")
	paginationEl.className = "op-pagination"
	el.appendChild(paginationEl)

	function updateSortIcons(): void {
		for (let i = 0; i < headerCells.length; i++) {
			const icon = headerCells[i]?.querySelector(".op-sort-icon")
			if (!icon) continue
			if (sortState?.col === i) {
				icon.textContent = sortState.dir === "asc" ? "↑" : "↓"
				icon.classList.add("op-sort-icon--active")
			} else {
				icon.textContent = "↕"
				icon.classList.remove("op-sort-icon--active")
			}
		}
	}

	function applyFilterSort(): T[] {
		let rows = allRows
		if (searchQuery && options.searchFn) {
			const q = searchQuery.toLowerCase()
			rows = rows.filter((row) => options.searchFn?.(row).toLowerCase().includes(q))
		}
		if (sortState !== null) {
			const st = sortState
			const col = options.columns[st.col]
			if (col?.sortValue) {
				const dir = st.dir === "asc" ? 1 : -1
				rows = [...rows].sort((a, b) => {
					const av = col.sortValue?.(a) ?? ""
					const bv = col.sortValue?.(b) ?? ""
					if (av < bv) return -1 * dir
					if (av > bv) return 1 * dir
					return 0
				})
			}
		}
		return rows
	}

	function renderPagination(total: number, start: number, end: number, totalPages: number): void {
		paginationEl.innerHTML = ""

		const sizeLabel = document.createElement("span")
		sizeLabel.textContent = "Rows:"
		paginationEl.appendChild(sizeLabel)

		const sizeSelect = document.createElement("select")
		sizeSelect.className = "op-page-size"
		for (const sz of [10, 25, 50, 100]) {
			const opt = document.createElement("option")
			opt.value = String(sz)
			opt.textContent = String(sz)
			if (sz === pageSize) opt.selected = true
			sizeSelect.appendChild(opt)
		}
		sizeSelect.addEventListener("change", () => {
			pageSize = Number(sizeSelect.value)
			currentPage = 0
			renderRows()
		})
		paginationEl.appendChild(sizeSelect)

		const prevBtn = document.createElement("button")
		prevBtn.className = "op-pagination-btn"
		prevBtn.textContent = "‹"
		prevBtn.disabled = currentPage === 0
		prevBtn.addEventListener("click", () => {
			currentPage--
			renderRows()
		})
		paginationEl.appendChild(prevBtn)

		const infoEl = document.createElement("span")
		infoEl.className = "op-pagination-info"
		infoEl.textContent = total > 0 ? `${start + 1}–${end} of ${total}` : "0 results"
		paginationEl.appendChild(infoEl)

		const nextBtn = document.createElement("button")
		nextBtn.className = "op-pagination-btn"
		nextBtn.textContent = "›"
		nextBtn.disabled = currentPage >= totalPages - 1
		nextBtn.addEventListener("click", () => {
			currentPage++
			renderRows()
		})
		paginationEl.appendChild(nextBtn)
	}

	function renderRows(): void {
		const filtered = applyFilterSort()
		const total = filtered.length
		const totalPages = Math.max(1, Math.ceil(total / pageSize))
		if (currentPage >= totalPages) currentPage = totalPages - 1
		const start = currentPage * pageSize
		const pageRows = filtered.slice(start, start + pageSize)
		const end = start + pageRows.length

		countEl.textContent =
			filtered.length !== allRows.length
				? `${filtered.length} / ${allRows.length}`
				: String(allRows.length)

		bodyEl.innerHTML = ""
		if (total === 0) {
			const empty = document.createElement("div")
			empty.className = "bpmnkit-table-empty"
			empty.textContent = searchQuery ? "No results" : (options.emptyText ?? "No data")
			bodyEl.appendChild(empty)
			renderPagination(0, 0, 0, 1)
			return
		}
		for (const row of pageRows) {
			const tr = document.createElement("div")
			tr.className = "bpmnkit-table-row"
			if (options.onRowClick) {
				tr.classList.add("bpmnkit-table-row--clickable")
				tr.addEventListener("click", () => options.onRowClick?.(row))
			}
			for (const col of options.columns) {
				const td = document.createElement("div")
				td.className = "bpmnkit-table-td"
				if (col.width) td.style.width = col.width
				const content = col.render(row)
				if (typeof content === "string") td.textContent = content
				else td.appendChild(content)
				tr.appendChild(td)
			}
			bodyEl.appendChild(tr)
		}
		renderPagination(total, start, end, totalPages)
	}

	searchInput.addEventListener("input", () => {
		searchQuery = searchInput.value
		currentPage = 0
		renderRows()
	})

	return {
		el,
		setRows(rows: T[], keepPage = false): void {
			allRows = rows
			// renderRows() clamps a kept page if the new data has fewer pages.
			if (!keepPage) currentPage = 0
			renderRows()
		},
	}
}
