import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Bpmn, expand, optimize } from "@bpmn-sdk/core";
import type { CompactDiagram } from "@bpmn-sdk/core";
import * as claude from "./adapters/claude.js";
import * as copilot from "./adapters/copilot.js";
import * as gemini from "./adapters/gemini.js";
import type { FindingInfo } from "./prompt.js";
import {
	buildMcpExplainPrompt,
	buildMcpImprovePrompt,
	buildMcpSystemPrompt,
	buildSystemPrompt,
} from "./prompt.js";

const PORT = process.env.AI_SERVER_PORT ? Number(process.env.AI_SERVER_PORT) : 3033;

// Resolve the compiled mcp-server entry point relative to this file.
// When bundled as bundle.cjs, import.meta.url ends with .cjs → use mcp-server.cjs.
// When compiled by tsc to dist/index.js → use mcp-server.js.
const __file = fileURLToPath(import.meta.url);
const mcpServerFile = __file.endsWith(".cjs") ? "mcp-server.cjs" : "mcp-server.js";
const MCP_SERVER_PATH = join(dirname(__file), mcpServerFile);

interface Adapter {
	supportsMcp: boolean;
	available(): Promise<boolean>;
	stream(
		messages: Array<{ role: string; content: string }>,
		systemPrompt: string,
		mcpConfigFile: string | null,
		onToken: (text: string) => void,
	): Promise<void>;
}
type AdapterEntry = { adapter: Adapter; name: string };

async function detectAll(): Promise<AdapterEntry[]> {
	const results = await Promise.all([
		claude
			.available()
			.then((ok): AdapterEntry | null => (ok ? { adapter: claude, name: "claude" } : null)),
		copilot
			.available()
			.then((ok): AdapterEntry | null => (ok ? { adapter: copilot, name: "copilot" } : null)),
		gemini
			.available()
			.then((ok): AdapterEntry | null => (ok ? { adapter: gemini, name: "gemini" } : null)),
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

/**
 * Extract a CompactDiagram from LLM text output (fallback for non-MCP adapters).
 * Looks for the first ```json block containing a "processes" array.
 */
function extractCompactDiagram(text: string): CompactDiagram | null {
	const match = /```json\s*\n([\s\S]*?)\n```/.exec(text);
	if (!match?.[1]) return null;
	try {
		const parsed = JSON.parse(match[1]) as unknown;
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"processes" in parsed &&
			Array.isArray((parsed as Record<string, unknown>).processes)
		) {
			return parsed as CompactDiagram;
		}
	} catch {
		/* invalid JSON */
	}
	return null;
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
		let action: string | null;
		try {
			const parsed = JSON.parse(body) as {
				messages: typeof messages;
				context?: unknown;
				backend?: string | null;
				action?: string | null;
			};
			messages = parsed.messages;
			context = parsed.context ?? null;
			backend = parsed.backend ?? null;
			action = parsed.action ?? null;
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
			res.end("No AI CLI available. Install claude, copilot, or gemini.");
			return;
		}
		console.log(
			`[server] /chat → adapter: ${detected.name}, action: ${action ?? "chat"}, mcp: ${detected.adapter.supportsMcp}`,
		);

		const currentCompact: CompactDiagram | null =
			context !== null && typeof context === "object" && "processes" in context
				? (context as CompactDiagram)
				: null;

		// ── Collect findings for improve action ──────────────────────────────────
		const findings: FindingInfo[] = [];
		if (action === "improve" && currentCompact) {
			try {
				const defs = expand(currentCompact);
				const report = optimize(defs);
				for (const f of report.findings) {
					findings.push({
						category: f.category,
						severity: f.severity,
						message: f.message,
						suggestion: f.suggestion,
						elementIds: f.elementIds,
					});
				}
				console.log(`[server] improve → ${findings.length} findings from core optimize()`);
			} catch (err) {
				console.error("[server] improve → core analysis failed:", String(err));
			}
		}

		// ── Build system prompt ───────────────────────────────────────────────────
		let systemPrompt: string;
		if (detected.adapter.supportsMcp) {
			systemPrompt =
				action === "improve"
					? buildMcpImprovePrompt(findings)
					: action === "explain"
						? buildMcpExplainPrompt()
						: buildMcpSystemPrompt();
		} else {
			// Fallback for non-MCP adapters: full prompt with format instructions
			systemPrompt = buildSystemPrompt(context);
		}

		// ── Set up MCP temp files (MCP-capable adapters only) ────────────────────
		let tmpDir: string | null = null;
		let mcpConfigFile: string | null = null;
		let outputFile: string | null = null;

		if (detected.adapter.supportsMcp) {
			tmpDir = mkdtempSync(join(tmpdir(), "bpmn-mcp-"));
			const inputFile = join(tmpDir, "input.json");
			outputFile = join(tmpDir, "output.json");
			mcpConfigFile = join(tmpDir, "mcp.json");

			// Write input as BPMN XML (mcp-server reads XML, not CompactDiagram JSON)
			if (currentCompact) writeFileSync(inputFile, Bpmn.export(expand(currentCompact)));

			const mcpConfig = {
				mcpServers: {
					bpmn: {
						type: "stdio",
						command: "node",
						args: [
							MCP_SERVER_PATH,
							...(currentCompact ? ["--input", inputFile] : []),
							"--output",
							outputFile,
						],
					},
				},
			};
			writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig));
		}

		// ── Stream ────────────────────────────────────────────────────────────────
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});

		const accumulated: string[] = [];
		try {
			await detected.adapter.stream(messages, systemPrompt, mcpConfigFile, (token) => {
				accumulated.push(token);
				res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`);
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[server] adapter error: ${msg}`);
			res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
		}

		// ── Post-process: get final diagram and emit XML ──────────────────────────
		if (outputFile) {
			// MCP path: mcp-server writes BPMN XML directly — read and emit as-is
			try {
				const xml = readFileSync(outputFile, "utf8");
				res.write(`data: ${JSON.stringify({ type: "xml", xml })}\n\n`);
				console.log("[server] MCP XML output read successfully");
			} catch {
				console.log("[server] MCP output file not written (no diagram changes)");
			}
		} else {
			// Fallback path: extract CompactDiagram from LLM text response
			const finalCompact = extractCompactDiagram(accumulated.join(""));
			if (finalCompact) {
				try {
					const xml = Bpmn.export(expand(finalCompact));
					res.write(`data: ${JSON.stringify({ type: "xml", xml })}\n\n`);
					console.log("[server] XML emitted via core expand + export");
				} catch (err) {
					console.error("[server] failed to expand result:", String(err));
				}
			}
		}

		// ── Clean up temp files ───────────────────────────────────────────────────
		if (tmpDir) {
			try {
				rmSync(tmpDir, { recursive: true });
			} catch {
				/* best-effort cleanup */
			}
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
