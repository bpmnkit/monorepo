// packages/core/src/layout/v2/graph.ts
import type { V2Edge, V2Node } from "./types.js"

export class V2Graph {
	nodes = new Map<string, V2Node>()
	edges = new Map<string, V2Edge>()
	/** outgoing neighbour lists */
	successors = new Map<string, string[]>()
	/** incoming neighbour lists */
	predecessors = new Map<string, string[]>()

	addNode(node: V2Node): void {
		this.nodes.set(node.id, node)
		if (!this.successors.has(node.id)) this.successors.set(node.id, [])
		if (!this.predecessors.has(node.id)) this.predecessors.set(node.id, [])
	}

	addEdge(edge: V2Edge): void {
		this.edges.set(edge.id, edge)
		const s = this.successors.get(edge.sourceId) ?? []
		if (!s.includes(edge.targetId)) s.push(edge.targetId)
		this.successors.set(edge.sourceId, s)
		const p = this.predecessors.get(edge.targetId) ?? []
		if (!p.includes(edge.sourceId)) p.push(edge.sourceId)
		this.predecessors.set(edge.targetId, p)
	}

	getSuccessors(id: string): string[] {
		return this.successors.get(id) ?? []
	}

	getPredecessors(id: string): string[] {
		return this.predecessors.get(id) ?? []
	}

	/** Shallow clone — nodes/edges objects are shared (not deep-copied). */
	clone(): V2Graph {
		const g = new V2Graph()
		for (const n of this.nodes.values()) g.addNode(n)
		for (const e of this.edges.values()) g.addEdge(e)
		return g
	}
}
