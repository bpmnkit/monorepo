/**
 * Hierarchical variable scope store.
 * Scopes form a parent chain; reads walk up, writes update the nearest
 * scope that already owns the variable (or fall through to local).
 */
export class VariableStore {
	private readonly scopes = new Map<string, Map<string, unknown>>()
	private readonly parents = new Map<string, string>()
	/**
	 * Merged root → scope views, built lazily and then kept current by every
	 * write, so expression evaluation never re-merges the scope chain.
	 */
	private readonly snapshots = new Map<string, Record<string, unknown>>()

	createScope(id: string, parentId?: string): void {
		this.scopes.set(id, new Map())
		if (parentId !== undefined) {
			this.parents.set(id, parentId)
		}
	}

	removeScope(id: string): void {
		this.scopes.delete(id)
		this.parents.delete(id)
		this.snapshots.delete(id)
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
			this.write(scopeId, name, value)
			return
		}
		const parentId = this.parents.get(scopeId)
		if (parentId !== undefined && this.ancestorHas(parentId, name)) {
			this.set(parentId, name, value)
			return
		}
		this.write(scopeId, name, value)
	}

	/** Set a variable in this scope only, regardless of parent state. */
	setLocal(scopeId: string, name: string, value: unknown): void {
		this.write(scopeId, name, value)
	}

	/** Return a fresh copy of all variables merged from root → this scope (child wins). */
	getAll(scopeId: string): Record<string, unknown> {
		return { ...this.snapshot(scopeId) }
	}

	/**
	 * All variables merged from root → this scope, as a shared object that
	 * later writes update in place. Callers must treat it as read-only and not
	 * hold it across a write.
	 */
	snapshot(scopeId: string): Record<string, unknown> {
		const cached = this.snapshots.get(scopeId)
		if (cached !== undefined) return cached
		const parentId = this.parents.get(scopeId)
		const parentVars = parentId !== undefined ? this.snapshot(parentId) : {}
		const scope = this.scopes.get(scopeId)
		if (scope === undefined) return parentVars
		const result: Record<string, unknown> = { ...parentVars }
		for (const [k, v] of scope) result[k] = v
		this.snapshots.set(scopeId, result)
		return result
	}

	/** Store the value and patch every cached view that sees this scope's copy of `name`. */
	private write(scopeId: string, name: string, value: unknown): void {
		const scope = this.scopes.get(scopeId)
		if (scope === undefined) return
		scope.set(name, value)
		for (const [viewId, view] of this.snapshots) {
			// Walk from the view's scope up to the writer; a scope in between that
			// owns the name shadows the write for this view.
			let current: string | undefined = viewId
			while (current !== undefined && current !== scopeId) {
				if (this.scopes.get(current)?.has(name)) break
				current = this.parents.get(current)
			}
			if (current === scopeId) view[name] = value
		}
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
