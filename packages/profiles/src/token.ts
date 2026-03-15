import type { AuthConfig, CamundaClientInput } from "@bpmnkit/api"

// Simple in-memory token cache keyed by clientId
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/**
 * Returns an Authorization header value for the given client config.
 * Returns an empty string for `auth.type === "none"` or if auth is unset.
 *
 * For OAuth2, tokens are cached in memory and refreshed 60 seconds before expiry.
 */
export async function getAuthHeader(config: CamundaClientInput): Promise<string> {
	const auth: AuthConfig | undefined = config.auth
	if (!auth || auth.type === "none") return ""

	if (auth.type === "bearer") return `Bearer ${auth.token}`

	if (auth.type === "basic") {
		const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64")
		return `Basic ${encoded}`
	}

	if (auth.type === "oauth2") {
		const token = await fetchOAuth2Token(
			auth.clientId,
			auth.clientSecret,
			auth.tokenUrl,
			auth.audience,
			auth.scope,
		)
		return `Bearer ${token}`
	}

	return ""
}

async function fetchOAuth2Token(
	clientId: string,
	clientSecret: string,
	tokenUrl: string,
	audience?: string,
	scope?: string,
): Promise<string> {
	const cached = tokenCache.get(clientId)
	if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

	const body = new URLSearchParams({
		grant_type: "client_credentials",
		client_id: clientId,
		client_secret: clientSecret,
	})
	if (audience) body.set("audience", audience)
	if (scope) body.set("scope", scope)

	const res = await fetch(tokenUrl, {
		method: "POST",
		body,
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
	})
	if (!res.ok) {
		throw new Error(`OAuth2 token request failed: ${res.status} ${res.statusText}`)
	}

	const json = (await res.json()) as { access_token: string; expires_in?: number }
	const expiresIn = json.expires_in ?? 3600
	tokenCache.set(clientId, { token: json.access_token, expiresAt: Date.now() + expiresIn * 1000 })
	return json.access_token
}
