# Publishing `@bpmnkit/core` to npm

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

### 1. Create the npm package scope

If `@bpmn-sdk` does not exist as an npm organization yet:

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Go to **Organizations** → **Create Organization** → use `bpmn-sdk`
3. The package `@bpmnkit/core` will publish under this org

### 2. Create an npm Automation token

Provenance attestation requires authentication via a token even though the build provenance is verified via OIDC. Create a **Granular Access Token** (recommended over legacy tokens):

1. On npmjs.com → **Access Tokens** → **Generate New Token** → **Granular Access Token**
2. Set:
   - **Token name:** `github-actions-bpmn-sdk`
   - **Expiration:** 365 days (or your org policy)
   - **Packages and scopes:** Read and write access on `@bpmnkit/core`
   - **Organizations:** no org permission needed
3. Copy the token

### 3. Add the token to GitHub Actions secrets

In the GitHub repository (`bpmn-sdk/monorepo`):

1. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `NPM_TOKEN`
3. Value: the token from step 2

### 4. Publish the package for the first time

The changesets action will not publish a package that has never been published before without a version bump changeset. For the initial publish:

```bash
# Make sure you're on main and everything is built
pnpm install
pnpm build

# Publish manually the first time
cd packages/core
npm publish --access public
```

Or trigger it through the automated flow by creating a changeset and merging the Version PR (see below).

---

## Day-to-day workflow

### Adding a changeset (required for every release)

After making changes that should be released, create a changeset:

```bash
pnpm changeset
```

This interactive prompt asks:
- Which packages changed (`@bpmnkit/core`)
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
- The package name `@bpmnkit/core` must match the `name` field in `packages/core/package.json`.
- The npm org `bpmn-sdk` must exist and your token must have write access.

**"You must be logged in" / 401 errors**
- Check the `NPM_TOKEN` secret is set in the repository's Actions secrets.
- Make sure the token has not expired and has write access to `@bpmnkit/core`.

**Provenance attestation fails**
- Ensure `permissions: id-token: write` is present in the workflow job.
- The `registry-url: https://registry.npmjs.org` field in `setup-node` is required for the token to be picked up correctly.

**Changesets PR not created**
- Verify at least one `.changeset/*.md` file was committed to the branch before merging.
- Check the `GITHUB_TOKEN` has `pull-requests: write` permission (granted automatically by the job-level `permissions` block).
