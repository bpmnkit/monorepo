let counter = 0;

/** Generates a unique ID with the given prefix. */
export function generateId(prefix: string): string {
	counter++;
	return `${prefix}_${counter.toString(36).padStart(7, "0")}`;
}

/** Resets the ID counter (for testing). */
export function resetIdCounter(): void {
	counter = 0;
}
