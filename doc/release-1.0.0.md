# The road to 1.0.0

An assessment of what stands between this repo and a 1.0.0 its users can rely on.
Written against `53a9e25` (2026-09-13), with every claim below verified by running
the thing rather than reading about it. All five blockers have since been fixed; each
is kept here with what it was and how it was closed, because the reasoning is the part
worth keeping.

---

## What 1.0.0 actually promises

A 1.0.0 is not a quality badge. It is a **contract about breakage**: from that tag on,
a consumer can write `^1` in their `package.json` and trust that no upgrade inside
that range moves their code. Everything on this list follows from that one sentence.

The repo is closer than the version numbers suggest. The gap is almost entirely in
release engineering and in things the project has never written down — not in the
code.

---

## Where the repo stands

Verified on this branch with a full install, a Rust/wasm build and the whole pipeline:

| Check | Result |
|---|---|
| `pnpm -r build` | ✅ clean, 36 workspace projects |
| `pnpm -r typecheck` | ✅ zero errors |
| `pnpm lint` (Biome) | ✅ zero warnings |
| `pnpm -r test` | ✅ **2,499 tests across 20 packages**, all passing |
| `pnpm check:consumable --pack-only` | ✅ 26 packages (was 23, and failing — Blockers 1–3) |

Other things the sweep turned up, all of which argue *for* a 1.0:

- **The libraries are genuinely dependency-free.** Every published package has zero
  external runtime dependencies except `@bpmnkit/connector-gen` (`yaml`) and
  `@bpmnkit/proxy` (`better-sqlite3`, `imapflow`, `isolated-vm`, `nodemailer`).
- **The code is not carrying debt.** Across all published sources: **one** `TODO`
  and **two** `@deprecated` markers.
- **The roadmap is done.** 241 of 253 items are checked. Every one of the 12 open
  items is filed under an explicit *"Left open, deliberately"* heading — deferred
  features, or work needing DNS and third-party accounts. **None is a stability
  blocker.**
- `packages/core` alone carries 1,053 tests.

So the question is not "is the code ready". It is "is the *release* ready, and has
the project said what it is promising".

---

## Blockers

All five are now closed. What is left is on the list below it: decisions and coverage,
not defects.

### 1. The release pipeline is broken. Nothing has published for days. ✅ *(fixed)*

Release workflow runs **#132** and **#133** — the last two merges to `main` — both
failed at the *Check packages are consumable* step, which **skips the publish step
entirely**:

```
✗ @bpmnkit/casen-report:      exports["."] (types) points at "./dist/index.d.ts", not in the tarball
✗ @bpmnkit/casen-worker-http: exports["."] (types) points at "./dist/index.d.ts", not in the tarball
✗ @bpmnkit/casen-worker-ai:   exports["."] (types) points at "./dist/index.d.ts", not in the tarball
```

**Cause.** Those three were the only published packages with no `files` field. Without
one, `pnpm pack` honours the repo-root `.gitignore`, whose line 2 is `dist` — so the
tarball shipped `src/`, `tsconfig.json` and even `.turbo/turbo-build.log`, but not the
build output its own `exports` points at.

**Consequence.** Two changesets have been sitting unreleased on `main`:
`adhoc-tools-and-documentation.md` and `operate-design-system.md`. The `@bpmnkit/core`
fix for issues **#149** and **#150** is merged and **is not on npm**. Any 1.0.0 cut
today would fail the same way.

**Fixed.** One `files` line per package, matching the other twenty. `check:consumable`
went from three failures to `✓ 26 package(s) consumable.`

The live 0.1.x tarballs on npm are not broken (the real publish path uses `npm pack`,
which does not walk up to the root `.gitignore`), but they do ship source and build
logs. This change cleans that up too.

### 2. Three published packages bypass every release check ✅ *(fixed)*

`scripts/published-packages.mjs` is documented as the single list that
`sync-license.mjs`, `check-packages.mjs` and `check-package-consumable.mjs` all read.
Three non-private workspace packages are **on npm but absent from it**:

| Package | On npm | In `PUBLISHED` | `LICENSE` on disk | README |
|---|---|---|---|---|
| `@bpmnkit/cli-sdk` | 0.0.9 | ❌ | ❌ | generated |
| `@bpmnkit/user-tasks` | 0.0.21 | ❌ | ❌ | **hand-written** |
| `@bpmnkit/create-casen-plugin` | 0.0.9 | ❌ | ❌ | generated |

All three list `"LICENSE"` in their `files` array and **have no LICENSE file**, so
each ships to npm as MIT with no licence text. None is metadata-checked, and none has
ever had its tarball opened by the consumability check.

