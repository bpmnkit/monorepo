/**
 * Horizontal alignment between the pools of a collaboration.
 *
 * Each process is laid out on its own, so two elements that exchange a message
 * usually end up at unrelated x positions and the message has to travel sideways
 * to reach its partner. Sliding a whole process sideways costs nothing — the
 * pool grows with it — and a message that leaves straight down crosses far less
 * than one that wanders across two pools first.
 */

/** One message flow, as the two element centres it connects. */
export interface MessageLink {
	fromPool: number
	toPool: number
	/** x centre of the source element within its pool's content. */
	fromX: number
	/** x centre of the target element within its pool's content. */
	toX: number
}

/**
 * Choose a horizontal offset per pool. The widest pool anchors the diagram and
 * the rest slide to meet it, largest first, so the biggest process never moves
 * to chase a small one. Offsets are normalised to keep every pool at or right of
 * the origin.
 */
export function alignPools(
	count: number,
	widths: readonly number[],
	links: readonly MessageLink[],
): number[] {
	const offsets = new Array<number>(count).fill(0)
	if (count < 2 || links.length === 0) return offsets

	const order = Array.from({ length: count }, (_, i) => i).sort(
		(a, b) => (widths[b] ?? 0) - (widths[a] ?? 0) || a - b,
	)

	const placed = new Set<number>()
	const anchor = order[0]
	if (anchor === undefined) return offsets
	placed.add(anchor)

	for (let i = 1; i < order.length; i++) {
		const pool = order[i]
		if (pool === undefined) continue
		const connected = links.filter(
			(link) =>
				(link.fromPool === pool && placed.has(link.toPool)) ||
				(link.toPool === pool && placed.has(link.fromPool)),
		)
		if (connected.length === 0) {
			placed.add(pool)
			continue
		}

		// Every connected message suggests the shift that would make it vertical;
		// staying put is always in the running.
		const candidates = new Set<number>([0])
		for (const link of connected) {
			const mine = link.fromPool === pool ? link.fromX : link.toX
			const theirs = link.fromPool === pool ? link.toX : link.fromX
			const otherPool = link.fromPool === pool ? link.toPool : link.fromPool
			candidates.add(theirs + (offsets[otherPool] ?? 0) - mine)
		}

		let best = 0
		let bestCost = Number.POSITIVE_INFINITY
		for (const candidate of [...candidates].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)) {
			let cost = 0
			for (const link of connected) {
				const mine = link.fromPool === pool ? link.fromX : link.toX
				const theirs = link.fromPool === pool ? link.toX : link.fromX
				const otherPool = link.fromPool === pool ? link.toPool : link.fromPool
				cost += Math.abs(mine + candidate - (theirs + (offsets[otherPool] ?? 0)))
			}
			if (cost < bestCost) {
				bestCost = cost
				best = candidate
			}
		}

		offsets[pool] = Math.round(best)
		placed.add(pool)
	}

	const min = Math.min(...offsets)
	return min === 0 ? offsets : offsets.map((offset) => offset - min)
}
