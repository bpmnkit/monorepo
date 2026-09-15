---
"@bpmnkit/casen-report": patch
"@bpmnkit/casen-worker-http": patch
"@bpmnkit/casen-worker-ai": patch
---

The three casen plugin packages declare `files[]`, so their tarballs carry `dist`

The plugins were the only published packages without a `files` field. Without one the
tarball falls back to the ignore rules, and the root `.gitignore` excludes `dist` — so
every path the manifest pointed at should have vanished. `dist/index.js` survived anyway,
because npm always packs whatever `main` names, which left a package that imports fine and
ships no declarations at all: `exports["."].types` pointed at a `dist/index.d.ts` that was
never in the tarball.

It stayed invisible while pnpm 10 packed these ignored files regardless. pnpm 12 (#172)
does not, and the release workflow's `check:consumable` step has failed on every push to
`main` since — which is why the changesets from #173, #176 and #179 were never versioned or
published. The three packages now list the same `files[]` every other package does, so the
tarballs carry `dist/**/*.js` and `dist/**/*.d.ts` and drop the `src` and `tsconfig.json`
they had been shipping by accident.

`check-packages.mjs` now requires `files[]` rather than only checking its contents when it
happened to exist, so the same gap fails in CI instead of after the merge.
