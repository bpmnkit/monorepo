/**
 * Mutable 2-D character canvas that serialises to a multiline string.
 *
 * Coordinates are (col, row) = (x, y), zero-based from the top-left.
 * Out-of-bounds writes are silently ignored.
 */
export class AsciiGrid {
	private readonly cells: string[][];
	readonly cols: number;
	readonly rows: number;

	constructor(cols: number, rows: number) {
		this.cols = cols;
		this.rows = rows;
		this.cells = Array.from({ length: rows }, () => Array<string>(cols).fill(" "));
	}

	/** Overwrite a single cell. Out-of-bounds writes are silently ignored. */
	set(col: number, row: number, ch: string): void {
		if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
		const r = this.cells[row];
		if (r !== undefined) r[col] = ch[0] ?? " ";
	}

	get(col: number, row: number): string {
		if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return " ";
		return this.cells[row]?.[col] ?? " ";
	}

	/**
	 * Write text left-to-right starting at (col, row).
	 * Characters that fall outside the grid are ignored.
	 */
	write(col: number, row: number, text: string): void {
		for (let i = 0; i < text.length; i++) {
			this.set(col + i, row, text[i] ?? " ");
		}
	}

	/**
	 * Set a cell, combining with any existing box-drawing char at that position.
	 * Used for edge junctions (e.g. two edges crossing at the same column).
	 */
	setLine(col: number, row: number, ch: string): void {
		const existing = this.get(col, row);
		this.set(col, row, mergeBoxChars(existing, ch));
	}

	/** Serialise to a newline-separated string. Trailing spaces on each row are stripped. */
	toString(): string {
		return this.cells.map((row) => row.join("").trimEnd()).join("\n");
	}
}

// Directions each box-drawing char has connections in (L=left R=right U=up D=down)
const CHAR_DIRS: Record<string, string> = {
	"─": "LR",
	"│": "UD",
	"┌": "RD",
	"┐": "LD",
	"└": "RU",
	"┘": "LU",
	"├": "RUD",
	"┤": "LUD",
	"┬": "LRD",
	"┴": "LRU",
	"┼": "LRUD",
};

// Reverse map: sorted direction string → box-drawing char
const DIRS_CHAR: Record<string, string> = {};
for (const [ch, dirs] of Object.entries(CHAR_DIRS)) {
	DIRS_CHAR[[...dirs].sort().join("")] = ch;
}

/**
 * Merge two box-drawing characters at a junction point by taking the union of
 * their connection directions. Returns `next` when no merge applies.
 */
export function mergeBoxChars(existing: string, next: string): string {
	if (existing === " " || existing === next) return next;
	// Arrows always win
	if (next === "►" || next === "▼") return next;
	if (existing === "►" || existing === "▼") return existing;
	const eDirs = CHAR_DIRS[existing];
	const nDirs = CHAR_DIRS[next];
	if (!eDirs || !nDirs) return next;
	const union = [...new Set([...eDirs, ...nDirs])].sort().join("");
	return DIRS_CHAR[union] ?? next;
}