`@bpmnkit/user-tasks` additionally has a hand-written `README.md` and no entry in
`scripts/generate-readmes.mjs` — which `CLAUDE.md` forbids outright, because the next
generator run overwrites it.

**Fixed.** All three are in `PUBLISHED`, `user-tasks` has a generator entry, and the
scripts did the rest: `check-packages.mjs` and `check:consumable` now cover **26**
packages rather than 23, and all three have a LICENSE. The list also feeds
`scripts/generate-ecosystem.mjs`, so the same three were missing from bpmnkit.com's
package list and now appear there.

### 3. CI cannot see a packaging break ✅ *(fixed)*

`.github/workflows/ci.yml` runs build, typecheck, check and test. It does **not** run
`check:consumable` — that lives only in `release.yml`. This is exactly how Blocker 1
reached `main`: the PR was green, and the break only surfaced after merge, where it
silently stopped publishing.

The script's own header explains the omission (steps 3–5 install from the network,
one project per package — too slow for every PR). But `--pack-only` skips those steps
entirely, is offline, and runs in about a second.

**Fixed.** `ci.yml` gained a *Check packages are packable* step running
`pnpm check:consumable --pack-only`. The release workflow keeps the full check.

### 4. Sibling packages publish as exact pins ✅ *(fixed)*

Every internal dependency is `workspace:*`, which publishes as an **exact** version:

```
@bpmnkit/plugins@0.3.1 → { "@bpmnkit/core": "0.4.0", "@bpmnkit/editor": "0.2.0", … }
```

At 0.x that is defensible — everything releases in lockstep. At 1.0 it is a trap: a
consumer who upgrades `@bpmnkit/core` to `1.1.0` but not `@bpmnkit/plugins` gets
**two copies of core** in their tree, and `instanceof` checks, singletons and type
identity all quietly stop matching.

**Fixed.** 51 ranges across 16 published packages are now `workspace:^`, verified by
packing `@bpmnkit/plugins` and reading the manifest back: `"@bpmnkit/core": "^0.4.0"`.
The eight private apps keep `workspace:*` — they are never published, so the range has
no consumer to reach.

At 0.x a caret buys less than it looks like (`^0.4.0` admits only `0.4.x`), which is
exactly why it had to land *before* the tag rather than with it: at 1.0 the same ranges
become `^1.0.0` and start deduplicating, without the first stable release also being the
one that rewrites every manifest.

### 5. There is no stability policy, anywhere ✅ *(fixed)*

There is no page, in the repo or on bpmnkit.com, that says what semver means here —
what counts as breaking, what the support window is, what is public API and what is
internal. `README.md` still carries a **`status: experimental`** badge.

A 1.0.0 without that document is a number, not a promise.

**Fixed.** [`docs/getting-started/stability`][policy] now states the contract each package
takes on at 1.0.0, linked from `README.md` and indexed in docspack (191 → 198 chunks). It
answers:

- **What is public API** — what the `exports` entry points export, minus `@internal`.
  Deep `dist/` paths are not.
- **Generated documents** — the rule is `semanticHash`: a change is breaking when it moves
  the hash for the same input, and not when only the bytes move. That splits the cases
  cleanly, because the hash is already invariant under layout and formatting and *is*
  sensitive to element ids — all four invariants verified against the current build while
  writing the page. It also settles the `@bpmnkit/core` 0.4.0 precedent on the record:
  deriving element ids moved the hash for every document and shipped as a *minor*; under
  1.0 it is a major.
- **Type-level changes**, graded by direction — adding to a union the library *returns* is
  major (exhaustive switches stop compiling), adding to one it *accepts* is minor.
- **Formats outside the package** — the `.bpmn.tests.json` sidecar, on-disk profile
  storage, and the proxy's documented HTTP routes are contracts too.
- **Runtime support and how the floor moves** — dropping a Node major still in LTS is
  major, dropping one past end-of-life is minor.
- **Deprecation and the support window** — `@deprecated` first, at least one minor of
  overlap, removal only in a major; six months of security fixes on the previous major.

Writing it surfaced one contradiction to fix before the tag: `@bpmnkit/proxy` exports the
subpath `"./dist/aikit-mcp.js"`, which names a build path as public API on a page that says
`dist/` paths are not. It needs a real subpath name now rather than a break later.

[policy]: https://bpmnkit.com/docs/getting-started/stability
- What about the `.bpmn.tests.json` sidecar format, profile storage, and the proxy's
  HTTP surface? Each is a contract someone depends on.
- Node and browser support ranges.
- How deprecations work: what warning, for how long, before removal.

