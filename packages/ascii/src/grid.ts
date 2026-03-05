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

/**
 * Merge two box-drawing characters at a junction point.
 * Returns the combined character, or `next` when no merge rule applies.
 */
export function mergeBoxChars(existing: string, next: string): string {
	if (existing === " " || existing === next) return next;
	// Canonical key: sort the two chars so order doesn't matter
	const key = [existing, next].sort().join("");
	return MERGE_TABLE[key] ?? next;
}

// Look-up table for common box-drawing junctions.
// Keys are pairs of chars sorted by Unicode codepoint.
const MERGE_TABLE: Record<string, string> = {
	// Straight lines crossing
	"─│": "┼",
	// Horizontal line meeting a corner
	"─┌": "┬",
	"─┐": "┬",
	"─└": "┴",
	"─┘": "┴",
	// Horizontal line meeting a T-junction
	"─├": "┼",
	"─┤": "┼",
	"─┬": "┬",
	"─┴": "┴",
	// Vertical line meeting a corner
	"│┌": "├",
	"│└": "├",
	"│┐": "┤",
	"│┘": "┤",
	// Two corners that form a T at the same point
	"┌└": "├", // both open right, one going down, one going up → left T
	"┐┘": "┤", // both open left, one going down, one going up → right T
	"┌┐": "┬", // both open down, at same column → top T
	"└┘": "┴", // both open up, at same column → bottom T
	// Arrow overrides — arrows always win
	"─►": "►",
	"─▼": "▼",
};
