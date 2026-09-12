// One-shot provisioning + deploy for @bpmnkit/drop on Cloudflare.
//
// Idempotent: creates the D1 database (if missing), applies migrations, builds
// the client, deploys the Worker, and sets the secrets. Auto-generates the
// admin token and the IP-hash salt; prompts you for the optional AI_PASSCODE and
// for Turnstile, which challenges the edit claim. Re-running skips whatever
// already exists.
//
//   node scripts/provision.mjs          (or: pnpm --filter @bpmnkit/drop provision)
//
// Prerequisites: `wrangler` on PATH and `wrangler login` already done.
import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const configPath = resolve(appDir, "wrangler.jsonc")
const DB_NAME = "bpmnkit-drop"

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = async (q) => (await rl.question(q)).trim().toLowerCase()

function log(msg) {
	console.log(`\n\x1b[1m▸ ${msg}\x1b[0m`)
}

// Run wrangler and capture stdout; throws on non-zero exit.
function capture(args) {
	const r = spawnSync("wrangler", args, { cwd: appDir, encoding: "utf8" })
	if (r.error) throw r.error
	if (r.status !== 0) throw new Error(r.stderr || `wrangler ${args.join(" ")} failed`)
	return r.stdout
}

// Run wrangler wired to the terminal (for prompts, progress, hidden secret input).
function interactive(args, opts = {}) {
	const r = spawnSync("wrangler", args, { cwd: appDir, stdio: "inherit", ...opts })
	if (r.error) throw r.error
	if (r.status !== 0) throw new Error(`wrangler ${args.join(" ")} exited with ${r.status}`)
}

/** Whoami's output, kept so the account id can be lifted out of it later. */
let whoami = ""

function ensureLoggedIn() {
	log("Checking Cloudflare login")
	const r = spawnSync("wrangler", ["whoami"], { cwd: appDir, encoding: "utf8" })
	if (r.error || r.status !== 0) {
		console.error("Not logged in to Cloudflare. Run `wrangler login` first.")
		process.exit(1)
	}
	whoami = r.stdout
	process.stdout.write(r.stdout)
}

/** The account id, from whoami's table. Null when it cannot be read out. */
function accountId() {
	return /\b([0-9a-f]{32})\b/.exec(whoami)?.[1] ?? null
}

function ensureDatabase() {
	log(`Ensuring D1 database "${DB_NAME}"`)
	const byName = () => JSON.parse(capture(["d1", "list", "--json"])).find((d) => d.name === DB_NAME)
	let db = byName()
	if (db) {
		console.log(`  found existing database (${db.uuid})`)
	} else {
		capture(["d1", "create", DB_NAME])
		db = byName()
		console.log(`  created database (${db?.uuid})`)
	}
	const id = db?.uuid
	if (!id) throw new Error("could not determine the D1 database id")

	const cfg = readFileSync(configPath, "utf8")
	if (cfg.includes("REPLACE_WITH_D1_DATABASE_ID")) {
		writeFileSync(configPath, cfg.replace("REPLACE_WITH_D1_DATABASE_ID", id))
		console.log("  wrote database_id into wrangler.jsonc")
	} else if (!cfg.includes(id)) {
		console.log("  note: wrangler.jsonc already pins a different database_id (keeping it)")
	}
}

async function maybeEnableRoute() {
	const old =
		'\t\t"crons": ["17 3 * * *"]\n\t}\n' +
		"\t// The bpmnkit.com zone is on Cloudflare; this route carves /drop* out of the\n" +
		"\t// Pages-hosted landing site. Uncomment and set the zone once deploying.\n" +
		'\t// "routes": [{ "pattern": "bpmnkit.com/drop*", "zone_name": "bpmnkit.com" }]\n}'
	const cfg = readFileSync(configPath, "utf8")
	if (!cfg.includes(old)) return // already enabled, or the template changed

	log("Custom domain route")
	const yes = await ask(
		"Route bpmnkit.com/drop* to this Worker? Needs that zone on your account [y/N]: ",
	)
	if (yes !== "y" && yes !== "yes") {
		console.log("  skipping — the Worker will be reachable at its *.workers.dev URL")
		return
	}
	const next =
		'\t\t"crons": ["17 3 * * *"]\n\t},\n' +
		'\t"routes": [{ "pattern": "bpmnkit.com/drop*", "zone_name": "bpmnkit.com" }]\n}'
	writeFileSync(configPath, cfg.replace(old, next))
	console.log("  enabled the route in wrangler.jsonc")
}

function applyMigrations() {
	log("Applying D1 migrations (remote)")
	interactive(["d1", "migrations", "apply", DB_NAME, "--remote"])
}

/**
 * Deploys, and reads the Worker's address out of what wrangler prints.
 *
 * Captured rather than streamed because the URL is the one thing the rest of
 * this script needs and there is no other reliable way to ask for it — the
 * shape of `wrangler deployments list` moves between versions. The output is
 * printed either way, so nothing is hidden.
 */
