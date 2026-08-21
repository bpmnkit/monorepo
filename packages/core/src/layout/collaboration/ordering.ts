/**
 * Vertical order of the pools in a collaboration.
 *
 * Message flows read best when the pools they connect sit next to each other,
 * so the order is chosen to minimise how far messages travel vertically rather
 * than left as declared. Small collaborations can afford an exhaustive search;
 * larger ones use repeated remove-and-reinsert, which reaches the same answer on
 * every realistic diagram and never depends on iteration order.
 */

/** Above this many pools, permuting every order costs more than it is worth. */
const EXHAUSTIVE_LIMIT = 8

/** A message-flow relationship between two pools, by index into the input order. */
export interface PoolLink {
	from: number
	to: number
	weight: number
}

/**
 * How far the messages travel in this order, weighted by how many there are.
 * The declaration-order term is a tie-break: with nothing to gain from moving,
 * the pools stay where the author put them.
 */
function cost(order: readonly number[], links: readonly PoolLink[]): number {
	const position = new Map<number, number>()
	for (let i = 0; i < order.length; i++) {
		const id = order[i]
		if (id !== undefined) position.set(id, i)
	}

	let total = 0
	for (const link of links) {
		const from = position.get(link.from)
		const to = position.get(link.to)
		if (from === undefined || to === undefined) continue
		total += link.weight * Math.abs(from - to)
	}

	let drift = 0
	for (let i = 0; i < order.length; i++) drift += Math.abs((order[i] ?? i) - i)
	return total + drift / (order.length * order.length + 1)
}

/**
 * Order pools by their message-flow relationships. Returns indices into the
 * input order; an input with no message flows comes back unchanged.
 */
export function orderPools(count: number, links: readonly PoolLink[]): number[] {
	const identity = Array.from({ length: count }, (_, i) => i)
	if (count < 3 || links.length === 0) return identity

	return count <= EXHAUSTIVE_LIMIT ? exhaustive(identity, links) : refine(identity, links)
}

/** Every order, best first-found wins — so declaration order survives a tie. */
function exhaustive(identity: number[], links: readonly PoolLink[]): number[] {
	let best = identity
	let bestCost = cost(identity, links)

	const permute = (prefix: number[], rest: number[]): void => {
		if (rest.length === 0) {
			const candidate = cost(prefix, links)
			if (candidate < bestCost) {
				best = [...prefix]
				bestCost = candidate
			}
			return
		}
		for (let i = 0; i < rest.length; i++) {
			const next = rest[i]
			if (next === undefined) continue
			permute([...prefix, next], [...rest.slice(0, i), ...rest.slice(i + 1)])
		}
	}

	permute([], identity)
	return best
}

/**
 * Take each pool out and put it back wherever it fits best, repeating until a
 * full sweep changes nothing.
 */
function refine(identity: number[], links: readonly PoolLink[]): number[] {
	let order = [...identity]
	let current = cost(order, links)

	for (let sweep = 0; sweep < order.length; sweep++) {
		let improved = false
		for (let from = 0; from < order.length; from++) {
			const pool = order[from]
			if (pool === undefined) continue
			const without = [...order.slice(0, from), ...order.slice(from + 1)]

			for (let to = 0; to <= without.length; to++) {
				if (to === from) continue
				const candidate = [...without.slice(0, to), pool, ...without.slice(to)]
				const candidateCost = cost(candidate, links)
				if (candidateCost < current) {
					order = candidate
					current = candidateCost
					improved = true
					break
				}
			}
		}
		if (!improved) break
	}

	return order
}
