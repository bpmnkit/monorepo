# Migration: `@bpmn-sdk/*` → `@bpmnkit/*`

Renaming the GitHub org to `bpmnkit` and the npm scope from `@bpmn-sdk` to `@bpmnkit`.

---

## Overview

**15 published packages** moving to the `@bpmnkit` npm scope.
**6 private packages** renamed for internal consistency.
**Release stack:** Changesets + GitHub Actions + npm provenance (OIDC).

---

## Execution order

```
Phase 0  Verify CI is green on branding branch
Phase 1  Create @bpmnkit npm org + automation token   [npmjs.com UI]
Phase 2  Rename GitHub org + update secret            [GitHub UI]
Phase 3  Run migration script                         [automated]
Phase 4  Merge changeset PR → auto-publish            [GitHub UI]
Phase 5  Run deprecation script                       [npm CLI]
Phase 6  Update Cloudflare Pages                      [CF dashboard]
```

---

## Phase 0 — Pre-flight

- Confirm CI is green.
- Confirm you have admin rights on the `bpmn-sdk` GitHub org and `@bpmn-sdk` npm org.
- Close or merge any open "chore: version packages" PR before proceeding.

---

## Phase 1 — Create `@bpmnkit` npm org & token

**a. Create the npm org**

1. Log in to [npmjs.com](https://www.npmjs.com)
2. **Organizations** → **Create Organization** → name: `bpmnkit`
3. Set visibility to public

**b. Create an org-scoped Automation token**

1. npmjs.com → Profile → **Access Tokens** → **Generate New Token** → **Granular Access Token**
2. Settings:
   - **Name:** `github-actions-bpmnkit`
   - **Expiration:** 365 days
   - **Packages and scopes:** All packages under `@bpmnkit` — Read and write
3. Copy the token (used in Phase 2c)

> The current setup uses a per-package token scoped to `@bpmn-sdk/core` only.
> A single org-scoped token covers all 15 `@bpmnkit/*` packages without per-package config.

---

## Phase 2 — Rename GitHub org

**a. Rename the org**

1. github.com → `bpmn-sdk` org → **Settings** → **Rename organization** → `bpmnkit`
2. GitHub auto-redirects all `github.com/bpmn-sdk/*` URLs for 12 months.

**b. Update your local git remote**

```bash
git remote set-url origin https://github.com/bpmnkit/monorepo.git
```

**c. Update the `NPM_TOKEN` GitHub secret**

1. github.com/bpmnkit/monorepo → **Settings** → **Secrets and variables** → **Actions**
2. Update `NPM_TOKEN` to the token from Phase 1b

---

## Phase 3 — Run the migration script

```bash
node scripts/migrate-to-bpmnkit.mjs
```

**What it does:**

1. Replaces `@bpmn-sdk/` → `@bpmnkit/` in every source file, package.json, workflow, and doc
2. Updates `repository.url` fields in package.json files (GitHub org rename)
3. Updates `.changeset/config.json` repo reference
4. Runs `pnpm install` to regenerate the lockfile
5. Runs `pnpm biome check --write` to fix any line-length formatting from the substitution
6. Runs `pnpm run verify` to confirm everything passes

**Files processed:**

| Pattern | What changes |
|---|---|
| `**/package.json` | `name`, `dependencies`, `peerDependencies`, `repository.url` |
| `**/*.ts`, `**/*.tsx` | import/export paths |
| `**/*.astro`, `**/*.mjs`, `**/*.js` | import paths, display text |
| `**/*.yml` | `--filter` flags in Turbo commands |
| `**/*.md` | install instructions, package references |
| `.changeset/config.json` | `repo` field |

**Excluded:**

- `node_modules/**`
- `dist/**`, `build/**`
- `target/**` (Rust build artifacts)
- `.git/**`

---

## Phase 4 — First publish under `@bpmnkit`

After Phase 3 is merged to main:

**a. Create a changeset for the breaking rename**

```bash
pnpm changeset
# Select all 15 published packages
# Bump type: major
# Summary: "Renamed from @bpmn-sdk/* to @bpmnkit/*. Update your imports."
```

**b. Commit and push** — the release workflow opens a "chore: version packages" PR automatically.

**c. Merge the version PR** — the release workflow publishes all 15 `@bpmnkit/*` packages with provenance.

> If publishing for the first time manually:
> ```bash
> pnpm install && pnpm build
> pnpm changeset publish
> ```

---

## Phase 5 — Deprecate old `@bpmn-sdk/*` packages

After `@bpmnkit/*` is live:

```bash
node scripts/deprecate-old-packages.mjs
```

Adds an npm deprecation warning to every version of every `@bpmn-sdk/*` package:

```
Renamed to @bpmnkit/X. See https://bpmnkit.com
```

Old packages remain installable; users see the warning on `npm install`.

---

## Phase 6 — Update Cloudflare Pages

Two Pages projects need their GitHub source updated:

| Project | Old source | Action |
|---|---|---|
| `bpmn-sdk-landing` | `bpmn-sdk/monorepo` | Update source to `bpmnkit/monorepo` in CF dashboard |
| `bpmnkit-docs` | `bpmn-sdk/monorepo` | Update source to `bpmnkit/monorepo` in CF dashboard |

Also consider renaming the `bpmn-sdk-landing` Cloudflare project to `bpmnkit-landing` for consistency.

---

## Risk map

| Risk | Mitigation |
|---|---|
| Existing users break on `@bpmn-sdk/*` | Deprecation notice; old versions remain installable |
| npm provenance breaks on first `@bpmnkit` publish | OIDC subject changes on org rename; ensure `NPM_TOKEN` is updated before publish |
| GitHub org redirect expires (12 months) | Update `github.com/bpmn-sdk` in external docs before expiry |
| Open changeset PR conflicts with migration | Close/merge any open version PR before Phase 3 |
| Lockfile has old names after rename | `pnpm install` in migration script regenerates it |

---

## Published packages being renamed

| Old name | New name |
|---|---|
| `@bpmn-sdk/core` | `@bpmnkit/core` |
| `@bpmn-sdk/canvas` | `@bpmnkit/canvas` |
| `@bpmn-sdk/editor` | `@bpmnkit/editor` |
| `@bpmn-sdk/ui` | `@bpmnkit/ui` |
| `@bpmn-sdk/plugins` | `@bpmnkit/plugins` |
| `@bpmn-sdk/engine` | `@bpmnkit/engine` |
| `@bpmn-sdk/feel` | `@bpmnkit/feel` |
| `@bpmn-sdk/api` | `@bpmnkit/api` |
| `@bpmn-sdk/ascii` | `@bpmnkit/ascii` |
| `@bpmn-sdk/profiles` | `@bpmnkit/profiles` |
| `@bpmn-sdk/operate` | `@bpmnkit/operate` |
| `@bpmn-sdk/astro-shared` | `@bpmnkit/astro-shared` |
| `@bpmn-sdk/connector-gen` | `@bpmnkit/connector-gen` |
| `@bpmn-sdk/cli` | `@bpmnkit/cli` |
| `@bpmn-sdk/proxy` | `@bpmnkit/proxy` |
