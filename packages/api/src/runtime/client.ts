import { resolveConfig } from "./config.js";
import { TypedEventEmitter } from "./events.js";
import { HttpClient } from "./http.js";
import type { CamundaClientConfig, CamundaClientInput, ClientEventMap } from "./types.js";

/**
 * Base class for CamundaClient. The generated subclass adds all resource
 * properties (processInstance, job, userTask, …).
 */
export class CamundaBaseClient extends TypedEventEmitter<ClientEventMap> {
	readonly http: HttpClient;
	/** The fully resolved configuration used by this client. */
	readonly config: CamundaClientConfig;

	constructor(input: CamundaClientInput = {}) {
		super();
		this.config = resolveConfig(input);
		this.http = new HttpClient(this.config, this);
	}

	/**
	 * Clears the in-memory response cache (if caching is enabled).
	 */
	clearCache(): void {
		this.http.cache?.clear();
	}
}

/**
 * Base class for all generated resource classes.
 */
export class ResourceBase {
	constructor(protected readonly _http: HttpClient) {}
}
