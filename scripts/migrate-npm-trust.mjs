/**
 * Moves the npm trusted-publishing configuration of every published package
 * from the old GitHub repository to the new one. One-off, for the rename of
 * bpmnkit/monorepo to bpmnkit/bpmnkit — see doc/repo-rename.md.
 *
 * The registry allows one trust configuration per package, so the old one has
 * to be revoked before the new one can be created. A package whose current
 * configuration does not name the old repository is left alone and reported.
 *
 *   node scripts/migrate-npm-trust.mjs           # dry run: list and plan
 *   node scripts/migrate-npm-trust.mjs --apply   # revoke + create
 *
 * Needs npm >= 11.15.0, `npm login` as an owner of the @bpmnkit packages, and
 * account-level 2FA (allow "skip 2FA for 5 minutes" on npmjs.com for the run).
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { PUBLISHED } from "./published-packages.mjs"

const OLD_REPO = "bpmnkit/monorepo"
const NEW_REPO = "bpmnkit/bpmnkit"
const WORKFLOW = "release.yml"
const apply = process.argv.includes("--apply")

function npm(args) {
	return execFileSync("npm", args, { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] })
}

/** `npm trust list --json` output's shape is undocumented: accept one entry or a list. */
function configs(name) {
	const out = npm(["trust", "list", name, "--json"]).trim()
	if (!out) return []
	const parsed = JSON.parse(out)
	return Array.isArray(parsed) ? parsed : [parsed]
}

const failed = []
for (const dir of PUBLISHED) {
	const { name } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
	try {
		const current = configs(name)
		const old = current.filter((c) => JSON.stringify(c).includes(OLD_REPO))
		const migrated = current.some((c) => JSON.stringify(c).includes(NEW_REPO))
		console.log(`\n${name}\n  current: ${JSON.stringify(current)}`)

		if (migrated) {
			console.log(`  already trusts ${NEW_REPO} — skipping`)
			continue
		}
		if (current.length > 0 && old.length === 0) {
			console.log(`  ! configuration does not name ${OLD_REPO} — left alone, check by hand`)
			failed.push(name)
			continue
		}

		for (const c of old) {
			console.log(`  revoke ${c.id}`)
			if (apply) npm(["trust", "revoke", name, `--id=${c.id}`])
		}
		const create = [
			"trust",
			"github",
			name,
			`--repo=${NEW_REPO}`,
			`--file=${WORKFLOW}`,
			"--allow-publish",
			"--yes",
		]
		console.log(`  npm ${create.join(" ")}`)
		if (apply) npm(create)
	} catch (error) {
		console.error(`  ! ${name}: ${error.message}`)
		failed.push(name)
	}
}

console.log(apply ? "\nDone." : "\nDry run — nothing changed. Re-run with --apply.")
if (failed.length > 0) {
	console.error(`Needs attention: ${failed.join(", ")}`)
	process.exit(1)
}
