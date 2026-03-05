import { describe, expect, it } from "vitest";
import {
	CamundaAuthError,
	CamundaConflictError,
	CamundaForbiddenError,
	CamundaNotFoundError,
	CamundaRateLimitError,
	CamundaServerError,
	CamundaValidationError,
	buildHttpError,
} from "./errors.js";

describe("buildHttpError", () => {
	it("returns CamundaValidationError for 400", () => {
		const err = buildHttpError(400, { message: "bad input" }, "http://test");
		expect(err).toBeInstanceOf(CamundaValidationError);
		expect(err.status).toBe(400);
		expect(err.message).toBe("bad input");
	});

	it("returns CamundaAuthError for 401", () => {
		expect(buildHttpError(401, null, "http://test")).toBeInstanceOf(CamundaAuthError);
	});

	it("returns CamundaForbiddenError for 403", () => {
		expect(buildHttpError(403, null, "http://test")).toBeInstanceOf(CamundaForbiddenError);
	});

	it("returns CamundaNotFoundError for 404", () => {
		expect(buildHttpError(404, null, "http://test")).toBeInstanceOf(CamundaNotFoundError);
	});

	it("returns CamundaConflictError for 409", () => {
		expect(buildHttpError(409, null, "http://test")).toBeInstanceOf(CamundaConflictError);
	});

	it("returns CamundaRateLimitError for 429 with retryAfter", () => {
		const err = buildHttpError(429, { retryAfter: 30 }, "http://test");
		expect(err).toBeInstanceOf(CamundaRateLimitError);
		expect((err as CamundaRateLimitError).retryAfter).toBe(30);
	});

	it("returns CamundaServerError for 500+", () => {
		expect(buildHttpError(500, null, "http://test")).toBeInstanceOf(CamundaServerError);
		expect(buildHttpError(503, null, "http://test")).toBeInstanceOf(CamundaServerError);
	});

	it("extracts message from response body detail field", () => {
		const err = buildHttpError(400, { detail: "invalid value" }, "http://test");
		expect(err.message).toBe("invalid value");
	});

	it("falls back to HTTP status as message", () => {
		const err = buildHttpError(422, {}, "http://test");
		expect(err.message).toBe("HTTP 422");
	});
});
