import http from "node:http";
import * as claude from "./adapters/claude.js";
import * as copilot from "./adapters/copilot.js";

const PORT = process.env.AI_SERVER_PORT ? Number(process.env.AI_SERVER_PORT) : 3033;

type Adapter = typeof claude;
type AdapterEntry = { adapter: Adapter; name: string };

async function detectAll(): Promise<AdapterEntry[]> {
	const results = await Promise.all([
		claude
			.available()
			.then((ok): AdapterEntry | null => (ok ? { adapter: claude, name: "claude" } : null)),
		copilot
			.available()
			.then((ok): AdapterEntry | null => (ok ? { adapter: copilot, name: "copilot" } : null)),
	]);
	return results.filter((r): r is AdapterEntry => r !== null);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString()));
		req.on("error", reject);
	});
}

const server = http.createServer(async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

	console.log(`[server] ${req.method} ${url.pathname}`);

	if (url.pathname === "/status" && req.method === "GET") {
		const available = await detectAll();
		const names = available.map((a) => a.name);
		console.log(`[server] /status → available: [${names.join(", ")}]`);
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({ ready: available.length > 0, backend: names[0] ?? null, available: names }),
		);
		return;
	}

	if (url.pathname === "/chat" && req.method === "POST") {
		const body = await readBody(req);
		let messages: Array<{ role: string; content: string }>;
		let context: unknown;
		let backend: string | null;
		try {
			const parsed = JSON.parse(body) as {
				messages: typeof messages;
				context?: unknown;
				backend?: string | null;
			};
			messages = parsed.messages;
			context = parsed.context ?? null;
			backend = parsed.backend ?? null;
		} catch {
			res.writeHead(400);
			res.end("Bad Request");
			return;
		}

		const available = await detectAll();
		const detected = backend
			? (available.find((a) => a.name === backend) ?? available[0])
			: available[0];
		if (!detected) {
			console.log("[server] /chat → no adapter available");
			res.writeHead(503);
			res.end("No AI CLI available. Install claude or gh copilot.");
			return;
		}
		console.log(`[server] /chat → using adapter: ${detected.name}, messages: ${messages.length}`);

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});

		try {
			await detected.adapter.stream(messages, context, (token) => {
				res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`);
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[server] /chat → adapter error: ${msg}`);
			res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
		}

		res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
		res.end();
		return;
	}

	res.writeHead(404);
	res.end("Not Found");
});

server.listen(PORT, () => {
	console.log(`BPMN SDK AI Server running at http://localhost:${PORT}`);
	console.log("Press Ctrl+C to stop");
});
