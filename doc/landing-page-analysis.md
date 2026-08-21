# BPMN Kit — Landing Page Analysis & Improvement Plan

> **Purpose:** a hand-off plan for an implementing agent (Sonnet). Nothing here is
> implemented yet. The landing page (`apps/landing/src/pages/index.astro` →
> bpmnkit.com) was audited from four lenses — **Developer**, **Architect**,
> **Business visitor**, and a **technical QA sweep** (bugs / a11y / SEO / perf) —
> with every factual claim cross-checked against the real packages in this
> monorepo and the live site (fetched 2026-07-08).
>
> **Goal:** make the landing page *perfect*: engaging, credible, and instantly
> understandable for all three audiences — without diluting its developer-first
> identity.
>
> **How to use this doc:** Part A is the findings catalog (what's wrong and why it
> matters). Part B is the implementation plan — phased, with concrete files,
> exact edits, and a *verify* check per step, per `CLAUDE.md`. Part C lists items
> that need a maintainer decision or upstream work and must NOT be silently
> implemented.

---

## 0. TL;DR — the five themes

1. **Trust-killing factual errors.** The page claims "DMN 2.0 XML" (no such spec
   exists — the SDK emits DMN 1.3), "Zero Dependencies" (npm shows
   `@bpmnkit/core` depends on `@bpmnkit/feel`), and "22 type guards" (the code
   exports 29). The exact audience this page targets is the audience that will
   catch all three.
2. **Code samples that don't work.** The flagship "fully typed" API example
   calls `client.process.deploy(...)` — an API surface that doesn't exist — and
   Quickstart step 3 crashes if copy-pasted. The quickstart also presents the
   experimental *simulation* engine as production "Deploy & run"; the word
   "simulation" appears nowhere on the homepage.
3. **Real functional bugs.** The "BPMN with DMN + Form" tab's live preview never
   renders (one-character element-ID mismatch), the nav overflows and is
   unusable between ~601–1080 px, `prefers-reduced-motion` users get permanently
   *empty* sections, and the compare slider traps vertical touch scrolling.
4. **No path for non-developers.** Zero plain-language explanation of what the
   product does, no contact channel of any kind, Use Cases reachable only from
   the footer, and every CTA is developer-only. An architect finds no maturity /
   stability / support signals either.
5. **Structural drift.** Nav + footer are triplicated (index inline vs.
   `Nav.astro`/`Footer.astro` vs. 404) and have already diverged; `CODE` vs.
   `CODE_HTML` in `content.ts` are hand-synced and have already drifted; two
   different `SITE` constants disagree; stats are hardcoded prose that has
   already gone stale (unlike the well-designed derived `CONNECTOR_STATS`).

**Severity counts:** 5 critical, 12 high, 18 medium, 15 low.

---

## Part A — Findings catalog

Severity: **C** critical · **H** high · **M** medium · **L** low.
Lens: DEV (developer), ARCH (architect), BIZ (business), QA (technical audit).
Line numbers refer to the current state of the files on this branch.

### A.1 Factual & credibility errors (the trust killers)

| ID | Sev | Lens | Finding |
|----|-----|------|---------|
| F-01 | C | DEV, ARCH | **"DMN 2.0 XML" is a fabricated spec version.** OMG DMN's latest release is 1.x; the SDK actually emits the DMN **1.3** namespace (`https://www.omg.org/spec/DMN/20191111/MODEL/`, see `packages/core/src/dmn/dmn-builder.ts:18-20`). Claimed at `apps/landing/src/data/content.ts:236` and `:434`, `apps/landing/src/pages/index.astro:660` and `:663` (chip). DMN-literate readers will read this as "they don't know their own domain." |
| F-02 | C | DEV | **The REST API code sample calls an API that doesn't exist.** `content.ts:139-163` (+ HTML twin `:373-396`) shows `client.process.deploy({ resources: [...] })` and `client.process.startInstance({ bpmnProcessId, ... })`. The real `CamundaClient` (`packages/api/src/generated/resources.ts:2747`) has **no `process` property**; deployment is `client.resource.createDeployment()` (which currently accepts *no body* — see D-01 in Part C), and instance start is `client.processInstance.createProcessInstance({ processDefinitionId, ... })` (v2 API uses `processDefinitionId`, not `bpmnProcessId`). The sample's oauth2 config also omits the required `tokenUrl` (`packages/api/src/runtime/types.ts:87-99`) and assigns `process.env.X` (`string \| undefined`) to `string` fields — it fails strict type-checking under a headline that says "fully typed." |
| F-03 | C | DEV, ARCH | **Quickstart step 3 crashes if copy-pasted, and misrepresents simulation as production deploy.** `content.ts:124-137` (`deployRun`): `await engine.deploy({ bpmn: xml })` — but `Engine.deploy()` is synchronous, returns `void`, and takes `BpmnDefinitions` objects, not `{ bpmn: xmlString }` (`packages/engine/src/engine.ts:36-40`); `job.complete()` also returns `void`, so the `await`s are misleading. Worse: the step is titled **"Deploy & run"** (`index.astro:617`) but uses `@bpmnkit/engine`, whose own README says it *simulates* execution ("Perfect for: workflow testing, visual debugging, interactive demos") and carries an **experimental** badge. The word "simulation" appears nowhere on the homepage, and `SITE.description` (`content.ts:6-9`) says "executing." An architect's first question — "is this a production runtime or a test harness?" — is answered misleadingly. |
| F-04 | H | DEV | **"Zero Dependencies" is contradicted by npm.** Hero pill (`index.astro:119`), deps-ring "0 runtime deps" (`index.astro:194-196`), and the engine blurb (`content.ts:36`). Published `@bpmnkit/core@0.1.1` ships `"dependencies": { "@bpmnkit/feel": "..." }` (see `packages/core/package.json`); `@bpmnkit/engine` depends on core + feel. The first thing a skeptical dev does is open the npm page. The honest claim is "zero **third-party** dependencies" (`@bpmnkit/feel` is itself dep-free and first-party). |
| F-05 | M | DEV, QA | **"22 type guards" is stale — the SDK exports 29.** `grep -c "export function isBpmn" packages/core/src/bpmn/type-guards.ts` → 29. Hardcoded "22" at `content.ts:28`, `content.ts:77`, `index.astro:218`, `:220` (chip), `:286` (SDK-DX heading). "180 typed methods" / "30+ resource classes" (`index.astro:487-493`) were verified accurate *today* (179 async methods, 34 resource classes) but are the same class of hand-maintained numbers and will drift identically. Contrast: connector stats are correctly derived from `CONNECTOR_STATS` (`@bpmnkit/connector-gen`) at build time. |
| F-06 | M | DEV, QA | **Animated demo displays an `adHocSubProcess` call that doesn't type-check.** Displayed code in `apps/landing/src/scripts/main.ts:339-340` renders `.adHocSubProcess("agent-loop", { name: "Agent Loop" }, sub => ...)` (options 2nd), but the typed signature is `(id, content, options?)` (`packages/core/src/bpmn/bpmn-builder.ts:1318-1322`). Runtime tolerates the swap, TypeScript doesn't. The *actual* builder call in `main.ts:197-205` uses the correct order — only the display strings are wrong. |
| F-07 | M | DEV, ARCH, QA | **"∞ retry & backoff" stat is misleading.** `index.astro:498-501`. Retries are bounded/configurable (`packages/api/src/runtime/http.ts`); "∞" advertises unbounded retries — an anti-feature — and is a dev in-joke that undermines an otherwise quantitative stats block. |
| F-08 | M | ARCH | **Roundtrip claim is an unfalsifiable absolute.** "preserved perfectly" (`index.astro:233`) with no link to conformance evidence. Invites falsification on the first gnarly Modeler file; the honest, *stronger* framing is to link the roundtrip test suite. |
| F-09 | M | ARCH | **"production-ready" hero vs. 0.x experimental reality.** Hero says "production-ready BPMN 2.0 diagrams" (`index.astro:126`) while every package is 0.0.x–0.1.x and the GitHub repo self-labels "status: experimental." Defensible reading: the *XML output* is production-deployable. The page should say exactly that and disclose pre-1.0 status (see M-04). |

