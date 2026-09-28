import http from "node:http"
import type { AddressInfo } from "node:net"

export interface Reply {
	status: number
	headers: http.IncomingHttpHeaders
	body: string
}

/** A raw request, so tests can send the `Host`, `Origin` and `Sec-Fetch-*` a browser would. */
export function send(
	server: http.Server,
	method: string,
	path: string,
	headers: Record<string, string> = {},
	body?: string,
): Promise<Reply> {
	const { port } = server.address() as AddressInfo
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				host: "127.0.0.1",
				port,
				method,
				path,
				headers: { host: `localhost:${port}`, ...headers },
			},
			(res) => {
				const chunks: Buffer[] = []
				res.on("data", (c: Buffer) => chunks.push(c))
				res.on("end", () =>
					resolve({
						status: res.statusCode ?? 0,
						headers: res.headers,
						body: Buffer.concat(chunks).toString(),
					}),
				)
			},
		)
		req.on("error", reject)
		if (body !== undefined) req.write(body)
		req.end()
	})
}

export function listening(server: http.Server): Promise<http.Server> {
	return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)))
}

export function close(server: http.Server): Promise<void> {
	return new Promise((resolve) => server.close(() => resolve()))
}
