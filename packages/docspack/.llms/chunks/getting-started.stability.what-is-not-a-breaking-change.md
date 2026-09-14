# Stability and Versioning — What is not a breaking change

- Adding a feature, an export, an entry point, or an optional parameter.
- Fixing a bug so behaviour matches its documentation. If you relied on the bug, this can
  still move under you; it is a patch, and the changelog will say what changed.
- Performance, internal structure, dependency versions inside a compatible range.
- Anything about layout, formatting or diagram interchange that leaves `semanticHash` alone.
- Documentation, READMEs, or the contents of `@bpmnkit/docspack`.


## Runtime support

The supported runtimes are listed under
[Runtime Requirements](/docs/getting-started/installation#runtime-requirements): Node.js 20
LTS and newer, Deno 1.40+, Bun 1.0+, and browsers supporting ES2022. Every package is
**ESM-only** — there is no CommonJS build, and there will not be one.

Raising the floor follows the runtime's own lifecycle:

- Dropping a Node.js major that is **still in LTS** is a **major**.
- Dropping one that has reached **end of life** is a **minor**, called out in the release notes.
- Raising the browser baseline past ES2022 is a **major**.

---
Source: https://bpmnkit.com/docs/getting-started/stability