### A.2 Functional bugs

| ID | Sev | Lens | Finding |
|----|-----|------|---------|
| B-01 | H | DEV, QA | **"BPMN with DMN + Form" tab preview never renders.** `apps/landing/src/scripts/playground.ts:29` queries `getElementById("dmn-bpmnkit-preview")` but the markup is `id="dmn-bpmn-preview"` (`index.astro:739`). `renderDmnBpmnPreview()` silently no-ops → permanently empty box. Looks like a global "bpmn"→"bpmnkit" rename gone wrong. |
| B-02 | H | QA | **Nav overflows, links unreachable, between 601 px and ~1080 px.** 12 links + GitHub CTA in a non-wrapping flex row (`global.css:137-141`); the burger only activates at `max-width: 600px` (`global.css:1924-1936`); `body { overflow-x: hidden }` (`global.css:59`) clips the overflow. Tablets and small laptops lose half the nav. |
| B-03 | H | QA | **`prefers-reduced-motion` users get permanently empty sections.** `main.ts:643` and `cli-anim.ts:204` `return` early on reduced motion, but the "See it in action" panels (`index.astro:432-459`) and CLI terminal (`index.astro:580`) are populated *only* by these scripts → 380–480 px boxes of nothing. Reduced motion should mean "static final state," not "blank." |
| B-04 | H | DEV, QA | **Compare slider traps vertical touch scrolling.** `.compare-slider { touch-action: none }` (`global.css:1000`) covers the entire tall block; a thumb landing anywhere in it cannot scroll the page. (A comment at `global.css:1847-1853` even references a `pan-y` compromise that isn't what shipped.) Also on mobile `.cmp-code { overflow: hidden }` (`global.css:1855`) clips the XML with no way to read it. |
| B-05 | M | QA | **Clipboard code throws / fails silently.** `main.ts:84` and `:104` call `navigator.clipboard.writeText(...)` with no existence guard and no `.catch`. On non-secure contexts `navigator.clipboard` is `undefined` (synchronous TypeError); on permission denial, unhandled rejection; either way the user gets zero feedback. |
| B-06 | M | QA | **CLI animation never pauses once started.** `cli-anim.ts:213-226` disconnects its IntersectionObserver on first intersection and never clears `cliAnimActive` → `while(true)` timers + DOM swaps run forever even when scrolled away. `main.ts:710-725` already implements the correct pause pattern to copy. |
| B-07 | M | DEV, QA | **Playground promises `Dmn` and `Form` but can only render BPMN.** Copy at `index.astro:754`; `playground.ts:317` unconditionally calls `Bpmn.export(defs)`, so returning a DMN table or Form yields "Export failed." All presets are BPMN-only. |
| B-08 | M | QA | **Copy button inside the compare slider also jumps the slider.** The copy-button wrapper is injected around every `<pre>` including compare panels (`main.ts:67-93`), and the slider's `pointerdown` handler (`main.ts:743-747`) doesn't check the event target — clicking "Copy" moves the split. |
| B-09 | M | QA, DEV | **Header and footer logos link to `href="#"`.** `index.astro:60` and `:802` (the latter even has `aria-label="BPMN Kit home"`). `Nav.astro:19` / `Footer.astro:7` correctly use `href="/"`. |
| B-10 | L | QA | **RSS item links use trailing slashes that don't match `build.format: "file"`.** `rss.xml.ts:18` emits `/blog/${post.id}/`; the build produces no-trailing-slash URLs and the blog index links `/blog/${post.id}` (`blog/index.astro:54`). Host-dependent 404/redirect. |
| B-11 | L | QA | **OG image generation depends on system fonts.** `og.png.ts:19-27` renders text with `font-family: system-ui` via resvg's `loadSystemFonts` — on a fontless CI image the OG renders with no text. Pin a bundled font file. |

### A.3 Accessibility

| ID | Sev | Lens | Finding |
|----|-----|------|---------|
| X-01 | M | QA | **Mobile menu: `aria-hidden="true"` wrapping 13 focusable links; no focus management.** `index.astro:91-108`; closed state is only `opacity: 0; pointer-events: none` (`global.css:220-243`) so Tab walks through invisible, aria-hidden links (WCAG 4.1.2). No Escape-to-close. Same pattern in `Nav.astro:41-62` and `404.astro:150-252`. |
| X-02 | M | QA | **DMN tabs: `role="tablist"/"tab"` with none of the required plumbing.** `index.astro:635-639` — no `aria-selected`, `aria-controls`, ids; panels lack `role="tabpanel"`; no arrow-key support (`playground.ts:7-25` is click-only). Half-done tab semantics are worse for AT than plain buttons. The `.pkg-tab` install tabs (`index.astro:598-601`) have no selected-state ARIA at all. |
| X-03 | M | QA | **Compare slider is pointer-only.** Divider is `aria-hidden` + `pointer-events: none` (`index.astro:403`, `global.css:1108`); no `role="slider"`, no keyboard path — while the page instructs "Drag the divider to compare" (WCAG 2.1.1). |
| X-04 | L | QA | **Assorted:** "Copied!" feedback is visual-only (span is `aria-hidden`, no `aria-live`) — `index.astro:134`, `main.ts:85-90`; no skip-to-content link before a 13-link nav; contrast: `.cmp-code .comment` `#546e7a` ≈ 3.6:1 (`global.css:1083-1085`) and CLI dim text ≈ 3:1 (`global.css:1666-1668`), below AA 4.5:1; `404.astro:168` puts `aria-label` on a role-less `<div>`; animated code panels mutate DOM continuously with no `aria-hidden` and no text alternative. |

### A.4 Messaging, audience & trust (content gaps)

| ID | Sev | Lens | Finding |
|----|-----|------|---------|
| M-01 | C | BIZ | **No plain-language explanation of what BPMN Kit is or what problem it solves — anywhere.** Hero (`index.astro:121-129`) is 100 % jargon for a non-developer ("fluent TypeScript API," "BPMN 2.0," "auto-layout," "AI agents"); BPMN is never expanded; the pill "AI-Native · TypeScript · Zero Dependencies" (`index.astro:119`) is meaningless-to-alarming for a buyer. A Head of Ops cannot answer "what does it do, for whom, what do I get." |
| M-02 | C | BIZ | **No contact channel of any kind.** Verified across homepage, footer (`index.astro:799-827`), and the whole pages directory: no email, form, community link, or "about." A convinced buyer literally cannot take a next step except GitHub issues. Cheapest critical fix in this document. |
| M-03 | C | BIZ | **No business path on the homepage.** All 12 nav items are developer destinations; **Use Cases exists only in the footer** (`index.astro:818`), ~8 screens down; the shared `Nav.astro:6-13` omits it too. The use-case pages themselves are dev-prose with code blocks, not business outcomes. |
| M-04 | H | ARCH, DEV, BIZ | **No maturity / trust signals.** No version numbers, no npm/license badges near the hero, no changelog/release link, no stability statement per package, no "who's behind this" beyond `made by u11g` (`index.astro:812` — an unexplained external link), no security policy, no support path. Architect's adoption checklist comes up empty; dev discovers v0.1.x on npm and feels misled. |
| M-05 | H | ARCH | **No architecture overview — the "SDK" story fragments into 7+ products.** Hero says "a fluent TypeScript API" yet nav/sections cover SDK, engine, API client, CLI, editor, operate, connectors with no stated relationship. A `PACKAGES` array with per-package descriptions already exists (`content.ts:17-63`) but is only emitted into `llms.txt` — never rendered for humans. Reads as scope sprawl by a small team. |
| M-06 | H | BIZ | **All CTAs are developer-only; the one business-usable asset is undersold.** Hero CTAs (`index.astro:130-142`): a `pnpm add` copy button (visually first), "Get Started" → API docs, "Try the Editor" (third, ghost-styled, doesn't say it's visual/no-code), GitHub. |
| M-07 | M | ARCH | **Camunda scoping is implied but never stated.** Everything execution-adjacent is Zeebe/Camunda 8-specific; Camunda 7 is never mentioned; whether the library is useful standalone (no Camunda at all) must be inferred. |
| M-08 | M | ARCH | **The genuinely strong no-lock-in story is never told.** Standard BPMN/DMN/Form XML in and out, works on Modeler-authored files, exit = keep your files. Currently only derivable from a compare-page FAQ. |
| M-09 | M | ARCH | **Compare pages miss the comparisons architects actually need.** Only bpmn-js and Camunda Modeler exist (`compare/index.astro:7-18`). Missing: official `@camunda8/sdk` (the default alternative for the API client), `bpmn-moddle` + `bpmn-auto-layout` (the honest generation alternative), raw XML templating. |
| M-10 | M | BIZ | **Business-relevant value props exist but are buried in dev phrasing.** "AI generates it, the SDK validates and renders it" (`index.astro:178`) is a headline-grade business benefit ("AI drafts your process diagrams, guaranteed valid") left untranslated; same for Camunda-compat and the connector catalog. |
| M-11 | L | BIZ | **Meta description narrows the audience at the SERP stage.** `content.ts:6-9` / `index.astro:37` lead with "A TypeScript SDK…" — a business searcher never clicks. |
| M-12 | L | BIZ | **Insider strings:** CLI terminal titled "casen" with zero introduction (`index.astro:578`); "FEEL Functions" footer link is the only FEEL mention on the page (`index.astro:817`); "from code, not clicks" implicitly disparages the analyst persona whose job is clicks (keep the headline — reconcile in the subtitle, see Phase 4). |

### A.5 Structure & information architecture

| ID | Sev | Lens | Finding |
|----|-----|------|---------|
| S-01 | M | QA, DEV, ARCH | **Nav anchor order doesn't match section order; Quickstart unreachable from nav.** Nav lists DMN & Forms 3rd (`index.astro:70`) but the section is 8th (after Quickstart, `index.astro:625`); API/CLI links jump backwards past Quickstart; `#start` has no nav link at all. Clicking the nav left-to-right scrolls down-up-down. 13 links is also too many for a first visit. |
| S-02 | M | QA | **Nav + footer triplicated with real drift.** index.astro inlines both (`:58-109`, `:799-827`) instead of using `Nav.astro`/`Footer.astro`; 404.astro inlines a third variant. Drift today: index nav lacks Compare/Use Cases/FEEL Functions; `Nav.astro` lacks Operate/Use Cases; index footer has an Editor link that `Footer.astro` lacks; 404 links npm to `/package/@bpmnkit/core` while the others use `/org/bpmnkit`. |
| S-03 | M | DEV, QA | **`CODE` vs `CODE_HTML` hand-sync has already drifted.** `content.ts:323` comment admits the manual sync. Drift today: `formExample` comments and select options differ (`content.ts:238-251` vs `:436-447`); `bpmnWithCompanions` differs in task `name:` fields and comments (`:280-319` vs `:475-499`). So llms-full.txt and the visible page show different "same" examples. |
| S-04 | L | DEV, QA | **Two divergent `SITE` constants.** `apps/landing/src/data/content.ts:3-13` vs `packages/astro-shared/src/site.ts` — different tagline, description, npm URL (`/package/@bpmnkit/core` vs `/org/bpmnkit`). JSON-LD uses one, llms.txt the other. |

### A.6 Performance & SEO polish

| ID | Sev | Lens | Finding |
|----|-----|------|---------|
| P-01 | L | QA | **Heavy eager first-load JS.** All three scripts bundle eagerly (`index.astro:829-833`); `buildAnimExamples()` runs 10 full build+layout+export passes at module eval (`main.ts:135-260`) before the section is visible. |
| P-02 | L | QA | **Three permanently animating `blur(80px)` orbs** (`global.css:289-321`) on a fixed layer — measurable battery cost on mobile; only reduced-motion caps them today. |
| P-03 | L | QA | **Seo.astro gaps:** no `og:image:width/height/alt`, no `twitter:site` (`packages/astro-shared/src/Seo.astro:44-54`); `organizationJsonLd` uses `favicon.svg` as the Organization logo (`seo.js:10`) where Google wants a raster ≥112×112; index.astro lacks `<link rel="alternate" type="application/rss+xml">`. JSON-LD could carry `license` and `softwareVersion` to reinforce the trust story. Canonicals, sitemap, robots.txt were verified correct. |

### A.7 Verified strengths — do NOT regress these

- The hero diagram, "See it in action" animation, and playground execute the
  **real** `@bpmnkit/core` + `@bpmnkit/canvas` in the browser — genuine
  proof-of-work. All playground presets traced to real, correct API.
- The XML-vs-SDK compare slider is the single best value-prop device on the
  page for the developer audience. Keep it; fix its touch/keyboard issues.
- Connector stats derived from `CONNECTOR_STATS` at build time — the pattern
  every other number should follow.
- SEO foundation (canonical normalization, sitemap, robots, OG image endpoint,
  `llms.txt`/`llms-full.txt`) is solid.
- The compare pages' honest tone ("Newer, smaller ecosystem") is exactly right —
  extend that pattern, never walk it back.

---

## Part B — Implementation plan

Rules for the implementing agent:

- Follow `CLAUDE.md`: zero type/lint errors, Biome formatting, update
  `doc/progress.md` per change-set, tests where behavior changes.
- **Re-verify every factual claim against package source at implementation
  time** (signatures, counts, namespaces). This doc's line numbers and counts
  were correct on 2026-07-08 but may have moved.
- `content.ts` has paired `CODE` (plain) and `CODE_HTML` (highlighted) entries —
  until Phase 5 removes the duplication, **every sample edit must be applied to
  both**, and the derived `llms.txt`/`llms-full.txt` output should be
  spot-checked after building.
- Landing verify loop: `pnpm biome check apps/landing`, `pnpm tsc --noEmit`,
  `pnpm turbo build --filter=landing`, then inspect `apps/landing/dist/`.

### Phase 1 — Factual corrections & truthful code samples (highest priority)

Everything in this phase is a copy/code-sample edit in
`apps/landing/src/data/content.ts` and `apps/landing/src/pages/index.astro`.

1. **Fix "DMN 2.0" → "DMN 1.3"** (F-01).
   - `content.ts` `dmnTable` comment (`// ✓ valid DMN 2.0 XML`) in both CODE and
     CODE_HTML variants; `index.astro:660` prose ("generates valid DMN 2.0 XML"
     → "generates valid DMN 1.3 XML (Camunda 8-compatible)"); `:663` chip
     ("DMN 2.0 XML export" → "DMN 1.3 XML export").
   - Grep the whole app for `DMN 2.0` to catch stragglers (also check
     `apps/landing/src/pages/` sub-pages and `apps/docs`, `apps/learn` — fix
     landing at minimum, report others).
   - *Verify:* `grep -ri "dmn 2.0" apps/landing/src` returns nothing; the DMN
     namespace in `packages/core/src/dmn/dmn-builder.ts` confirms `20191111`
     (DMN 1.3) before writing "1.3".
2. **Rewrite the REST API sample against the real client** (F-02).
   - Open `packages/api/src/generated/resources.ts` and confirm the current
     surface. As of this audit: no `client.process`; instance start is
     `client.processInstance.createProcessInstance({ processDefinitionId, variables })`;
     `client.resource.createDeployment()` accepts no body (upstream gap — see
     D-01). Build the sample only from calls that exist *and* type-check:
     e.g. construct the client with a complete oauth2 config **including
     `tokenUrl`** (check `packages/api/src/runtime/types.ts`), use non-null
     assertions or placeholder strings instead of raw `process.env.X`,
     `createProcessInstance`, and the `client.on("request"/"error")` events
     (verified real). Do not show `deploy` unless D-01 is resolved first.
   - Apply to both `CODE.apiClient` and `CODE_HTML.apiClient`.
   - *Verify:* paste the plain sample into a scratch `.ts` file inside
     `packages/api` (or a temp workspace consumer) and run `tsc --noEmit`
     against it — it must compile with strict mode; delete the scratch file.
3. **Fix Quickstart step 3 and split simulate vs. deploy** (F-03, F-09 partial).
   - Correct the code: `engine.deploy(defs)` (synchronous, takes the built
     `BpmnDefinitions` from step 2 — confirm signature in
     `packages/engine/src/engine.ts`), drop the misleading `await`s on
     `deploy`/`complete`.
   - Retitle step 03 from "Deploy & run" to **"Simulate it locally"** and add
     one sentence: "The engine is an in-process simulator for tests and demos —
     for production execution, deploy to Camunda 8/Zeebe."
   - Add step **04 — "Deploy to Camunda 8"** using the (now-correct) API-client
     snippet from step 2 of this phase, or a link to the API section if a 4th
     card doesn't fit the `steps-grid` layout (check `global.css` grid rules;
     a 4-step grid is preferred).
   - Update `SITE.description` in `content.ts:6-9`: "generating, editing, and
     executing" → "generating, editing, simulating, and deploying".
   - *Verify:* the snippet's calls match `packages/engine/src/engine.ts`
     signatures; grep the homepage build output for the word "simulat" — it
     must now appear in the quickstart section.
