import { CamundaAuthError } from "./errors.js";
import { buildTokenCacheKey, resolveTokenStore } from "./token-cache.js";
import type { AuthConfig, TokenStore } from "./types.js";

export interface AuthProvider {
	/** Returns a value for the Authorization header, or null if not applicable. */
	getAuthorizationHeader(): Promise<string | null>;
	/** Called after a 401 to allow token refresh. Returns true if a retry may succeed. */
	handleUnauthorized(): Promise<boolean>;
}

export class NoAuthProvider implements AuthProvider {
	async getAuthorizationHeader(): Promise<null> {
		return null;
	}
	async handleUnauthorized(): Promise<boolean> {
		return false;
	}
}

export class BearerAuthProvider implements AuthProvider {
	constructor(private token: string) {}

	async getAuthorizationHeader(): Promise<string> {
		return `Bearer ${this.token}`;
	}

	async handleUnauthorized(): Promise<boolean> {
		return false;
	}
}

export class BasicAuthProvider implements AuthProvider {
	#encoded: string;

	constructor(username: string, password: string) {
		this.#encoded = btoa(`${username}:${password}`);
	}

	async getAuthorizationHeader(): Promise<string> {
		return `Basic ${this.#encoded}`;
	}

	async handleUnauthorized(): Promise<boolean> {
		return false;
	}
}

interface TokenResponse {
	access_token: string;
	expires_in?: number;
}

export class OAuth2Provider implements AuthProvider {
	#clientId: string;
	#clientSecret: string;
	#tokenUrl: string;
	#scope?: string;
	#audience?: string;
	/** In-memory token for the current process. */
	#memoryToken: string | null = null;
	#memoryExpiresAt = 0;
	/** Persistent store (file / custom). */
	#store: TokenStore;
	#cacheKey: string;
	/** Deduplicates concurrent refresh calls. */
	#refreshing: Promise<string> | null = null;
	#onRefresh?: () => void;

	constructor(
		clientId: string,
		clientSecret: string,
		tokenUrl: string,
		scope?: string,
		audience?: string,
		store?: TokenStore,
		onRefresh?: () => void,
	) {
		this.#clientId = clientId;
		this.#clientSecret = clientSecret;
		this.#tokenUrl = tokenUrl;
		this.#scope = scope;
		this.#audience = audience;
		this.#store = store ?? resolveTokenStore(undefined); // default: FileTokenStore
		this.#cacheKey = buildTokenCacheKey(clientId, tokenUrl, scope, audience);
		this.#onRefresh = onRefresh;
	}

	async getAuthorizationHeader(): Promise<string> {
		const token = await this.#getToken();
		return `Bearer ${token}`;
	}

	async handleUnauthorized(): Promise<boolean> {
		// Invalidate both in-memory and persistent cache so next call fetches fresh
		this.#memoryToken = null;
		this.#memoryExpiresAt = 0;
		await this.#store.set(this.#cacheKey, { accessToken: "", expiresAt: 0 });
		return true;
	}

	async #getToken(): Promise<string> {
		// 1. Check in-memory token first (fastest path)
		if (this.#memoryToken && Date.now() < this.#memoryExpiresAt - 30_000) {
			return this.#memoryToken;
		}

		// 2. Check persistent store
		const cached = await this.#store.get(this.#cacheKey);
		if (cached?.accessToken) {
			this.#memoryToken = cached.accessToken;
			this.#memoryExpiresAt = cached.expiresAt;
			return cached.accessToken;
		}

		// 3. Fetch a new token — deduplicate concurrent calls
		if (this.#refreshing) {
			return this.#refreshing;
		}
		this.#refreshing = this.#fetchToken().finally(() => {
			this.#refreshing = null;
		});
		return this.#refreshing;
	}

	async #fetchToken(): Promise<string> {
		this.#onRefresh?.();

		const params = new URLSearchParams({
			grant_type: "client_credentials",
			client_id: this.#clientId,
			client_secret: this.#clientSecret,
		});
		if (this.#scope) params.set("scope", this.#scope);
		if (this.#audience) params.set("audience", this.#audience);

		const response = await fetch(this.#tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});

		if (!response.ok) {
			throw new CamundaAuthError(
				`OAuth2 token request failed: ${response.status}`,
				response.status,
				await response.text(),
				this.#tokenUrl,
			);
		}

		const data = (await response.json()) as TokenResponse;
		const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;

		// Update in-memory state
		this.#memoryToken = data.access_token;
		this.#memoryExpiresAt = expiresAt;

		// Persist to store (fire and forget — failure is non-fatal)
		this.#store.set(this.#cacheKey, {
			accessToken: data.access_token,
			expiresAt,
		});

		return data.access_token;
	}
}

export function createAuthProvider(
	config: AuthConfig,
	store?: TokenStore,
	onRefresh?: () => void,
): AuthProvider {
	switch (config.type) {
		case "bearer":
			return new BearerAuthProvider(config.token);
		case "basic":
			return new BasicAuthProvider(config.username, config.password);
		case "oauth2":
			return new OAuth2Provider(
				config.clientId,
				config.clientSecret,
				config.tokenUrl,
				config.scope,
				config.audience,
				store,
				onRefresh,
			);
		case "none":
			return new NoAuthProvider();
	}
}
