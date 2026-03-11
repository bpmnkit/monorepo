type Unsub = () => void

/**
 * Polls the proxy's /operate/stream endpoint via plain fetch (one-shot JSON).
 * Using fetch instead of EventSource releases the HTTP connection after each
 * response, preventing connection-pool exhaustion when multiple stores poll
 * the same origin concurrently.
 */
export function createStream<T>(
	url: string,
	onData: (payload: T) => void,
	onError: (msg: string) => void,
): Unsub {
	const interval = Math.max(5_000, Number(new URL(url).searchParams.get("interval") ?? "30000"))
	let aborted = false

	async function poll(): Promise<void> {
		if (aborted) return
		try {
			const r = await fetch(url)
			if (aborted) return
			if (!r.ok) throw new Error(`HTTP ${r.status}`)
			const data = (await r.json()) as T
			onData(data)
		} catch {
			if (!aborted) onError("Connection error. Retrying…")
		}
	}

	void poll()
	const id = setInterval(() => void poll(), interval)
	return () => {
		aborted = true
		clearInterval(id)
	}
}

/** Simulates an SSE stream using mock data. Calls onData immediately and then on interval. */
export function createMockStream<T>(
	getData: () => T,
	onData: (payload: T) => void,
	interval: number,
): Unsub {
	onData(getData())
	if (interval <= 0) return () => {}
	const id = setInterval(() => onData(getData()), interval)
	return () => clearInterval(id)
}