4. **"Zero Dependencies" → "Zero third-party dependencies"** (F-04).
   - Hero pill (`index.astro:119`), deps-ring label "runtime deps" →
     "third-party deps" (`index.astro:194-196`), engine blurb in
     `content.ts:36`, and the bento "Zero Dependencies" card heading + body
     (`index.astro:191-192`) — reword to "Zero third-party dependencies. Pure
     ESM, tree-shakeable…". Grep for other "zero dep" variants (`FEATURES`
     array, use-case pages).
   - *Verify:* `grep -ri "zero dep" apps/landing/src` shows only the qualified
     wording; `packages/core/package.json` `dependencies` confirms the
     first-party-only reality.
5. **Fix the type-guard count and de-hardcode the stats** (F-05).
   - Count guards at implementation time
     (`grep -c "export function isBpmn" packages/core/src/bpmn/type-guards.ts`).
   - Preferred: export a `CORE_STATS` (or similar) constant — e.g. from a small
     generated module in `packages/core` following the
     `packages/connector-gen/src/stats.ts` pattern — with `typeGuards` and
     import it in `index.astro`/`content.ts`. If that's too invasive for one
     pass, minimally update every "22" to the real count: `content.ts:28`,
     `:77`, `index.astro:218`, `:220`, `:286`.
   - Same decision for "180 typed methods" / "30+ resource classes": ideal is a
     generated stat from `packages/api`; minimum is a comment in `content.ts`
     noting where the numbers come from and how to recount.
   - *Verify:* rendered numbers match a fresh grep count; `check-packages` and
     build stay green if a new export was added.