function deploy() {
	const r = spawnSync("wrangler", ["deploy"], { cwd: appDir, encoding: "utf8" })
	if (r.error) throw r.error
	const output = `${r.stdout ?? ""}${r.stderr ?? ""}`
	process.stdout.write(output)
	if (r.status !== 0) throw new Error("wrangler deploy failed")

	const workersDev = /https:\/\/\S+\.workers\.dev/.exec(output)?.[0]
	const route = /\b([\w.-]+\.\w+)\/drop\*/.exec(output)?.[1]
	return route ? `https://${route}` : (workersDev ?? null)
}

function buildAndDeploy() {
	log("Building client bundles")
	const build = spawnSync("pnpm", ["turbo", "build", "--filter", "@bpmnkit/drop"], {
		cwd: appDir,
		stdio: "inherit",
	})
	if (build.status !== 0) throw new Error("build failed")

	log("Deploying Worker")
	return deploy()
}

/**
 * Asks the deployment to prove it is alive before calling any of this done.
 *
 * Three requests, each covering a different half of the stack: the stats
 * endpoint reads D1, the demo page is served from memory and renders the
 * viewer, and the asset is what the browser actually loads. A green "done"
 * that never touched the thing it deployed is not worth printing.
 */
async function smokeTest(baseUrl) {
	if (!baseUrl) {
		console.log("  could not work out the Worker URL — check it by hand")
		return
	}
	const checks = [
		["D1 + Worker", `${baseUrl}/drop/api/stats`],
		["demo page", `${baseUrl}/drop/demo-loan-approval`],
		["client bundle", `${baseUrl}/drop/assets/viewer.js`],
	]
	for (const [what, url] of checks) {
		try {
			const res = await fetch(url, { redirect: "follow" })
			const mark = res.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"
			console.log(`  ${mark} ${what} — ${res.status} ${url}`)
		} catch (err) {
			console.log(`  \x1b[31m✗\x1b[0m ${what} — ${err.message}`)
		}
	}
}

function putSecret(name, value) {
	const r = spawnSync("wrangler", ["secret", "put", name], {
		cwd: appDir,
		input: value,
		encoding: "utf8",
	})
	if (r.status !== 0) throw new Error(r.stderr || `failed to set ${name}`)
}

async function configureSecrets() {
	log("Configuring secrets")
	const have = new Set(JSON.parse(capture(["secret", "list"])).map((s) => s.name))

	let adminToken = null
	if (have.has("DROP_ADMIN_TOKEN")) {
		console.log("  DROP_ADMIN_TOKEN already set — keeping it")
	} else {
		adminToken = randomBytes(32).toString("hex")
		putSecret("DROP_ADMIN_TOKEN", adminToken)
		console.log("  DROP_ADMIN_TOKEN generated and set")
	}

	if (have.has("REPORT_IP_SALT")) {
		console.log("  REPORT_IP_SALT already set — keeping it")
	} else {
		putSecret("REPORT_IP_SALT", randomBytes(32).toString("hex"))
		console.log("  REPORT_IP_SALT generated and set")
	}

	if (have.has("AI_PASSCODE")) {
		console.log(
			"  AI_PASSCODE already set — keeping it (rotate later with `wrangler secret put AI_PASSCODE`)",
		)
	} else {
		const yes = await ask("Enable the closed-beta AI review now by setting AI_PASSCODE? [y/N]: ")
		if (yes === "y" || yes === "yes") {
			console.log("  enter the access code when wrangler prompts (input is hidden):")
			interactive(["secret", "put", "AI_PASSCODE"])
		} else {
			console.log("  skipped — AI review stays off until you set AI_PASSCODE")
		}
	}
	return { adminToken, existing: have }
}

// ── Turnstile ────────────────────────────────────────────────────────────────

const SITE_KEY_RE = /"TURNSTILE_SITE_KEY":\s*"([^"]*)"/

/** The site key currently pinned in wrangler.jsonc, or null. */
function readSiteKey(cfg) {
	return SITE_KEY_RE.exec(cfg)?.[1] ?? null
}

/** Pins a site key in the `vars` block, replacing one already there. */
function writeSiteKey(cfg, key) {
	if (SITE_KEY_RE.test(cfg)) return cfg.replace(SITE_KEY_RE, `"TURNSTILE_SITE_KEY": "${key}"`)
	const anchor = '"AI_DAILY_BUDGET": "8000"'
	if (!cfg.includes(anchor)) throw new Error("could not find the vars block in wrangler.jsonc")
	return cfg.replace(anchor, `${anchor},\n\t\t"TURNSTILE_SITE_KEY": "${key}"`)
}

/**
 * Sets up the challenge on the edit claim.
 *
 * A drop is editable by anyone with the link, so this is the thing standing
 * between that and a script rewriting every drop it can find. It is optional
 * because local development and self-hosting should need no Cloudflare account,
 * but for a public deployment you want it on.
 *
 * The order matters and is the reason this runs after the first deploy rather
 * than before it: `wrangler secret put` needs the Worker to exist, and the
 * secret is what enforces. Publishing the site key first would leave a window
 * where the page shows a challenge and the room ignores it — so the secret goes
 * in, then the key, then a second deploy.
 */
