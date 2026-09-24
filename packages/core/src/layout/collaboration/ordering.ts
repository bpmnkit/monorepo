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
	/**
	 * Where the message leaves inside its pool, 0 at the top to 1 at the bottom.
	 * A message whose element sits on the far side of its pool has to cross the
	 * whole process to get out, so the order that lets it leave from the near
	 * side wins. Absent for pools with no content to cross.
	 */
	fromDepth?: number
	toDepth?: number
}

/** A full pool of process to cross costs this fraction of one pool step. */
const DEPTH_WEIGHT = 0.5

/**
 * All the links between one pair of pools, pre-summed: `aAbove` is the depth
 * cost when pool `a` sits above pool `b`, `aBelow` when it sits below.
 */
interface PairCost {
	a: number
	b: number
	weight: number
	aAbove: number
	aBelow: number
}

function pairCosts(links: readonly PoolLink[]): PairCost[] {
	const pairs = new Map<string, PairCost>()
	for (const link of links) {
		if (link.from === link.to) continue
		const a = Math.min(link.from, link.to)
		const b = Math.max(link.from, link.to)
		const key = `${a}:${b}`
		let pair = pairs.get(key)
		if (!pair) {
			pair = { a, b, weight: 0, aAbove: 0, aBelow: 0 }
			pairs.set(key, pair)
		}
		pair.weight += link.weight
		// Leaving downward crosses what lies below the element, upward what lies above.
		for (const [pool, depth] of [
			[link.from, link.fromDepth],
			[link.to, link.toDepth],
		] as const) {
			if (depth === undefined) continue
			const down = link.weight * DEPTH_WEIGHT * (1 - depth)
			const up = link.weight * DEPTH_WEIGHT * depth
			if (pool === a) {
				pair.aAbove += down
				pair.aBelow += up
			} else {
				pair.aAbove += up
				pair.aBelow += down
			}
		}
	}
	return [...pairs.values()]
}

/**
 * How far the messages travel in this order, weighted by how many there are,
 * plus how much of their own pools they cross to get out. The declaration-order
 * term is a tie-break: with nothing to gain from moving, the pools stay where
 * the author put them.
 */
function cost(order: readonly number[], pairs: readonly PairCost[]): number {
	const position: number[] = []
	for (let i = 0; i < order.length; i++) {
		const id = order[i]
		if (id !== undefined) position[id] = i
	}

	let total = 0
	for (const pair of pairs) {
		const a = position[pair.a]
		const b = position[pair.b]
		if (a === undefined || b === undefined) continue
		total += pair.weight * Math.abs(a - b) + (a < b ? pair.aAbove : pair.aBelow)
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

	const pairs = pairCosts(links)
	return count <= EXHAUSTIVE_LIMIT ? exhaustive(identity, pairs) : refine(identity, pairs)
}

/** Every order, best first-found wins — so declaration order survives a tie. */
function exhaustive(identity: number[], pairs: readonly PairCost[]): number[] {
	let best = identity
	let bestCost = cost(identity, pairs)

	const permute = (prefix: number[], rest: number[]): void => {
		if (rest.length === 0) {
			const candidate = cost(prefix, pairs)
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
function refine(identity: number[], pairs: readonly PairCost[]): number[] {
	let order = [...identity]
	let current = cost(order, pairs)

	for (let sweep = 0; sweep < order.length; sweep++) {
		let improved = false
		for (let from = 0; from < order.length; from++) {
			const pool = order[from]
			if (pool === undefined) continue
			const without = [...order.slice(0, from), ...order.slice(from + 1)]

			for (let to = 0; to <= without.length; to++) {
				if (to === from) continue
				const candidate = [...without.slice(0, to), pool, ...without.slice(to)]
				const candidateCost = cost(candidate, pairs)
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
