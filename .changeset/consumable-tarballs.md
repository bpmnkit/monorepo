---
"@bpmnkit/proxy": patch
"@bpmnkit/plugins": patch
"@bpmnkit/casen-report": patch
"@bpmnkit/casen-worker-ai": patch
"@bpmnkit/casen-worker-http": patch
---

Four packaging bugs found by opening the published tarballs and installing them.

- `proxy`: declared `exports["."].types` while `files` listed only `dist/**/*.js`, so the
  declarations were built and never packed. It now ships its `.d.ts` files.
- `plugins`: `dist/token-highlight/index.js` imported `./css` without an extension, which Node
  ESM does not resolve — `@bpmnkit/plugins/token-highlight` threw on import, and
  `@bpmnkit/operate` threw with it.
- `casen-worker-http` and `casen-worker-ai`: import `@bpmnkit/cli-sdk` and declared no
  dependencies at all, so npm never installed it and importing them failed.
- `casen-report`: the same undeclared `@bpmnkit/cli-sdk` in its `.d.ts`, plus an undeclared
  `@bpmnkit/api`, so its published types did not resolve.
