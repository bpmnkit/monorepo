/**
 * Sparse row/column grid used by the grid layout engine.
 * Port of bpmn-io bpmn-auto-layout's Grid (lib/Grid.js) with two fixes:
 * an explicit optional position (upstream conflated [0,0] with "no
 * position") and a working row-splice guard.
 */
export class Grid<T> {
	private grid: Array<Array<T | undefined>> = []

	/** Without a position, start a new bottom row; with one, place exactly there. */
	add(element: T, position?: [number, number]): void {
		if (!position) {
			this.grid.push([element])
			return
		}
		const [row, col] = position
		while (this.grid.length <= row) this.grid.push([])
		const gridRow = this.grid[row] as Array<T | undefined>
		if (gridRow[col] !== undefined) {
			throw new Error(`Grid cell (${row},${col}) is already occupied`)
		}
		gridRow[col] = element
	}

	createRow(afterIndex?: number): void {
		if (afterIndex === undefined) {
			this.grid.push([])
			return
		}
		this.grid.splice(afterIndex + 1, 0, [])
	}

	createCol(afterIndex: number, count: number): void {
		for (const row of this.grid) {
			if (row.length > afterIndex) {
				row.splice(afterIndex + 1, 0, ...new Array<T | undefined>(count).fill(undefined))
			}
		}
	}

	addAfter(element: T, newElement: T): void {
		const [row, col] = this.find(element)
		if (row < 0) {
			this.add(newElement)
			return
		}
		this.grid[row]?.splice(col + 1, 0, newElement)
	}

	addBelow(element: T, newElement: T): void {
		const [row, col] = this.find(element)
		if (row < 0) {
			this.add(newElement)
			return
		}
		while (this.grid.length <= row + 1) this.grid.push([])
		const below = this.grid[row + 1] as Array<T | undefined>
		if (below[col] !== undefined) {
			this.grid.splice(row + 1, 0, [])
		}
		this.add(newElement, [row + 1, col])
	}

	find(element: T): [number, number] {
		for (let r = 0; r < this.grid.length; r++) {
			const row = this.grid[r]
			if (!row) continue
			for (let c = 0; c < row.length; c++) {
				if (row[c] === element) return [r, c]
			}
		}
		return [-1, -1]
	}

	get(row: number, col: number): T | undefined {
		return this.grid[row]?.[col]
	}

	getElementsInRange(from: { row: number; col: number }, to: { row: number; col: number }): T[] {
		const r1 = Math.min(from.row, to.row)
		const r2 = Math.max(from.row, to.row)
		const c1 = Math.min(from.col, to.col)
		const c2 = Math.max(from.col, to.col)
		const out: T[] = []
		for (let r = r1; r <= r2; r++) {
			for (let c = c1; c <= c2; c++) {
				const el = this.get(r, c)
				if (el !== undefined) out.push(el)
			}
		}
		return out
	}

	/**
	 * Move an element to the current last column of the grid (right-align
	 * before a fan-out). No-op when that cell is occupied — upstream would
	 * overwrite; we keep the no-overwrite invariant.
	 */
	adjustGridPosition(element: T): void {
		const [row, col] = this.find(element)
		if (row < 0) return
		const maxCol = this.colCount() - 1
		if (col < maxCol - 1 && this.get(row, maxCol) === undefined) {
			const gridRow = this.grid[row] as Array<T | undefined>
			gridRow[col] = undefined
			while (gridRow.length <= maxCol) gridRow.push(undefined)
			gridRow[maxCol] = element
		}
	}

	adjustRowForMultipleIncoming(sources: T[], element: T): void {
		const [row, col] = this.find(element)
		if (row < 0) return
		const rows = sources.map((s) => this.find(s)[0]).filter((r) => r >= 0)
		if (rows.length === 0) return
		const lowestRow = Math.min(...rows)
		if (lowestRow < row && this.get(lowestRow, col) === undefined) {
			const gridRow = this.grid[row] as Array<T | undefined>
			gridRow[col] = undefined
			this.add(element, [lowestRow, col])
		}
	}

	adjustColumnForMultipleIncoming(sources: T[], element: T): void {
		const [row, col] = this.find(element)
		if (row < 0) return
		const cols = sources.map((s) => this.find(s)[1]).filter((c) => c >= 0)
		if (cols.length === 0) return
		const maxCol = Math.max(...cols)
		if (maxCol + 1 > col) {
			const gridRow = this.grid[row] as Array<T | undefined>
			gridRow[col] = undefined
			// splice-free targeted set; grow the row as needed
			while (gridRow.length <= maxCol + 1) gridRow.push(undefined)
			if (gridRow[maxCol + 1] === undefined) {
				gridRow[maxCol + 1] = element
			} else {
				this.addBelow(gridRow[maxCol + 1] as T, element)
			}
		}
	}

	getAllElements(): T[] {
		return this.elementsByPosition().map((e) => e.element)
	}

	getGridDimensions(): [number, number] {
		return [this.rowCount(), this.colCount()]
	}

	elementsByPosition(): Array<{ element: T; row: number; col: number }> {
		const out: Array<{ element: T; row: number; col: number }> = []
		for (let r = 0; r < this.grid.length; r++) {
			const row = this.grid[r]
			if (!row) continue
			for (let c = 0; c < row.length; c++) {
				const el = row[c]
				if (el !== undefined) out.push({ element: el, row: r, col: c })
			}
		}
		return out
	}

	getElementsTotal(): number {
		return new Set(this.getAllElements()).size
	}

	rowCount(): number {
		return this.grid.length
	}

	colCount(): number {
		return this.grid.reduce((max, row) => Math.max(max, row.length), 0)
	}
}
