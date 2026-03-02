import { spawn } from "node:child_process";
import { buildSystemPrompt } from "../prompt.js";

interface Message {
	role: string;
	content: string;
}

export async function available(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("gh", ["copilot", "--version"], { stdio: "ignore" });
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
	const lastUser = [...messages].reverse().find((m) => m.role === "user");
	const prompt = `${systemPrompt}\n\nUser request: ${lastUser?.content ?? "help"}`;

	await new Promise<void>((resolve, reject) => {
		// gh copilot suggest is for shell commands; we use explain as a best-effort fallback
		const proc = spawn("gh", ["copilot", "explain", prompt], {
			stdio: ["ignore", "pipe", "pipe"],
		});

		proc.stdout?.on("data", (chunk: Buffer) => {
			onToken(chunk.toString());
		});

		proc.on("error", reject);
		proc.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`gh copilot exited with code ${code}`));
		});
	});
}
