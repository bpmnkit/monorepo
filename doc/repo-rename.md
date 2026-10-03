# Renaming `bpmnkit/monorepo` to `bpmnkit/bpmnkit`

Runbook for the repository rename. The code side is one PR: every live reference to
`github.com/bpmnkit/monorepo` now points at `github.com/bpmnkit/bpmnkit`. The parts that a PR
cannot do — the rename itself and npm trusted publishing — are below, in the order to do them.

## Why the order matters

npm trusted publishing is tied to the repository by name. When `release.yml` publishes, npm
checks two things against the GitHub OIDC token of the run:

1. the package's **trust configuration** names that repository and workflow file, and
2. the package's **`repository.url`** in `package.json` matches that repository (provenance).

Both flip at different moments: (1) when the npm commands run, (2) when this PR merges, and
the token itself changes the moment the repository is renamed. Between the rename and the end
of step 4, **any publish fails**. Nothing is lost by that — the publish just does not happen —
but keep the window short and keep releases out of it.

`release.yml` only runs on pushes to `main` that touch `.changeset/**`. This PR carries no
changeset, so merging it does not start a release.

## What carries over on its own

GitHub redirects the old name — web URLs, `git clone`/`fetch`/`push`, the API — as long as
nobody creates a new repository called `bpmnkit/monorepo`. **Never do that**; it breaks every
redirect at once. Issues, PRs, stars, Actions secrets and variables, branch protection,
environments, the Pages custom domain (`bpmnkit.com`) and the MCP registry name
(`io.github.bpmnkit/bpmnkit`, which is keyed by owner only) all stay as they are.

Old links in CHANGELOGs, `doc/progress.md`, `docs/superpowers/plans/`, the demo recordings and
the earlier `doc/migration-bpmnkit.md` were left unchanged on purpose: they are historical
records and the redirect keeps them working.

## Steps

### 0. Before — prepare (any time)

- [ ] npm CLI **11.15.0 or newer**: `npm --version` (`npm i -g npm@latest` otherwise).
- [ ] `npm login` as an owner of the `@bpmnkit` packages; account-level 2FA must be on.
- [ ] Dry run, and keep the output as a record of the current configuration:
      ```sh
      node scripts/migrate-npm-trust.mjs | tee npm-trust-before.txt
      ```
      Each package should show one configuration naming `bpmnkit/monorepo` and
      `release.yml`. A package flagged `! configuration does not name bpmnkit/monorepo`
      needs a look by hand before going further.
- [ ] This PR is green and approved, ready to merge.

### 1. Freeze releases

- [ ] Do not merge the **"chore: version packages"** PR or any PR that adds a `.changeset/*.md`
      until step 5.
- [ ] Check the Actions tab: no `Release` run is in progress.

### 2. Rename the repository

- [ ] GitHub → `bpmnkit/monorepo` → **Settings** → **General** → **Repository name** →
      `bpmnkit` → **Rename**.

### 3. Merge this PR — right after the rename

- [ ] Merge it. Doing it after the rename means the new URLs it introduces never point at a
      repository that does not exist yet; the old ones keep working through the redirect.
- [ ] The deploy workflows (landing, drop, learn, demo, studio) run on merge and publish the
      site with the new GitHub links. No release runs.

### 4. Move npm trusted publishing to the new repository

The registry allows only one trust configuration per package, so each package's old one is
revoked and a new one created. The script does that for all packages in
`scripts/published-packages.mjs`:

- [ ] On npmjs.com, enable **"skip two-factor authentication for the next 5 minutes"** (or be
      ready to enter OTPs) — there are 29 packages and two writes each.
- [ ] Run it:
      ```sh
      node scripts/migrate-npm-trust.mjs --apply
      ```
- [ ] Run the dry run again; every package should now say `already trusts bpmnkit/bpmnkit`.

Per package, the script does exactly what you would by hand:

```sh
npm trust list '@bpmnkit/core' --json
npm trust revoke '@bpmnkit/core' --id='<old-trust-id>'
npm trust github '@bpmnkit/core' \
  --repo='bpmnkit/bpmnkit' \
  --file='release.yml' \
  --allow-publish \
  --yes
```

The workflow file is `release.yml` (not `publish.yml`), and the release job has no
`environment:`, so no `--env` is needed. If the before-record from step 0 shows an environment
or a different file for some package, create that one by hand with the matching flags.

If the script stops part-way, re-run it: packages already done are skipped.

### 5. Unfreeze and verify with a real release

- [ ] Merge the next changeset / "chore: version packages" PR as usual.
- [ ] The `Release` run publishes. On npmjs.com, a released package's page shows
      "Built and signed on GitHub Actions" with the source `github.com/bpmnkit/bpmnkit`.
- [ ] `Publish to the MCP Registry` runs after it and lists the new repository URL from
      `apps/cli/server.json`.

If a publish fails with a provenance or `404 / not authorized` error, compare
`npm trust list <pkg> --json` with the run's repository and workflow file, and the package's
`repository.url`.

### 6. Everything outside the repository

- [ ] Local clones: `git remote set-url origin https://github.com/bpmnkit/bpmnkit.git`
      (the redirect works meanwhile, but don't rely on it).
- [ ] Cloudflare: if any Pages project or Worker is connected to the repository through the
      dashboard's Git integration, check it follows the rename (deploys from Actions are
      unaffected).
- [ ] Anything else that names the repository: the npm org page, social profiles, the VS Code
      Marketplace listing (updates with the next `release-vscode.yml` run), bookmarks.
- [ ] Claude Code plugin users who added the marketplace with
      `/plugin marketplace add github:bpmnkit/monorepo` keep working through the redirect; new
      instructions say `github:bpmnkit/bpmnkit`.
- [ ] Delete `npm-trust-before.txt` once the first release from the new name has gone out.
