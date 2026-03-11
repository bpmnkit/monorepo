export interface StoreState<T> {
	data: T | null
	loading: boolean
	error: string | null
}

type Listener = () => void

export class Store<T> {
	private _state: StoreState<T> = { data: null, loading: false, error: null }
	private _listeners: Set<Listener> = new Set()
	private _unsub: (() => void) | null = null

	get state(): StoreState<T> {
		return this._state
	}

	subscribe(fn: Listener): () => void {
		this._listeners.add(fn)
		return () => this._listeners.delete(fn)
	}

	protected set(patch: Partial<StoreState<T>>): void {
		this._state = { ...this._state, ...patch }
		for (const fn of this._listeners) fn()
	}

	protected setUnsub(unsub: () => void): void {
		this._unsub?.()
		this._unsub = unsub
	}

	/** Stop polling without clearing data or listeners. Safe to reconnect later. */
	disconnect(): void {
		this._unsub?.()
		this._unsub = null
	}

	destroy(): void {
		this._unsub?.()
		this._unsub = null
		this._listeners.clear()
	}
}
