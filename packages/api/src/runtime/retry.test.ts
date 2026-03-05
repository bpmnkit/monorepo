import { describe, expect, it, vi } from "vitest";
import { CamundaHttpError, CamundaNetworkError } from "./errors.js";
import { withRetry } from "./retry.js";

const alwaysRetry = (err: unknown) => {
	if (err instanceof CamundaHttpError)
		return { retry: true, reason: `HTTP ${err.status}`, statusCode: err.status };
	if (err instanceof CamundaNetworkError) return { retry: true, reason: "network" };
	return { retry: false, reason: "unknown" };
};

describe("withRetry", () => {
	it("returns result on success", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const result = await withRetry(fn, undefined, alwaysRetry);
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledOnce();
	});

	it("retries on retryable error and eventually succeeds", async () => {
		const err = new CamundaNetworkError("timeout");
		const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
		const onRetry = vi.fn();
		const result = await withRetry(fn, { maxAttempts: 3, initialDelay: 0 }, alwaysRetry, onRetry);
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("throws after maxAttempts", async () => {
		const err = new CamundaNetworkError("fail");
		const fn = vi.fn().mockRejectedValue(err);
		await expect(withRetry(fn, { maxAttempts: 3, initialDelay: 0 }, alwaysRetry)).rejects.toThrow(
			"fail",
		);
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("does not retry non-retryable errors", async () => {
		const err = new TypeError("bad input");
		const fn = vi.fn().mockRejectedValue(err);
		await expect(withRetry(fn, { maxAttempts: 3, initialDelay: 0 }, alwaysRetry)).rejects.toThrow(
			"bad input",
		);
		expect(fn).toHaveBeenCalledOnce();
	});

	it("does not retry when status code not in retryOn list", async () => {
		const err = new CamundaHttpError("not found", 404, null, "http://test");
		const fn = vi.fn().mockRejectedValue(err);
		await expect(
			withRetry(fn, { maxAttempts: 3, initialDelay: 0, retryOn: [500] }, alwaysRetry),
		).rejects.toThrow();
		expect(fn).toHaveBeenCalledOnce();
	});
});
