/**
 * Minimal typed event emitter — no Node.js dependency, works in any runtime.
 */
export class TypedEventEmitter<TMap extends Record<string, unknown>> {
	#listeners = new Map<keyof TMap, Set<(data: unknown) => void>>();

	on<K extends keyof TMap>(event: K, listener: (data: TMap[K]) => void): this {
		let set = this.#listeners.get(event);
		if (!set) {
			set = new Set();
			this.#listeners.set(event, set);
		}
		set.add(listener as (data: unknown) => void);
		return this;
	}

	off<K extends keyof TMap>(event: K, listener: (data: TMap[K]) => void): this {
		this.#listeners.get(event)?.delete(listener as (data: unknown) => void);
		return this;
	}

	once<K extends keyof TMap>(event: K, listener: (data: TMap[K]) => void): this {
		const wrapped = (data: TMap[K]) => {
			this.off(event, wrapped);
			listener(data);
		};
		return this.on(event, wrapped);
	}

	emit<K extends keyof TMap>(event: K, data: TMap[K]): void {
		const set = this.#listeners.get(event);
		if (!set) return;
		for (const listener of set) {
			try {
				listener(data);
			} catch {
				// Listeners must not crash the client.
			}
		}
	}

	removeAllListeners<K extends keyof TMap>(event?: K): void {
		if (event !== undefined) {
			this.#listeners.delete(event);
		} else {
			this.#listeners.clear();
		}
	}
}