6. **Fix the displayed `adHocSubProcess` argument order** (F-06).
   - `main.ts` display strings (~`:339-340`): swap to `(id, callback, { name })`
     to match `bpmn-builder.ts`'s typed signature. The executed builder call
     nearby is already correct — only the on-screen HTML strings change.
   - *Verify:* displayed order matches the declared TS signature in
     `packages/core/src/bpmn/bpmn-builder.ts` (`adHocSubProcess(id, content, options?)`).
7. **Replace the "∞ retry & backoff" stat** (F-07).
   - `index.astro:498-501`: replace `∞` with the real default max-attempts
     number from `packages/api/src/runtime/http.ts` (read it first), label
     "auto-retry w/ backoff"; or use a checkmark-style "built-in" label.
   - *Verify:* the number matches the runtime default.
8. **Soften the roundtrip absolute** (F-08).
   - `index.astro:232-233`: "preserved perfectly" → "preserved — verified by
     roundtrip tests" and link the word "verified" to the relevant test
     directory on GitHub (find the actual roundtrip/parser test files under
     `packages/core` first; link to the real path).
   - *Verify:* linked GitHub path exists on `main`.

### Phase 2 — Functional bug fixes

9. **Fix the dead tab preview** (B-01). `playground.ts:29`:
   `"dmn-bpmnkit-preview"` → `"dmn-bpmn-preview"`.
   - *Verify:* build, open `dist` page (or dev server), click the "BPMN with
     DMN + Form" tab — a diagram renders in the preview box.
