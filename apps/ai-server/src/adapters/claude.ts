import { spawn } from "node:child_process";
import { buildSystemPrompt } from "../prompt.js";

interface Message {
	role: string;
	content: string;
}

interface StreamEvent {
	type: string;
	message?: {
		content?: Array<{ type: string; text?: string }>;
	};
}

export async function available(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("claude", ["--version"], { stdio: "ignore" });
		proc.on("error", () => resolve(false));
		proc.on("close", (code) => resolve(code === 0));
	});
}

export async function stream(
	messages: Message[],
	context: unknown,
	onToken: (text: string) => void,
): Promise<void> {
	const systemPrompt = buildSystemPrompt(context);
	// Build conversation as a single prompt string
	const parts = [systemPrompt, ""];
	for (const msg of messages) {
		parts.push(`${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`);
	}
	parts.push("Assistant:");
	const fullPrompt = parts.join("\n");

	const args = ["-p", fullPrompt, "--output-format", "stream-json", "--verbose"];
	console.log(
		`[claude] spawning: claude ${args.slice(0, 1).join(" ")} <prompt> --output-format stream-json`,
	);

	await new Promise<void>((resolve, reject) => {
		const proc = spawn("claude", args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let buf = "";
		let stderrBuf = "";

		proc.stdout?.on("data", (chunk: Buffer) => {
			buf += chunk.toString();
			const lines = buf.split("\n");
			buf = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const event = JSON.parse(line) as StreamEvent;
					if (event.type === "assistant" && event.message?.content) {
						for (const block of event.message.content) {
							if (block.type === "text" && block.text) {
								onToken(block.text);
							}
						}
					}
				} catch {
					/* non-JSON line, skip */
				}
			}
		});

		proc.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString();
			stderrBuf += text;
			process.stderr.write(`[claude stderr] ${text}`);
		});

		proc.on("error", (err) => {
			console.error(`[claude] spawn error: ${String(err)}`);
			reject(err);
		});
		proc.on("close", (code) => {
			console.log(`[claude] exited with code ${code}`);
			if (code === 0) {
				resolve();
			} else {
				const detail = stderrBuf.trim() ? `: ${stderrBuf.trim()}` : "";
				reject(new Error(`claude exited with code ${code}${detail}`));
			}
		});
	});
}