async function configureTurnstile(secretsAlreadySet) {
	log("Turnstile (challenges the edit claim)")
	const cfg = readFileSync(configPath, "utf8")
	const existingKey = readSiteKey(cfg)

	if (secretsAlreadySet.has("TURNSTILE_SECRET") && existingKey) {
		console.log(`  already configured (site key ${existingKey}) — keeping it`)
		return false
	}
	if (secretsAlreadySet.has("TURNSTILE_SECRET") && !existingKey) {
		console.log("  \x1b[33mTURNSTILE_SECRET is set but no site key is pinned.\x1b[0m")
		console.log("  Every claim will fail until you add one. Enter it now to fix that.")
	}

	console.log("  Create a widget at https://dash.cloudflare.com → Turnstile.")
	console.log("  Leave blank to skip: editing then works with no challenge at all.")
	const key = (await rl.question("  Turnstile site key: ")).trim()
	if (!key) {
		console.log("  skipped — claims are not challenged")
		return false
	}

	console.log("  enter the Turnstile *secret* key when wrangler prompts (input is hidden):")
	interactive(["secret", "put", "TURNSTILE_SECRET"])

	writeFileSync(configPath, writeSiteKey(readFileSync(configPath, "utf8"), key))
	console.log("  pinned TURNSTILE_SITE_KEY in wrangler.jsonc")
	return true
}

// ── GitHub Actions ───────────────────────────────────────────────────────────

/**
 * Puts the two repository secrets the deploy workflow needs into GitHub.
 *
 * Without these, `.github/workflows/deploy-drop.yml` runs and fails on every
 * push — which is a worse state than not having CI at all, because it looks
 * like it is working. Offered only when `gh` is available and authenticated,
 * since this is the one step that touches a system other than Cloudflare.
 *
 * The API token itself cannot be minted from here: Cloudflare's API will not
 * issue a scoped token without one that already has permission to. So this asks
 * for it, and prints the exact scopes to give it.
 */
async function configureCiSecrets() {
	const gh = spawnSync("gh", ["auth", "status"], { encoding: "utf8" })
	if (gh.error || gh.status !== 0) return // no gh, or not logged in — not this script's business

	log("GitHub Actions secrets (for the deploy workflow)")
	const yes = await ask("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_DROP_API_TOKEN now? [y/N]: ")
	if (yes !== "y" && yes !== "yes") {
		console.log("  skipped — `.github/workflows/deploy-drop.yml` will fail until they are set")
		return
	}

	const id = accountId() ?? (await rl.question("  Cloudflare account id: ")).trim()
	if (id) {
		const r = spawnSync("gh", ["secret", "set", "CLOUDFLARE_ACCOUNT_ID", "--body", id], {
			stdio: "inherit",
		})
		if (r.status === 0) console.log("  CLOUDFLARE_ACCOUNT_ID set")
	}

	console.log("\n  Create a token at https://dash.cloudflare.com/profile/api-tokens with:")
	console.log("    Account → D1 → Edit")
	console.log("    Account → Workers Scripts → Edit")
	console.log("    Zone (bpmnkit.com) → Workers Routes → Edit")
	const token = (await rl.question("  Paste it (blank to skip): ")).trim()
	if (!token) {
		console.log("  skipped — set CLOUDFLARE_DROP_API_TOKEN yourself before relying on CI")
		return
	}
	const r = spawnSync("gh", ["secret", "set", "CLOUDFLARE_DROP_API_TOKEN", "--body", token], {
		stdio: "inherit",
	})
	if (r.status === 0) console.log("  CLOUDFLARE_DROP_API_TOKEN set")
}

async function main() {
	ensureLoggedIn()
	ensureDatabase()
	applyMigrations()
	await maybeEnableRoute()
	let url = buildAndDeploy()
	const { adminToken, existing } = await configureSecrets()
	const turnstileAdded = await configureTurnstile(existing)

	// `secret put` takes effect on its own; a `vars` entry only ships with a
	// deploy, so this is here for the site key and nothing else.
	if (turnstileAdded) {
		log("Deploying again, to publish the Turnstile site key")
		url = deploy() ?? url
	}

	await configureCiSecrets()

	log("Checking the deployment answers")
	await smokeTest(url)

	log("Done")
	if (url) console.log(`Drop is live at ${url}/drop`)
	if (turnstileAdded) console.log("Editing is challenged with Turnstile.")
	else console.log("\x1b[33mEditing is NOT challenged — anyone with a link can edit.\x1b[0m")
	if (adminToken) {
		console.log("\n\x1b[33mSave your admin token now — it is shown only once:\x1b[0m")
		console.log(`  DROP_ADMIN_TOKEN = ${adminToken}`)
		console.log("Use it to log in at /drop/admin.")
	}
	if (url) console.log(`\nDemo drop: ${url}/drop/demo-loan-approval`)
}

try {
	await main()
} finally {
	rl.close()
}