10. **Fix tablet nav overflow** (B-02). Preferred: raise the burger breakpoint
    so the full 13-link row never overflows — measure the row's natural width
    (~1080–1150 px) and switch to burger below **1100 px** (`global.css` —
    update both the `max-width: 600px` burger block at `:1924-1936` and the
    corresponding `.nav-links` hide rule). This interacts with Phase 5's nav
    trim; if Phase 5 lands first with ≤7 links, re-measure and pick the
    breakpoint accordingly.
    - *Verify:* at 700 px, 900 px, and 1050 px widths no nav link is clipped
      and either burger or full row is fully usable (use browser devtools or a
      Playwright viewport screenshot — Chromium is pre-installed).
11. **Reduced-motion users must get static content, not blank boxes** (B-03).
    - `main.ts` (~`:643`): on `prefers-reduced-motion`, instead of `return`,
      render the first example's *final* state once (code fully "typed", final
      diagram) — there is an instant-render path (`showExampleInstant` or
      equivalent; find it in `main.ts`) to reuse. Hide the progress bars.
    - `cli-anim.ts` (~`:204`): render the final frame of the CLI sequence
      statically.
    - *Verify:* with DevTools "Emulate CSS prefers-reduced-motion: reduce", the
      Examples section shows a complete code sample + diagram and the CLI
      terminal shows a completed session; nothing animates.