---

## Which packages should actually go to 1.0.0

Not all 26. A 1.0 on a package with no tests and no documentation is a promise the
project cannot keep. The honest bar is three questions: **does it have tests, does it
have a documentation page, and would you defend its API unchanged for a year?**

Measured against the first two:

**Ready — tests and docs both present:**
`core` (1,053 tests), `plugins` (257), `feel` (159), `editor` (131), `canvas` (79),
`cli` (73), `engine` (50), `api` (36), `docspack` (32), `connector-gen` (27),
`connectors` (56), `ascii` (23).

**Not ready — shipping with zero tests:**
`ui`, `profiles`, `operate` (36 source files, 0 tests), `astro-shared`, `patterns`,
`worker-client`, plus the three `casen-*` plugin examples.

**Undocumented** — 15 of the 23 listed packages have no page under
`apps/landing/src/content/docs/packages/`: `ui`, `plugins`, `feel`, `ascii`,
`profiles`, `operate`, `astro-shared`, `connectors`, `patterns`, `cli`, `proxy`,
`reebe-wasm` and the three `casen-*`. `@bpmnkit/plugins` and `@bpmnkit/feel` being on
that list is the surprise — both are large, mature, well-tested public API.

**Recommendation.** Cut 1.0.0 for the ready set and **leave the rest on 0.x on
purpose**. A mixed-version monorepo is normal and honest; a blanket 1.0 is neither.
The `casen-*` packages are worked examples and `create-casen-plugin` is a scaffolder —
they have no API to stabilise and should stay 0.x indefinitely.

---

## Should be done, but need not block the tag

- **`engines.node`** is declared on only 4 of 23 packages (`docspack`, `profiles`,
  `cli`, `proxy`). Every published package should state its floor, so npm warns
  instead of failing at runtime.
- **No guard on the public API surface.** With 74 export statements in
  `packages/core/src/index.ts` alone, a refactor can remove an export and every check
  in the repo stays green. A committed API snapshot, diffed in CI, turns "we broke
  someone" into a failing build.
- **`PUBLISHING.md` is stale** — it still tells the reader to create an
  **`@bpmn-sdk`** npm organisation and points at **`bpmn-sdk/monorepo`**. Both names
  are two rebrands old.
- **No `CONTRIBUTING.md`, `SECURITY.md` or `CODE_OF_CONDUCT.md`.** A 1.0 library with
  no security contact has nowhere for a reporter to go.
- **`@bpmnkit/proxy` needs a compiler to install** — `isolated-vm` and
  `better-sqlite3` are native modules, and a user without `node-gyp` sees the install
  fail hard (reproduced in this session). Either prebuild, make them optional, or
  document the prerequisite prominently.
- **`CHANGELOG.md` is missing from `apps/reebe-wasm`**, the only published package
  without one.
- **Release trigger is path-filtered.** `release.yml` fires only on pushes touching
  `.changeset/**`. It works, but it means a merge that forgets a changeset is
  indistinguishable from one that has nothing to release — and #170 already shipped
  without its changeset once.

---

## Not blockers

Recorded so they are not re-litigated:

- **The 12 unchecked roadmap items.** All are under explicit *"Left open,
  deliberately"* headings, or need DNS and third-party accounts. Deferred features do
  not block a stability promise.
- **The two `@deprecated` markers.** `ProcessBuilder.explicitJoins` and one connector
  template field. 1.0 is the natural moment to remove them, but keeping them costs
  nothing.
- **Version numbers looking small.** `@bpmnkit/feel` at 0.0.20 with 159 tests is a
  mature package with a timid version, not an immature one.

---

## Suggested order

1. ~~Fix the three `files` fields~~ — **done in this change**; the pipeline is unblocked.
2. Merge, and confirm the pending changesets actually publish.
3. ~~Add `--pack-only` to CI so this cannot recur.~~ — **done**
4. ~~Add the three missing packages to `PUBLISHED`; regenerate licences and READMEs.~~ — **done**
5. ~~Switch internal deps to `workspace:^`.~~ — **done**
6. ~~Write the stability policy. Publish it on bpmnkit.com and link it from `README.md`.~~ — **done**
7. Decide the 1.0 set; write docs pages for `plugins` and `feel` at minimum.
   **This is now the critical path** — everything below is mechanical once it is settled.
8. Rename the `@bpmnkit/proxy` `./dist/aikit-mcp.js` subpath.
9. Add `engines.node` everywhere; refresh `PUBLISHING.md`; add `SECURITY.md`.
10. Cut 1.0.0 with a single changeset, and drop the `experimental` badge.
