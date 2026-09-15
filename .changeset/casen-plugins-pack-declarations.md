---
"@bpmnkit/casen-report": patch
"@bpmnkit/casen-worker-http": patch
"@bpmnkit/casen-worker-ai": patch
---

The three casen plugins ship their `dist/`, and stop shipping their sources

None of them declared `files`, so packing fell back to the ignore rules — and the root
`.gitignore` ignores `dist`. npm always includes the file named in `main` whatever the
ignores say, so `dist/index.js` was packed and the rest of the build was not: no
`dist/index.d.ts` for the `exports["."].types` each manifest declares, and for
`casen-report` no `dist/report.js` or `dist/commands/*.js` either, which is every module
its entry point imports. `src/` and `tsconfig.json` were packed in their place.

Each now lists `"files": ["LICENSE", "README.md", "dist/**/*.js", "dist/**/*.d.ts"]`, the
same line every other published package in the workspace carries.