12. **Un-trap touch scrolling on the compare slider** (B-04).
    - `global.css:1000`: `touch-action: none` → `touch-action: pan-y` (drag
      still works because pointermove handles horizontal deltas), or restrict
      `touch-action: none` to the divider knob and make the knob the pointer
      target. Also make `.cmp-code` scrollable on mobile instead of
      `overflow: hidden` (`global.css:1855`).
    - *Verify:* on a touch-emulated viewport, a vertical swipe over the compare
      section scrolls the page; horizontal drag still moves the divider; the
      XML panel can be scrolled/read on a 375 px viewport.
13. **Harden clipboard copy** (B-05). In `main.ts` (both the generic copy
    button ~`:84` and the install button ~`:104`): guard
    `if (!navigator.clipboard)` (fallback: hide the button or use a temporary
    textarea + `document.execCommand("copy")`), add `.catch` that shows a
    "Copy failed" state.
    - *Verify:* stub `navigator.clipboard` to `undefined` in the console — no
      exception, sensible UI.
14. **Pause the CLI animation off-screen** (B-06). `cli-anim.ts:213-226`:
    don't disconnect the observer; toggle `cliAnimActive` on intersection
    changes, mirroring `main.ts:710-725`.
    - *Verify:* scroll past the CLI section, check via
      `performance`/`requestAnimationFrame` logging (or a temporary counter)
      that frames stop when off-screen.
15. **Route playground output by type** (B-07). `playground.ts` `run()`
    (~`:317`): detect what the user expression returned — BPMN definitions →
    existing canvas render; DMN definitions → `Dmn.export` and show the XML (or
    a table preview if cheap); Form → `Form.export` JSON pretty-printed.
    Inspect the actual returned-object discriminants in `@bpmnkit/core` (e.g.
    presence of `processes` vs `decisions` vs form `schemaVersion`) rather than
    guessing. Add one DMN and one Form preset to `playground-examples`.
    Alternatively (fallback): change the copy at `index.astro:754` to
    BPMN-only. Preferred: implement the routing.
    - *Verify:* running a `Dmn.createDecisionTable(...)` preset shows output,
      not "Export failed".
16. **Stop copy-clicks from jumping the slider** (B-08). `main.ts`
    (~`:743-747`): in the slider's `pointerdown`, early-return when
    `event.target` is (inside) `.copy-btn`.
    - *Verify:* clicking Copy inside a compare panel doesn't move the divider.
17. **Fix logo hrefs** (B-09). `index.astro:60` and `:802`: `href="#"` →
    `href="/"`.
18. **Fix RSS trailing slash** (B-10). `rss.xml.ts:18`: drop the trailing `/`.
    - *Verify:* built `dist/rss.xml` item links match real page URLs
      (`build.format: "file"` → no trailing slash).
19. **Bundle a font for OG rendering** (B-11). `og.png.ts`: load a packaged
    font file (e.g. a WOFF/TTF added under `apps/landing/src/assets/`) via
    resvg's `fontFiles`/`fontBuffers` option instead of relying on
    `loadSystemFonts`.
    - *Verify:* build on CI produces an OG PNG with visible text (open
      `dist/og.png`).

### Phase 3 — Accessibility

20. **Mobile menu semantics** (X-01). In `index.astro` (and `Nav.astro` +
    `404.astro` for the same pattern): closed state gets `visibility: hidden`
    (add to `global.css` closed-state rules, toggled by `.open`) so links stop
    being tabbable; remove `aria-hidden` juggling in favor of the existing
    `aria-expanded` on the button; add Escape-to-close and return focus to the
    burger; keep the outside-click close.
    - *Verify:* keyboard-only: Tab never lands on invisible links; Escape
      closes; focus returns to the burger.
