---
"@bpmnkit/proxy": patch
---

`@bpmnkit/proxy` now depends on `@types/node` and its declarations reference it. `createProxyServer` and `listenProxy` return `http.Server`, so a TypeScript consumer without Node's types in scope could not compile against the package.
