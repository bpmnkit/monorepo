# Publishing to npm

How the twenty-six published `@bpmnkit/*` packages reach the registry: the automated
release flow, the gates in front of it, and the one-time setup behind it.

This document covers the full publish lifecycle: one-time setup, the automated release flow, and how npm provenance (trusted publishing) works.

---

## How it works

Releases are fully automated via [Changesets](https://github.com/changesets/changesets) and GitHub Actions. The flow has two stages:

```
PR merged to main
      │
      ▼
changesets/action detects changesets
      │
      ├─── Pending changesets → opens/updates "Version Packages" PR
      │         (bumps versions, updates CHANGELOG)
      │
      └─── No pending changesets, version PR merged → publishes to npm
```

Every merge to `main` triggers the `release.yml` workflow. The `changesets/action` decides what to do:

- **When changesets are present:** creates or updates a "Version Packages" PR that bumps `package.json` versions and updates `CHANGELOG.md`.
- **When the "Version Packages" PR is merged:** runs `pnpm release` which builds and publishes the package to npm with provenance attestation.

---

## First-time setup

### 1. The npm organization

Everything publishes under the [`@bpmnkit`](https://www.npmjs.com/org/bpmnkit) npm
organization, which already exists. A new package needs `publishConfig.access: "public"` in
its manifest — `check-packages.mjs` enforces that — and nothing else.

### 2. Create an npm Automation token

Provenance attestation requires authentication via a token even though the build provenance is verified via OIDC. Create a **Granular Access Token** (recommended over legacy tokens):

1. On npmjs.com → **Access Tokens** → **Generate New Token** → **Granular Access Token**
2. Set:
   - **Token name:** `github-actions-bpmnkit`
   - **Expiration:** 365 days (or your org policy)
   - **Packages and scopes:** Read and write access on the `@bpmnkit` scope
   - **Organizations:** no org permission needed
3. Copy the token

### 3. Add the token to GitHub Actions secrets

In the GitHub repository (`bpmnkit/monorepo`):

1. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `NPM_TOKEN`
3. Value: the token from step 2

### 4. Publishing a package for the first time

Nothing special is required. A new package publishes through the automated flow like any
other: add it to `scripts/published-packages.mjs`, give it a changeset, and merge the version
PR. Changesets publishes every non-private workspace package it has a version bump for,
whether or not the registry has seen it before.

---

## The gates in front of publish

`release.yml` runs these before `changesets/action`, and each one **skips the publish** if it
fails. That is deliberate — a bad tarball is worse than a late one — but it also means a red
release workflow publishes nothing at all and says so nowhere except the Actions tab. If a
merge to `main` did not produce a release, look there first.

| Step | What it catches |
|---|---|
| `pnpm build` | Anything that does not compile |
| `node scripts/sync-license.mjs` | A published package with no LICENSE |
| `node scripts/generate-readmes.mjs` | A hand-edited README about to be overwritten |
| `node scripts/check-packages.mjs` | Missing manifest metadata; a package at 1.0 that is not in `STABLE`; a package in `STABLE` with no tests or documentation page |
| `pnpm check:consumable` | A tarball missing a path its own `exports` declares, declarations that do not compile under `strict` + `NodeNext`, a surviving `workspace:` range |

The last one is the reason it exists: three packages once shipped with no `dist/` because they
had no `files` field, and the metadata checks could not see it. CI runs the fast half
(`--pack-only`) on every pull request; the release workflow runs the whole thing.

---

## Day-to-day workflow

### Adding a changeset (required for every release)

After making changes that should be released, create a changeset:

```bash
pnpm changeset
```

This interactive prompt asks:
- Which packages changed
- Bump type: `patch` (bug fix), `minor` (new feature), `major` (breaking change)
- A short summary of the change

Commit the generated `.changeset/*.md` file alongside your code changes.

### Merging and releasing

1. Open a PR with your changes + the changeset file
2. Merge the PR to `main`
3. The release workflow opens (or updates) a **"chore: version packages"** PR automatically
4. Review the version bump and CHANGELOG, then merge that PR
5. The release workflow runs again and publishes to npm

---

## npm Provenance (Trusted Publishing)

The release workflow is configured for **npm provenance**, which cryptographically links the published package to the exact GitHub Actions workflow run that built it.

### What it does

When `NPM_CONFIG_PROVENANCE=true` is set, npm publishes an [OIDC-based attestation](https://docs.npmjs.com/generating-provenance-statements) alongside the package. Consumers can verify:

- The package was built from `github.com/bpmnkit/monorepo`
- The exact git commit and workflow run that produced it
- The build was not tampered with between CI and the registry

This is visible on the npm package page as a **"Built and signed on GitHub Actions"** badge.

### Why `id-token: write`

The workflow has `permissions: id-token: write`. This allows GitHub Actions to request an OIDC token from GitHub's identity provider, which npm uses to create the provenance attestation. Without this permission, provenance attestation silently fails.

### Verifying provenance

Anyone can verify the provenance of a published package:

```bash
npm audit signatures
# or
npm install --dry-run @bpmnkit/core
```

Or via the npm web UI on the package's **Code** tab.

---

## Workflow permissions summary

| Permission | Why |
|---|---|
| `contents: write` | Changesets action creates version commits |
| `pull-requests: write` | Changesets action opens/updates the Version PR |
| `id-token: write` | npm provenance OIDC attestation |

---

## Troubleshooting

**"Package not found" on publish**
- The package name must match the `name` field in its `package.json`.
- Your token must have write access to the `@bpmnkit` scope.

**"You must be logged in" / 401 errors**
- Check the `NPM_TOKEN` secret is set in the repository's Actions secrets.
- Make sure the token has not expired and has write access to the `@bpmnkit` scope.

**Provenance attestation fails**
- Ensure `permissions: id-token: write` is present in the workflow job.
- The `registry-url: https://registry.npmjs.org` field in `setup-node` is required for the token to be picked up correctly.

**Changesets PR not created**
- Verify at least one `.changeset/*.md` file was committed to the branch before merging.
- Check the `GITHUB_TOKEN` has `pull-requests: write` permission (granted automatically by the job-level `permissions` block).
