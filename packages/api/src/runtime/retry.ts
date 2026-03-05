import type { RetryConfig } from "./types.js";

const DEFAULTS: Required<RetryConfig> = {
	maxAttempts: 3,
	initialDelay: 100,
	maxDelay: 30_000,
	backoffFactor: 2,
	retryOn: [429, 500, 502, 503, 504],
};

export interface RetryContext {
	attempt: number;
	maxAttempts: number;
	delayMs: number;
	reason: string;
}

export type OnRetry = (ctx: RetryContext) => void;

export async function withRetry<T>(
	fn: () => Promise<T>,
	config: RetryConfig | undefined,
	shouldRetry: (error: unknown) => { retry: boolean; reason: string; statusCode?: number },
	onRetry?: OnRetry,
): Promise<T> {
	const cfg = { ...DEFAULTS, ...config };
	let delay = cfg.initialDelay;

	for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (attempt === cfg.maxAttempts) throw err;

			const { retry, reason, statusCode } = shouldRetry(err);

			// If status code given, check against retryOn list
			if (!retry || (statusCode !== undefined && !cfg.retryOn.includes(statusCode))) {
				throw err;
			}

			const jitter = Math.random() * 0.2 * delay;
			const actualDelay = Math.min(delay + jitter, cfg.maxDelay);

			onRetry?.({
				attempt,
				maxAttempts: cfg.maxAttempts,
				delayMs: actualDelay,
				reason,
			});

			await sleep(actualDelay);
			delay = Math.min(delay * cfg.backoffFactor, cfg.maxDelay);
		}
	}

	// Unreachable, but satisfies TS
	throw new Error("Retry loop exhausted");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
