# Contributing

Bug reports, feature requests, documentation fixes and pull requests are all welcome. This
page is the practical detail; the short version lives in the [README](README.md).

Security problems are the exception — do not open an issue or a pull request for one. See
[SECURITY.md](SECURITY.md).

## Where to start

Issues labelled [`good first issue`](https://github.com/bpmnkit/monorepo/labels/good%20first%20issue)
are scoped to one package, have a known cause, and say how to verify the fix. If none are open,
these are real, small gaps, each with a pointer to where the change goes:

| Area | Task | Where |
|---|---|---|
| Renderer | Label styles (`BPMNLabelStyle` fonts) are parsed and kept, but labels render in the default font | `packages/canvas` |
| Linting | Six bpmnlint rules marked *approximate* check only the top level, not inside sub-processes | `packages/core/src/bpmn/bpmnlint.ts`, [compatibility table](https://bpmnkit.com/docs/guides/bpmnlint) |
| Simulator | A terminate end event inside a sub-process ends the whole instance; BPMN says it ends only that sub-process | `packages/engine/src/instance.ts` |
| Markdown | The same diagram twice on one page produces duplicate SVG ids | `packages/markdown` |
| Operate | Route keys are put into `/api/...` URLs without `encodeURIComponent` | `packages/operate/src` |
| Examples | `apps/examples` has five type errors against the current APIs | `apps/examples/src` |

Comment on the issue (or open one) before starting something larger than these, so two people
do not build the same thing. A pull request that fixes one row, with a regression test, is a
complete contribution.

## Who maintains what

BPMN Kit has one maintainer of record today, [@urbanisierung](https://github.com/urbanisierung),
for every area. That is a known risk. If you want to co-maintain an area — a package, the
Reebe engine, the docs — say so in an issue; a few merged pull requests in that area is the
usual way in.

## Getting set up

You need **Node.js 20 LTS or newer** and **pnpm 12.4.1**. The `packageManager` pin cannot
bootstrap itself for this version, so install pnpm before the first install — `corepack enable`
or `npm install -g pnpm@12.4.1`.

```sh
pnpm bootstrap    # pnpm install, then builds the Rust/WebAssembly engine
```

`pnpm bootstrap` needs a Rust toolchain, the `wasm32-unknown-unknown` target and `wasm-pack`,
because `@bpmnkit/engine` type-checks against the generated `@bpmnkit/reebe-wasm` declarations.
`pnpm install` on its own is enough for anything that does not touch the engine.

## The loop

```sh
pnpm verify       # build, typecheck, lint and test — everything CI runs
```

Narrower, while you work:

```sh
pnpm turbo build --filter @bpmnkit/core
pnpm --filter @bpmnkit/core test
pnpm format       # Biome, writing fixes
```

All four must pass before a pull request is ready. There are no warnings to triage: the bar is
zero type errors and zero Biome findings.

## Reebe tests

`pnpm verify` runs the Rust tests of the Reebe engine (`apps/reebe`) through its `test` script,
but without a database the Postgres suites skip themselves. The `Reebe` workflow runs them
against PostgreSQL when a pull request touches `apps/reebe/**`, and once a week. To run them
locally:

```sh
docker run -d --rm --name reebe-test-pg -p 5432:5432 \
  -e POSTGRES_USER=reebe -e POSTGRES_PASSWORD=reebe -e POSTGRES_DB=reebe postgres:16-alpine
REEBE_DATABASE__URL=postgres://reebe:reebe@localhost:5432/reebe REEBE_REQUIRE_DB=1 \
  cargo test --manifest-path apps/reebe/Cargo.toml --workspace
```

Without `REEBE_DATABASE__URL` the Postgres tests skip themselves. `REEBE_REQUIRE_DB=1` makes
them fail instead, as CI does. Each test creates its own `reebe_test_*` database, so use a
throwaway server like the container above. The Reebe workspace is not yet clean under
`cargo fmt --check` or `cargo clippy -D warnings`, so CI does not run either.

## Changesets

**Every change that affects a published package needs a changeset**, or it never reaches npm:

```sh
pnpm changeset
```

Pick the packages and the bump, then write the description as release notes rather than as a
commit message — it lands verbatim in that package's `CHANGELOG.md`, where the reader has no
idea what the pull request was about.

[Stability and Versioning](https://bpmnkit.com/docs/getting-started/stability) decides which
bump. The two that catch people out:

- **A generated BPMN, DMN or Form document counts.** If the same input produces a different
  `semanticHash`, that is a major — element ids and structure included. A change that only
  moves layout coordinates or whitespace is not.
- **Types count.** Adding a member to a union the library *returns* breaks an exhaustive
  `switch`, so it is a major; adding one to a union it *accepts* is a minor.

Docs-only and internal changes need no changeset.

## Generated files

Several things in this repo are generated. Editing the output means the next build silently
reverts you.

| Do not edit | Edit instead |
|---|---|
| Any published package's `README.md` | `scripts/generate-readmes.mjs` |
| The root `README.md` | `scripts/generate-readmes.mjs` |
| Any package's `LICENSE` | the root `LICENSE`, then `node scripts/sync-license.mjs` |
| `apps/landing/src/generated/*` | `scripts/generate-ecosystem.mjs` |
| `packages/docspack/.llms/`, `llms.txt` | the docs, then `pnpm --filter @bpmnkit/docspack build` |

After changing anything under `apps/landing/src/content/docs/`, rebuild the docs pack so its
offline index does not go stale.

## Adding a published package

`CLAUDE.md` has the full checklist. In short: required `package.json` metadata, an entry in
`scripts/generate-readmes.mjs`, the path added to `scripts/published-packages.mjs`, then run
`sync-license.mjs`, `generate-readmes.mjs` and `check-packages.mjs`, and check the tarball with
`pnpm check:consumable --filter <package>`.

A package joins the 1.0 stability set by being added to `STABLE` in the same file — but only
once it has a test suite that would catch its own breakage, a documentation page, and an API
worth defending for a year. `check-packages.mjs` enforces the first two, and will fail if a
package reaches 1.0.0 without being on the list.

## Documentation

Docs live in `apps/landing/src/content/docs/<section>/`. Dropping a Markdown file in puts it in
the sidebar, the search index and the prev/next pager — `sidebar.order` in the front matter
positions it.

Write examples you have run. Several pages in this repo have documented an API that could not
work, for years, because the snippet was written from memory rather than from a terminal.

## Improving a translation

The editor's languages live in `packages/editor/src/locales/<code>.ts`, one file each. They
were drafted with machine help, so a native speaker's correction is one of the most useful
pull requests you can open.

- **Change the value, never the key.** A key is the English text the UI asks for. Changing
  one silently orphans the string, and the tests will fail.
- **Keep every `{placeholder}` exactly as it is.** You can move it within the sentence.
- **Use the BPMN terms your language already uses** — the names in Camunda Modeler and in the
  OMG specification's translations ("Gateway", "Ereignis", "Aufgabe" and "Teilprozess" in
  German). A literal translation that nobody uses is worse than a borrowed English word
  that everyone does.
- **Plurals** are objects with one entry for each form your language has, selected by
  `Intl.PluralRules` (Polish has `one`, `few`, `many` and `other`, for example).
- **Check the length in context.** German and Polish often run long. Run the editor
  (`pnpm --filter @bpmnkit/landing dev`, then open `/editor`), choose your language in the
  main menu, and look at the properties panel, the palette and the menus.

`pnpm --filter @bpmnkit/editor test` checks that every locale has every key, the same
placeholders, and every plural form. When the UI gains a string, the harvest tests list
it in `packages/editor/i18n/en.json` or `packages/plugins/i18n/en.json`
(`UPDATE_I18N=1 pnpm --filter @bpmnkit/editor test`, and the same for plugins). The
locales then fail until the string is translated in each of them. For a language you do not
speak, add the English text and mention it in the pull request.

## Pull requests

Keep the diff to what the change needs. Adjacent cleanups, reformatting and drive-by
refactors make a change hard to review and hard to revert; if you find something unrelated and
broken, say so in the pull request rather than fixing it in passing.

Explain *why* in the description. The diff already says what.
