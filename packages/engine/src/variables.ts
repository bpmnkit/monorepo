/**
 * Hierarchical variable scope store.
 * Scopes form a parent chain; reads walk up, writes update the nearest
 * scope that already owns the variable (or fall through to local).
 */
export class VariableStore {
	private readonly scopes = new Map<string, Map<string, unknown>>()
	private readonly parents = new Map<string, string>()

	createScope(id: string, parentId?: string): void {
		this.scopes.set(id, new Map())
		if (parentId !== undefined) {
			this.parents.set(id, parentId)
		}
	}

	removeScope(id: string): void {
		this.scopes.delete(id)
		this.parents.delete(id)
	}

	/** Walk up the chain and return the value, or undefined if not found. */
	get(scopeId: string, name: string): unknown {
		const scope = this.scopes.get(scopeId)
		if (scope === undefined) return undefined
		if (scope.has(name)) return scope.get(name)
		const parentId = this.parents.get(scopeId)
		if (parentId !== undefined) return this.get(parentId, name)
		return undefined
	}

	/**
	 * Set a variable. Walks up the chain and updates it in the nearest scope
	 * that already holds the variable. If not found anywhere, sets it locally.
	 */
	set(scopeId: string, name: string, value: unknown): void {
		if (this.hasOwn(scopeId, name)) {
			this.scopes.get(scopeId)?.set(name, value)
			return
		}
		const parentId = this.parents.get(scopeId)
		if (parentId !== undefined && this.ancestorHas(parentId, name)) {
			this.set(parentId, name, value)
			return
		}
		this.scopes.get(scopeId)?.set(name, value)
	}

	/** Set a variable in this scope only, regardless of parent state. */
	setLocal(scopeId: string, name: string, value: unknown): void {
		this.scopes.get(scopeId)?.set(name, value)
	}

	/** Return all variables merged from root → this scope (child wins). */
	getAll(scopeId: string): Record<string, unknown> {
		const parentId = this.parents.get(scopeId)
		const parentVars = parentId !== undefined ? this.getAll(parentId) : {}
		const scope = this.scopes.get(scopeId)
		if (scope === undefined) return parentVars
		const result: Record<string, unknown> = { ...parentVars }
		for (const [k, v] of scope) {
			result[k] = v
		}
		return result
	}

	private hasOwn(scopeId: string, name: string): boolean {
		return this.scopes.get(scopeId)?.has(name) ?? false
	}

	private ancestorHas(scopeId: string, name: string): boolean {
		if (this.hasOwn(scopeId, name)) return true
		const parentId = this.parents.get(scopeId)
		if (parentId !== undefined) return this.ancestorHas(parentId, name)
		return false
	}
}
