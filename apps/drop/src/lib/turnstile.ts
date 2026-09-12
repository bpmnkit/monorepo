/**
 * The one challenge a drop asks for: proving a claim came from a person.
 *
 * It sits on `claim` rather than on every op, and that placement is the whole
 * design. A human takes the baton once and edits for half an hour; a script
 * that wants to rewrite other people's drops has to pass a challenge for every
 * one it touches. Putting it on the op instead would be invisible to the
 * script — which batches anyway — and maddening for the person.
 *
 * Off unless {@link Env.TURNSTILE_SECRET} is set, so local development and a
 * self-hosted deployment need no Cloudflare account. Set the secret without the
 * site key and every claim fails: for a check whose job is to say no, a
 * half-configuration should fail closed rather than quietly disable itself.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

/** What `siteverify` answers. Only `success` is acted on; the rest is for logs. */
interface VerifyResponse {
	success: boolean
	"error-codes"?: string[]
}

/**
 * Asks Cloudflare whether a token is good.
 *
 * A network failure is *not* treated as a pass. The cost of failing closed is
 * that an outage stops people editing for as long as it lasts; the cost of
 * failing open is that anyone who can cause one can skip the check entirely.
 */
export async function verifyTurnstile(
	secret: string,
	token: string,
	remoteIp?: string,
): Promise<boolean> {
	if (!token) return false
	const body = new FormData()
	body.append("secret", secret)
	body.append("response", token)
	if (remoteIp) body.append("remoteip", remoteIp)

	try {
		const res = await fetch(VERIFY_URL, { method: "POST", body })
		if (!res.ok) return false
		const result = (await res.json()) as VerifyResponse
		return result.success === true
	} catch {
		return false
	}
}