21. **Finish or remove tab ARIA** (X-02). For the DMN tabs
    (`index.astro:635-639` + `playground.ts:7-25`): add `id`/`aria-controls`
    pairs, `aria-selected`, `role="tabpanel"` + `aria-labelledby` on panels,
    roving tabindex + ArrowLeft/Right handling. Give `.pkg-tab` buttons
    `aria-pressed` (they're toggles, not tabs). If the effort budget is tight,
    the acceptable minimum is *removing* the `role` attributes — half
    semantics are worse than none — but completing them is preferred.
    - *Verify:* keyboard arrows move between tabs; a screen-reader tree (or
      axe devtools) shows a complete tab pattern with zero violations.
22. **Keyboard-accessible compare slider** (X-03). Make the divider knob a
    focusable element with `role="slider"`, `aria-valuemin/max/now`
    (0–100), `aria-label="Comparison divider"`, ArrowLeft/Right (±5 %)
    handling wired to the same split-update function `main.ts` uses for
    pointer moves; remove `pointer-events: none` from the knob.
    - *Verify:* Tab reaches the knob; arrows move the split; axe reports no
      slider violations.
23. **Small a11y batch** (X-04). Add a skip-to-content link as the first body
    element (target `<main>`; style visually-hidden-until-focused in
    `global.css`); make the "Copied!" span `role="status"` with `aria-live="polite"`
    and not `aria-hidden`; bump `.cmp-code .comment` and CLI dim-text colors to
    ≥4.5:1 against their backgrounds (pick the nearest passing shade — test
    with a contrast checker); `404.astro:168` — add `role="img"` alongside the
    `aria-label`; add `aria-hidden="true"` to the continuously-animating code
    panel + diagram containers and provide a visually-hidden one-paragraph
    text alternative describing what the demo shows.
    - *Verify:* axe/Lighthouse a11y pass on the built homepage with no new
      violations; contrast checked for the two adjusted colors.

### Phase 4 — Messaging, audience & trust content

Additive content changes. Copy drafts below are starting points — keep the
existing voice (confident, concrete, no fluff) and keep every claim verifiable.

24. **Plain-language hero subtitle** (M-01, M-12 reconciliation). Under the
    existing `hero-p` (`index.astro:125-129`), add one muted line:
    > "BPMN is the industry standard for business-process diagrams. BPMN Kit
    > lets your developers — and AI assistants — create, test, and deploy them
    > as fast as they write code. Analysts still review and edit everything
    > visually in the built-in editor."
    Style: a smaller `.hero-p-sub` class consistent with existing tokens. Do
    not touch the headline — "from code, not clicks" stays.
25. **Rewrite the hero pill** (M-01, M-04). `index.astro:119`:
    `AI-Native · TypeScript · Zero Dependencies` →
    `Open Source · MIT · AI-Native · TypeScript`. (The dependency claim moves
    fully to the bento card, already qualified by Phase 1 step 4.)
26. **Contact + about in the footer** (M-02). In the index footer AND
    `Footer.astro` (until Phase 5 unifies them): add
    `<a href="mailto:hello@bpmnkit.com">Contact</a>` to the link row **[confirm
    the mailbox exists — see D-05]**, and extend the left block: "BPMN Kit is
    built in the open by [u11g](https://u11g.com). MIT-licensed." Keep it one
    line.
27. **Use Cases into the nav** (M-03). Add "Use Cases" to the index nav (both
    desktop and mobile lists) and to `Nav.astro`'s default links. Combined with
    the Phase 5 nav trim — see step 31 for the final link set.
28. **"For process teams" section** (M-03, M-10, M-12). New section on the
    homepage between the features bento and "SDK Quality" (`index.astro`,
    after `:271`), eyebrow "For process teams", H2 "Your analysts model it.
    Your developers ship it. AI drafts it." Three cards (reuse `.bento`/card
    styles or a simple 3-col grid consistent with `global.css`):
    1. *Faster process changes* — "Process updates ship through code review —
       versioned, tested, and audit-traceable — not a modeling-tool ritual."
    2. *AI-drafted workflows* — "Describe a process in plain language; get a
       valid, deployable BPMN diagram your analysts review visually."
    3. *No lock-in, no license fees* — "Open source (MIT). Standard BPMN 2.0
       files that open in any BPMN tool, including Camunda Modeler." (This also
       lands M-08's no-lock-in story.)
    Under the cards, one reconciling line: "BPMN Kit doesn't replace visual
    modeling — the built-in editor and any BPMN 2.0 tool open every diagram. It
    replaces the copy-paste-redeploy gap between the diagram and production."
    Plus a link: "Explore use cases →" (`/use-cases`).
    - *Verify:* section renders in both the desktop and ~375 px layouts;
      Biome/build clean.
29. **Project-status / trust block** (M-04, F-09). Compact strip or card row
    near the footer (or directly under the quickstart): current core version
    (read from `packages/core/package.json` at build time — Astro can import
    JSON), "pre-1.0 — API stabilizing", MIT license, links to GitHub Releases
    and the changelog, "Support: GitHub Issues / hello@bpmnkit.com". Qualify
    the hero's "production-ready" here: "'Production-ready' refers to the
    generated BPMN 2.0 XML — deployable to any Camunda 8 cluster today."
    - *Verify:* displayed version matches `packages/core/package.json` after a
      version bump (i.e., it is imported, not typed).
30. **CTA + framing edits** (M-06, M-11, M-12, M-05).
    - "Try the Editor" → "Open the visual editor — no install" (`index.astro:140`).
    - "Get Started" keeps its docs target but gets an honest label: "Read the
      docs" or keep "Get Started" — implementer's choice; do not add a fourth
      primary button.
    - Meta description (`Seo` call in `index.astro:35-39` and
      `SITE.description`): rework to serve both audiences, e.g. "Open-source
      toolkit for building, simulating, and deploying business-process (BPMN)
      diagrams with code and AI. TypeScript, MIT-licensed, Camunda 8
      compatible."
    - CLI section: add one introducing line "casen — the BPMN Kit command
      line" above or in the section sub-copy (`index.astro:526-529`).
    - Animated-demo caption (`index.astro:420`): "Watch a process get built —
      each line of code (or AI instruction) instantly becomes a diagram your
      team can read."
    - **"How the pieces fit" (M-05):** render the existing `PACKAGES` data
      (`content.ts:17-63`) as a compact human-visible map — a small section or
      an extension of the trust block: four columns Author (`core`) →
      Simulate (`engine`) → Deploy (`api`, CLI) → View & Operate (`canvas`,
      `editor`, `operate`), one line + npm link each, with a stability tag per
      package (core/canvas "stable API", engine "experimental — simulation
      only", etc. — confirm tags with the maintainer if unsure, see D-04).
    - Use-case pages (M-03): add a 2–3 sentence "Why this matters for your
      team" callout at the top of each of the four
      `apps/landing/src/pages/use-cases/*.astro` pages, business-outcome
      framed (draft for camunda-8-automation: "Process changes ship through
      the same review-and-release pipeline as software — versioned, tested,
      audit-traceable — instead of someone redeploying a diagram from a
      desktop tool.").
    - *Verify:* full build + visual spot-check of every touched page.

### Phase 5 — Structural consolidation (do after content settles)

31. **One nav, one footer** (S-02, S-01, B-02 interaction). Extend `Nav.astro`
    to accept the homepage's anchor links via its existing `links` prop and use
    it in `index.astro`; same for `Footer.astro` (add the missing Editor link
    to the component). Replace the 404's inline copies too. Final homepage nav
    order must match the section DOM order and include Quickstart, e.g.:
    `Features · Examples · Quickstart · DMN & Forms · Playground · Use Cases ·
    Docs · GitHub-CTA` — with the remaining destinations (API, CLI, Connectors,
    Operate, Editor, Learn, Blog, Compare) moved to the footer if trimming, or
    kept if the post-fix breakpoint handles the width (decision D-03; default:
    trim to the list above). Reorder so anchors follow page order (S-01).
    - *Verify:* all three surfaces render identical nav/footer link sets from
      the shared components; anchor clicks scroll strictly downward when
      clicked left-to-right; no nav overflow at any width ≥ the burger
      breakpoint.
32. **Single `SITE` source** (S-04). Make `apps/landing/src/data/content.ts`
    import/re-export `SITE` from `@bpmnkit/astro-shared` (extending with any
    landing-only fields). Pick one npm URL (`/org/bpmnkit` recommended — it
    shows the whole ecosystem) and use it everywhere, including `404.astro`.
    - *Verify:* `grep -r "npmjs.com" apps/landing/src packages/astro-shared/src`
      shows one canonical URL; JSON-LD and llms.txt agree.
33. **Generate `CODE_HTML` from `CODE`** (S-03). Move the token-highlighter
    already living in `playground.ts` (~`:203-265`) into a shared module (e.g.
    `apps/landing/src/lib/highlight.ts`), generate the HTML variants at build
    time in the frontmatter of `index.astro` (or in `content.ts` itself as a
    computed export), and delete the hand-written `CODE_HTML` block. Diff the
    rendered output for each sample against the previous build before/after to
    catch highlighting regressions.
    - *Verify:* built homepage code panels visually match pre-change (classes
      `kw/str/fn/comment` still applied); `CODE_HTML` literal block is gone;
      the drifts noted in S-03 are resolved (llms-full.txt now matches the
      page by construction).

### Phase 6 — Performance & SEO polish

34. **Lazy-build the animation examples** (P-01). Move `buildAnimExamples()`
    (10 build+layout+export passes) from module eval into the first
    IntersectionObserver callback for the Examples section; consider a dynamic
    `import()` for `playground.ts` triggered on first scroll-into-view of the
    playground.
    - *Verify:* devtools performance trace shows no layout passes at page load
      for the anim examples; the section still populates before it's visible
      when scrolling normally.
35. **Cap ambient animation on mobile** (P-02). Pause/simplify the aurora orb
    animations under `@media (max-width: 600px)` in `global.css` (mirror the
    existing reduced-motion rules).
36. **SEO meta batch** (P-03). In `packages/astro-shared/src/Seo.astro`: add
    `og:image:width`/`height`/`alt` and `twitter:site` (if a handle exists —
    else skip); switch `organizationJsonLd`'s logo to the OG PNG endpoint or a
    dedicated raster; add `<link rel="alternate" type="application/rss+xml"
    href="/rss.xml">` to index.astro; extend `softwareApplicationJsonLd` call
    (`index.astro:11-16`) with `license: "https://opensource.org/license/mit"`
    and a `softwareVersion` imported from `packages/core/package.json`.
    - *Verify:* Google Rich Results test (or schema validator) passes on the
      built HTML; other astro-shared consumers (docs, learn) still build.

### Suggested execution order & sizing

| Phase | Size | Risk | Ship as |
|-------|------|------|---------|
| 1 — Factual fixes | S–M | Low (copy + samples) | One PR, immediately |
| 2 — Bug fixes | M | Low–Med (JS/CSS behavior) | One PR |
| 3 — A11y | M | Low | One PR |
| 4 — Content | M–L | Editorial review needed | One PR, after D-04/D-05 answered |
| 5 — Consolidation | M | Med (touches all pages) | One PR |
| 6 — Perf/SEO | S | Low | One PR |

Phases 1–3 need no maintainer input and deliver most of the credibility
recovery. Phase 4 depends on decisions D-04/D-05. Phase 5 should land after 4
(nav contents settle first). Each PR: run the full pre-completion checklist
(`pnpm turbo build`, `pnpm biome check .`, `pnpm tsc --noEmit`,
`pnpm turbo test`) and update `doc/progress.md`.

---

## Part C — Decisions needed / upstream work (do NOT implement silently)

| ID | Item | Why it's blocked |
|----|------|------------------|
| D-01 | **`packages/api`: `client.resource.createDeployment()` accepts no request body** — the single most important operation of the client can't actually upload a resource. Fixing the generated client is upstream of showing a truthful `deploy` sample (Phase 1 step 2). | Code change in a published package's generated code; needs its own tests + changeset. |
| D-02 | **New compare pages**: vs. official `@camunda8/sdk`/zeebe-node, vs. `bpmn-moddle` + `bpmn-auto-layout`, vs. hand-written XML. Highest-value content for the architect audience; follows the existing honest-comparison pattern. | New content pages; competitive claims need maintainer review. |
| D-03 | **Final nav taxonomy** — trim to ~7 links (recommended, see step 31) vs. keep 13 with a wider burger breakpoint vs. introduce a Product dropdown. | Product-positioning choice. |
| D-04 | **Per-package stability tags** for the "How the pieces fit" map (which packages does the maintainer consider stable vs. experimental?) and whether to publicly state "pre-1.0 — API stabilizing." | Only the maintainer can commit to stability promises. |
| D-05 | **Contact channel**: does `hello@bpmnkit.com` (or any mailbox) exist? Is there/should there be a community (GitHub Discussions?) to link? | Requires infra outside the repo. |
| D-06 | **Camunda 7 positioning** (M-07): explicitly state "Camunda 8/Zeebe only; C7 extensions not supported" or put C7 on the roadmap; consider a "for Camunda 7 users" note or use-case page for migration traffic. | Roadmap decision. |
| D-07 | **Demo video / diagram gallery** for business visitors ("watch the 90-second demo" was the single highest-value business CTA identified; an SVG-export-powered example-diagram gallery is nearly free to build). | New asset production. |
| D-08 | **Docs entry fork**: "Get Started" currently drops everyone into developer docs; a docs-side landing fork (developer path vs. overview path) lives in `apps/docs`, out of this plan's scope. | Different app; coordinate with docs IA. |
