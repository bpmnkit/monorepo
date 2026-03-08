import type { ZeebeIoMappingEntry, ZeebeTaskHeaderEntry } from "./zeebe-extensions.js";

/** HTTP methods supported by the Camunda REST connector. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Authentication configuration for the REST connector. */
export type RestAuthentication = { type: "noAuth" } | { type: "bearer"; token: string };

/** Configuration for the REST connector convenience builder. */
export interface RestConnectorConfig {
	/** Display name for the task. */
	name?: string;
	/** HTTP method (GET, POST, PUT, PATCH, DELETE). */
	method: HttpMethod;
	/** Target URL — can be a literal string or a FEEL expression (prefix with `=`). */
	url: string;
	/** Authentication configuration. Defaults to `{ type: "noAuth" }`. */
	authentication?: RestAuthentication;
	/** HTTP headers as key-value pairs or a FEEL expression string. */
	headers?: Record<string, string> | string;
	/** Query parameters as a FEEL expression string or key-value pairs. */
	queryParameters?: Record<string, string> | string;
	/** Request body — a FEEL expression string or literal value. */
	body?: string;
	/** Connection timeout in seconds. Defaults to 20. */
	connectionTimeoutInSeconds?: number;
	/** Read timeout in seconds. Defaults to 20. */
	readTimeoutInSeconds?: number;
	/** Number of retries on failure. Defaults to "3". */
	retries?: string;
	/** Variable name to store the full response. */
	resultVariable?: string;
	/** FEEL expression to extract values from the response. */
	resultExpression?: string;
	/** Retry backoff duration (ISO 8601 duration, e.g. "PT0S"). */
	retryBackoff?: string;
}

const REST_CONNECTOR_TYPE = "io.camunda:http-json:1";
const DEFAULT_TIMEOUT = 20;
const DEFAULT_RETRIES = "3";

/** Convert a REST connector config into Zeebe IO mapping inputs. */
export function restConnectorToIoMappingInputs(config: RestConnectorConfig): ZeebeIoMappingEntry[] {
	const inputs: ZeebeIoMappingEntry[] = [];

	const auth = config.authentication ?? { type: "noAuth" };
	inputs.push({ source: auth.type, target: "authentication.type" });

	if (auth.type === "bearer") {
		inputs.push({ source: auth.token, target: "authentication.token" });
	}

	inputs.push({ source: config.method, target: "method" });
	inputs.push({ source: config.url, target: "url" });

	if (config.headers !== undefined) {
		const value =
			typeof config.headers === "string" ? config.headers : serializeFeelObject(config.headers);
		inputs.push({ source: value, target: "headers" });
	}

	if (config.queryParameters !== undefined) {
		const value =
			typeof config.queryParameters === "string"
				? config.queryParameters
				: serializeFeelObject(config.queryParameters);
		inputs.push({ source: value, target: "queryParameters" });
	}

	if (config.body !== undefined) {
		inputs.push({ source: config.body, target: "body" });
	}

	inputs.push({
		source: String(config.connectionTimeoutInSeconds ?? DEFAULT_TIMEOUT),
		target: "connectionTimeoutInSeconds",
	});

	inputs.push({
		source: String(config.readTimeoutInSeconds ?? DEFAULT_TIMEOUT),
		target: "readTimeoutInSeconds",
	});

	return inputs;
}

/** Get the Zeebe task definition type for REST connectors. */
export function restConnectorTaskType(): string {
	return REST_CONNECTOR_TYPE;
}

/** Get the default retries value for REST connectors. */
export function restConnectorRetries(config: RestConnectorConfig): string {
	return config.retries ?? DEFAULT_RETRIES;
}

/** Convert a REST connector config into Zeebe task header entries. */
export function restConnectorToTaskHeaders(config: RestConnectorConfig): ZeebeTaskHeaderEntry[] {
	const headers: ZeebeTaskHeaderEntry[] = [];

	if (config.resultVariable !== undefined) {
		headers.push({ key: "resultVariable", value: config.resultVariable });
	}

	if (config.resultExpression !== undefined) {
		headers.push({
			key: "resultExpression",
			value: config.resultExpression,
		});
	}

	if (config.retryBackoff !== undefined) {
		headers.push({ key: "retryBackoff", value: config.retryBackoff });
	}

	return headers;
}

/** Serialize a Record<string, string> into a FEEL context expression. */
function serializeFeelObject(obj: Record<string, string>): string {
	const entries = Object.entries(obj)
		.map(([key, value]) => `"${key}":"${value}"`)
		.join(", ");
	return `={${entries}}`;
}
