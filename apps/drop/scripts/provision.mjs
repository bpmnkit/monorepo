// One-shot provisioning + deploy for @bpmnkit/drop on Cloudflare.
//
// Idempotent: creates the D1 database (if missing), applies migrations, builds
// the client, deploys the Worker, and sets the secrets. Auto-generates the
// admin token and the IP-hash salt; prompts you for the optional AI_PASSCODE.
// Re-running skips whatever already exists.
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

function ensureLoggedIn() {
	log("Checking Cloudflare login")
	const r = spawnSync("wrangler", ["whoami"], { cwd: appDir, encoding: "utf8" })
	if (r.error || r.status !== 0) {
		console.error("Not logged in to Cloudflare. Run `wrangler login` first.")
		process.exit(1)
	}
	process.stdout.write(r.stdout)
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

function buildAndDeploy() {
	log("Building client bundles")
	const build = spawnSync("pnpm", ["turbo", "build", "--filter", "@bpmnkit/drop"], {
		cwd: appDir,
		stdio: "inherit",
	})
	if (build.status !== 0) throw new Error("build failed")

	log("Deploying Worker")
	interactive(["deploy"])
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
	return adminToken
}

async function main() {
	ensureLoggedIn()
	ensureDatabase()
	applyMigrations()
	await maybeEnableRoute()
	buildAndDeploy()
	const adminToken = await configureSecrets()

	log("Done")
	console.log("The Worker is deployed. Its URL is printed in the deploy output above.")
	if (adminToken) {
		console.log("\n\x1b[33mSave your admin token now — it is shown only once:\x1b[0m")
		console.log(`  DROP_ADMIN_TOKEN = ${adminToken}`)
		console.log("Use it to log in at /drop/admin.")
	}
	console.log("\nDemo drop: <worker-url>/drop/demo-loan-approval")
}

try {
	await main()
} finally {
	rl.close()
}
