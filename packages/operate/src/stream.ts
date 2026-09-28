type Unsub = () => void

/**
 * Polls the proxy's /operate/stream endpoint via plain fetch (one-shot JSON).
 * Using fetch instead of EventSource releases the HTTP connection after each
 * response, preventing connection-pool exhaustion when multiple stores poll
 * the same origin concurrently.
 *
 * The poll interval comes from the URL's `interval` query parameter (default
 * 30 000 ms, floor 5 000 ms). `interval=0` fetches once and never re-polls.
 */
export function createStream<T>(
	url: string,
	onData: (payload: T) => void,
	onError: (msg: string) => void,
): Unsub {
	// Only the query string is read here, so a same-origin relative proxy URL
	// (e.g. "/bpmnkit-proxy") must not throw for lack of a base.
	const requested = Number(new URL(url, "http://localhost").searchParams.get("interval") ?? "30000")
	let aborted = false
	let inFlight = false

	async function poll(): Promise<void> {
		// A slow cluster must not pile up overlapping requests every interval.
		if (aborted || inFlight) return
		inFlight = true
		try {
			const r = await fetch(url)
			if (aborted) return
			if (!r.ok) {
				const msg = await describeHttpError(r)
				if (!aborted) onError(msg)
				return
			}
			const data = (await r.json()) as T
			if (!aborted) onData(data)
		} catch {
			if (!aborted) onError("Connection error. Retrying…")
		} finally {
			inFlight = false
		}
	}

	void poll()
	const id = requested > 0 ? setInterval(() => void poll(), Math.max(5_000, requested)) : null
	return () => {
		aborted = true
		if (id !== null) clearInterval(id)
	}
}

/** "HTTP 401: No active profile" — the proxy puts its reason in `{ error }`. */
async function describeHttpError(r: Response): Promise<string> {
	let reason = ""
	try {
		const body = (await r.json()) as { error?: unknown }
		if (typeof body.error === "string") reason = body.error
	} catch {
		// non-JSON body — the status alone has to do
	}
	return reason ? `HTTP ${r.status}: ${reason}` : `HTTP ${r.status}`
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
