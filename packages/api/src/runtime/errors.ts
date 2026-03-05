/** Base class for all errors thrown by the Camunda API client. */
export class CamundaError extends Error {
	override readonly name: string = "CamundaError";
}

/** An HTTP-level error (non-2xx response from the API). */
export class CamundaHttpError extends CamundaError {
	override readonly name: string = "CamundaHttpError";

	constructor(
		message: string,
		public readonly status: number,
		public readonly body: unknown,
		public readonly url: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

/** 400 Bad Request — invalid input. */
export class CamundaValidationError extends CamundaHttpError {
	override readonly name: string = "CamundaValidationError";
}

/** 401 Unauthorized — missing or invalid credentials. */
export class CamundaAuthError extends CamundaHttpError {
	override readonly name: string = "CamundaAuthError";
}

/** 403 Forbidden — authenticated but not allowed. */
export class CamundaForbiddenError extends CamundaHttpError {
	override readonly name: string = "CamundaForbiddenError";
}

/** 404 Not Found. */
export class CamundaNotFoundError extends CamundaHttpError {
	override readonly name: string = "CamundaNotFoundError";
}

/** 409 Conflict — resource is in the wrong state. */
export class CamundaConflictError extends CamundaHttpError {
	override readonly name: string = "CamundaConflictError";
}

/** 429 Too Many Requests — rate limited. */
export class CamundaRateLimitError extends CamundaHttpError {
	override readonly name: string = "CamundaRateLimitError";

	/** Seconds until the client may retry, if provided by the server. */
	readonly retryAfter?: number;

	constructor(
		message: string,
		status: number,
		body: unknown,
		url: string,
		retryAfter?: number,
		options?: ErrorOptions,
	) {
		super(message, status, body, url, options);
		this.retryAfter = retryAfter;
	}
}

/** 5xx Server Error. */
export class CamundaServerError extends CamundaHttpError {
	override readonly name: string = "CamundaServerError";
}

/** Network-level failure (no response received). */
export class CamundaNetworkError extends CamundaError {
	override readonly name: string = "CamundaNetworkError";
}

/** Request timed out before a response was received. */
export class CamundaTimeoutError extends CamundaNetworkError {
	override readonly name: string = "CamundaTimeoutError";
}

export function buildHttpError(status: number, body: unknown, url: string): CamundaHttpError {
	const message = extractMessage(body, status);
	switch (status) {
		case 400:
			return new CamundaValidationError(message, status, body, url);
		case 401:
			return new CamundaAuthError(message, status, body, url);
		case 403:
			return new CamundaForbiddenError(message, status, body, url);
		case 404:
			return new CamundaNotFoundError(message, status, body, url);
		case 409:
			return new CamundaConflictError(message, status, body, url);
		case 429: {
			const retryAfter =
				typeof body === "object" &&
				body !== null &&
				"retryAfter" in body &&
				typeof (body as Record<string, unknown>).retryAfter === "number"
					? ((body as Record<string, unknown>).retryAfter as number)
					: undefined;
			return new CamundaRateLimitError(message, status, body, url, retryAfter);
		}
		default:
			if (status >= 500) {
				return new CamundaServerError(message, status, body, url);
			}
			return new CamundaHttpError(message, status, body, url);
	}
}

function extractMessage(body: unknown, status: number): string {
	if (typeof body === "object" && body !== null) {
		const b = body as Record<string, unknown>;
		if (typeof b.message === "string") return b.message;
		if (typeof b.detail === "string") return b.detail;
		if (typeof b.title === "string") return b.title;
	}
	return `HTTP ${status}`;
}
