---
title: Stability and Versioning
description: What a version number promises — what counts as a breaking change, what is public API, and how long each release is supported.
sidebar:
  order: 4
---

## What this page is for

A version number is a promise about breakage. This page says exactly which promise BPMN Kit
makes, so you can decide what to write in your `package.json` and know what an upgrade can
do to you.

Every package follows [Semantic Versioning 2.0.0](https://semver.org). The rest of this page
is the part semver leaves open: what counts as *the API* in a toolkit that also emits XML
files, writes state to disk and speaks HTTP.

## What is covered today

The promises below take effect for a given package **when it reaches 1.0.0**. Twelve packages
do — they are listed at the end of this page. A package still on 0.x is **not** covered by
them, even though other packages in the workspace are: under semver, 0.x makes no
compatibility promise at all. Releases of those have been additive in practice, but *in
practice* is not a contract, so pin an exact version if one of them matters to you.

## Product tiers

Every product BPMN Kit ships is in one of three tiers. The tier says how much you can rely
on it. Each README and each package page on this site shows it.

| Tier | What it promises |
|---|---|
| **Core** | The promises on this page, from 1.0: nothing breaks without a major release. Core is exactly the twelve packages at 1.0. |
| **Tools** | Maintained: bugs are fixed and releases continue. Versions are 0.x, so a minor release can break. Pin a version. |
| **Experimental** | May change a lot or be discontinued. Not for production. Always below 1.0. |

- **Core:** `@bpmnkit/core`, `@bpmnkit/canvas`, `@bpmnkit/editor`, `@bpmnkit/plugins`,
  `@bpmnkit/engine`, `@bpmnkit/feel`, `@bpmnkit/api`, `@bpmnkit/ascii`, `@bpmnkit/docspack`,
  `@bpmnkit/connector-gen`, `@bpmnkit/connectors`, `@bpmnkit/cli`.
- **Tools:** BPMN Kit for VS Code, Drop, `@bpmnkit/proxy` (the MCP server, `casen proxy mcp`),
  `@bpmnkit/markdown`, `@bpmnkit/camunda-docspack`, `@bpmnkit/patterns`,
  `@bpmnkit/worker-client`, `@bpmnkit/cli-sdk`, `@bpmnkit/create-casen-plugin`,
  `@bpmnkit/casen-report`, `@bpmnkit/casen-worker-http`, `@bpmnkit/casen-worker-ai`, and the
  shared plumbing `@bpmnkit/ui`, `@bpmnkit/profiles` and `@bpmnkit/astro-shared`.
- **Experimental:** Reebe, `@bpmnkit/reebe-wasm`, `@bpmnkit/operate`, `@bpmnkit/user-tasks`,
  Studio, the Desktop app and proxy-rs.

Reebe is a dev/test engine: use it on your machine and in CI, not in production. The
`@bpmnkit/engine/wasm-runner` entry point is part of a Core package, so its API is covered,
but the Reebe engine it runs is Experimental and its behaviour can change in any release.

The tiers live in `TIER` and `APPS` in
[`scripts/published-packages.mjs`](https://github.com/bpmnkit/monorepo/blob/main/scripts/published-packages.mjs).
The repo's checks fail if a published package has no tier, if Core differs from the packages
at 1.0, or if an Experimental product reaches 1.0.

## Versions are per package, not per repo

Packages version independently. `@bpmnkit/core` reaching 2.0.0 does not make
`@bpmnkit/canvas` 2.0.0, and the two can sit many majors apart.

Sibling dependencies are declared as carets, so `@bpmnkit/plugins` depending on
`^1.2.0` of `@bpmnkit/core` resolves to one shared copy alongside your own `^1.4.0`.
Two copies of `@bpmnkit/core` in one tree is not a duplicate of one copy — class identity,
`instanceof` and module-level registries all stop matching across the seam — so keep BPMN Kit
packages within one major of each other.

Releases are cut by [Changesets](https://github.com/changesets/changesets). Every change that
reaches npm has a changeset naming its packages and its bump, and lands in that package's
`CHANGELOG.md`.

## What counts as public API

**The public API of a package is what its `exports` entry points export, minus anything
marked `@internal`.** Nothing else.

```ts
import { Bpmn } from "@bpmnkit/core"            // ✅ API
import { minimap } from "@bpmnkit/plugins/minimap" // ✅ API — a declared subpath
```

These are **not** API, and may change in any release:

| Not API | Why |
|---|---|
| Deep paths into `dist/` | An implementation layout, not an entry point |
| Members marked `/** @internal */` | Reachable from the `.d.ts` because TypeScript has no other way to say "not yours" — `ProcessBuilder` carries several |
| Anything reachable only by structural inference | If you cannot import it by name from an entry point, it is not named in the contract |
| `src/` in the repo | The published package is the artifact; the repository is not |

Each package's entry points are listed in its `exports` map. `@bpmnkit/plugins` is the one to
watch: it has **no root export**, only 34 subpaths, one per plugin.

**For a package whose product is a command**, `exports` says nothing — `@bpmnkit/cli` has none
at all. Its public API is instead its **documented commands**: the command and flag names, the
meaning of its exit codes, and the shape of any `--format json` output. Prose written to a
terminal for a human to read is not API, and neither is the exact wording of an error.

For a package that renders UI, the **rendered DOM and its class names are not API** either.
Style through the documented CSS custom properties; a panel's internal markup can change in a
minor.

## What is a breaking change

### Runtime behaviour

Breaking: removing or renaming an export or an entry point; removing a function parameter or
making an optional one required; throwing where a value used to be returned; changing a
documented default.

### Types

Type-level breakage is real breakage: a build that no longer compiles is a broken build. The
direction matters, and it is the opposite for things we hand you and things you hand us.

| Change | Verdict |
|---|---|
| Adding an export, or a new entry point | minor |
| Adding an **optional** property to an options object | minor |
| Adding a member to a union we **accept** | minor |
| Adding a member to a union we **return** | **major** — your exhaustive `switch` stops compiling |
| Adding a **required** property to anything you construct | **major** |
| Making a returned property optional | **major** — you now have to narrow it |
| Narrowing a return type | **major** |
| Widening a parameter type | minor |
| Renaming an exported type | **major**, even when the shape is identical |

### Generated BPMN, DMN and Form documents

This is the promise that matters most here, and the one a general semver policy has nothing
to say about. The rule is:

> **A change is breaking if it moves `semanticHash` for the same input. A change to the bytes
> alone is not.**

`semanticHash` is BPMN Kit's canonical, presentation-free projection of a model, and it is
exported for exactly this purpose. Verified against the current build:

| Property | Holds |
|---|---|
| The same input rebuilt produces the same hash | ✅ |
| `applyAutoLayout` does not move it | ✅ |
| Renaming an element moves it | ✅ |
| Changing an element **id** moves it | ✅ |

So, concretely:

- **Major** — different element ids, a changed document structure, a different default
  attribute on an emitted element, a changed FEEL expression. Anyone diffing generated files
  in review, or deploying them by id, sees these.
- **Minor or patch** — different layout coordinates, different attribute order, different
  whitespace, a nicer waypoint route. The picture moved; the model did not.

For the avoidance of doubt about precedent: `@bpmnkit/core` 0.4.0 derived element ids from the
model instead of generating them randomly. That moved `semanticHash` for every document, and
shipped as a *minor*. Under this policy it is a major, and 0.x is the only reason it was not.

### Formats outside the package

These are contracts even though no TypeScript signature describes them, and the same rule
applies — a change that makes an existing file, store or caller stop working is major:

- The **`.bpmn.tests.json` sidecar** read by `casen test` and the runner's Tests tab.
- **Profile storage on disk** — `~/.config/casen` on Linux, `~/Library/Application Support/casen`
  on macOS, `%APPDATA%\casen` on Windows. A format change must migrate existing profiles, not
  invalidate them.
- The **`@bpmnkit/proxy` HTTP surface**, for the routes the documentation names.
- **Element template validation** — a template that validates today does not start failing in
  a minor.

## What is not a breaking change

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

## Deprecation

Nothing that is public API disappears without warning.

1. It is marked `@deprecated` in the type declarations, naming what to use instead. Your editor
   and your build show it; nothing breaks.
2. It keeps working for **at least one minor release**, and is listed in the changelog entry
   that deprecated it.
3. It is removed only in a major, and the major's release notes list every removal.

An alias kept purely for compatibility is documented as such — `ProcessBuilder`'s `strict`
option is the existing example, a deprecated alias for `explicitJoins`.

## Support window

Fixes land on the **latest minor of the current major**. When a new major ships, the previous
major gets security fixes for **six months**; other fixes require an upgrade.

Security issues should be reported through
[GitHub](https://github.com/bpmnkit/monorepo/issues) rather than in a public pull request.

## Which packages this covers

A package is covered by this page once it is at **1.0.0 or above**, and not before. The
distinction is deliberate: several packages are published, useful, and not yet ready to freeze
an API — shipping them as 1.0 to make the list tidy would be a promise the project could not
keep. Joining later costs nothing, because going from 0.x to 1.0 breaks no one, so the bar is
applied strictly rather than generously.

Three conditions, all of which must hold:

1. **A test suite that would catch its own breakage.**
2. **A documentation page** on this site.
3. **An API worth defending for a year.**

**Twelve packages** meet them today and carry the promise:

| | |
|---|---|
| [`@bpmnkit/core`](/docs/packages/core) | [`@bpmnkit/feel`](/docs/packages/feel) |
| [`@bpmnkit/canvas`](/docs/packages/canvas) | [`@bpmnkit/editor`](/docs/packages/editor) |
| [`@bpmnkit/engine`](/docs/packages/engine) | [`@bpmnkit/plugins`](/docs/packages/plugins) |
| [`@bpmnkit/api`](/docs/packages/api) | [`@bpmnkit/ascii`](/docs/packages/ascii) |
| [`@bpmnkit/connectors`](/docs/packages/connectors) | [`@bpmnkit/connector-gen`](/docs/packages/connector-gen) |
| [`@bpmnkit/docspack`](/docs/packages/docspack) | [`@bpmnkit/cli`](/docs/cli/casen) |

The other sixteen published packages stay on 0.x on purpose, and make no semver promise;
their [tier](#product-tiers) says what they do promise. Most are
short of the first two conditions; the rest are worked examples, scaffolders, or generated
builds with no API of their own to freeze.

The membership is not only prose. It lives in `STABLE` in
[`scripts/published-packages.mjs`](https://github.com/bpmnkit/monorepo/blob/main/scripts/published-packages.mjs),
and the repo's own checks enforce both directions of it: nothing on the list may lack tests or
a documentation page, and nothing at 1.0.0 or above may be missing from the list. A major
version cannot arrive by accident.

Whatever this page says, a package's current version on
[npm](https://www.npmjs.com/org/bpmnkit) is the authoritative answer.
