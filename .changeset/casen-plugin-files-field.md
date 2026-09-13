---
"@bpmnkit/casen-worker-http": patch
"@bpmnkit/casen-worker-ai": patch
"@bpmnkit/casen-report": patch
---

Give the three `casen-*` plugin packages a `files` field, so their tarballs contain the
build output their `exports` points at.

They were the only published packages without one. With no `files`, `pnpm pack` honours
the repo-root `.gitignore` — whose second line is `dist` — so the tarball shipped `src/`,
`tsconfig.json` and `.turbo/turbo-build.log` while omitting `dist/`. That failed
`check:consumable` with `exports["."] (types) points at "./dist/index.d.ts", not in the
tarball`, and since that step runs before `changesets/action`, it took the publish step
with it: release runs #132 and #133 released nothing at all.

The `files` array matches the other twenty packages, so the tarballs now carry `dist/`
and drop the source and build logs they had no reason to ship.
