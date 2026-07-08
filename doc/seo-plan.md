# BPMN Kit — SEO & Discoverability Plan

> **Purpose:** a hand-off plan for an implementing agent (Sonnet). Nothing here is
> implemented yet. Every phase lists concrete files and a *verify* check so work can
> be executed goal-first per `CLAUDE.md`.
>
> **Goal:** make developers who need a BPMN/DMN/Camunda-8 toolkit *find* BPMN Kit
> through organic search — for product queries ("bpmn typescript library",
> "camunda 8 node client"), for informational queries ("what is a bpmn exclusive
> gateway"), and for comparison queries ("bpmn-js alternative").

---

## 0. TL;DR — answers to the two questions asked

1. **"Should there be more blog posts?"** — Yes, but not *first*. A blog is a growth
   engine, and it is worthless until the technical foundation exists (a crawlable
   sitemap, correct canonicals, one domain, RSS). Build the foundation (Phase 1–2),
   then launch a blog *with an editorial calendar* (Phase 3). A blog with no cadence
   and no keyword targeting produces nothing.

2. **"More standalone pages that can be discovered?"** — Yes, and this is the
   **higher-leverage** lever for this product. BPMN Kit sits on top of three
   large, *evergreen*, high-intent keyword spaces that map cleanly to pages we can
   generate mostly from data we already have:
   - a **BPMN concept glossary / learn hub** (informational intent, huge volume),
   - **comparison + alternative pages** (bpmn-js, Camunda Modeler, Zeebe clients),
   - **programmatic reference pages** (one page per BPMN element, per FEEL function,
     per connector — we already have 100+ connectors and 22 element type guards as data).

   Standalone evergreen pages compound; blog posts decay. Do both, weight toward pages.

**Sequencing in one line:** fix the crawl foundation → unify the domain/brand →
ship evergreen programmatic pages → launch the blog → add structured data →
measure & distribute.

---

## 1. Current state — diagnosis

Three Astro sites are the SEO surface (the Vite SPAs `studio`/`demo` are client-rendered
and out of scope for organic SEO):

| Site | App | Deployed | Framework |
|---|---|---|---|
| Marketing | `apps/landing` | `bpmnkit.com` | Astro 5 (MPA) |
| Docs | `apps/docs` | **`bpmn-sdk-docs.pages.dev`** (config) vs `docs.bpmnkit.com` (links) | Astro + Starlight |
| Tutorials | `apps/learn` | `learn.bpmnkit.com` | Astro 5 |

**Gaps found (this is the Phase 1–2 work list):**

| # | Gap | Impact | Where |
|---|---|---|---|
| G1 | **No `sitemap.xml`** on any site. `@astrojs/sitemap` is in the lockfile but wired into zero configs. | Crawlers can't enumerate pages. | all 3 `astro.config.mjs` |
| G2 | **No `robots.txt`** anywhere. | No crawl directives, no sitemap pointer. | all 3 `public/` |
| G3 | **Domain split**: docs `site:` is `bpmn-sdk-docs.pages.dev` but everything links `docs.bpmnkit.com`. | Wrong canonicals/OG URLs; split link equity; possible duplicate-content. | `apps/docs/astro.config.mjs` |
| G4 | **Brand split**: "BPMN **Kit**" (landing/README) vs "BPMN **SDK**" (docs title, llms-txt). | Diluted brand-search signal; confusing SERP. | `apps/docs/*`, `content.ts` |
| G5 | **`apps/learn` has no `site:` URL.** | Blocks canonical + sitemap generation there. | `apps/learn/astro.config.mjs` |
| G6 | **No canonical tags** on landing/learn (only one manual one in `casen.astro`). | Duplicate-content risk. | landing/learn heads |
| G7 | **Incomplete OG/Twitter**: landing/docs emit only `og:image`; missing `og:title/description/url/type/site_name`. Learn has none. | Poor social/SERP previews, weaker CTR. | all heads |
| G8 | **No JSON-LD / structured data** anywhere. | No rich results (SoftwareApp, Article, Breadcrumb, FAQ). | all |
| G9 | **No blog, no RSS, no article collection.** | No content engine, no fresh-content signal. | greenfield |
| G10 | **No shared SEO/Head component**; every page hand-rolls `<head>`. `astro-shared` `SITE` is stale (`bpmn-sdk.github.io/monorepo`) and barely used. | No single source of truth → drift. | `packages/astro-shared/src/site.ts` |

---

## 2. Strategy — three pillars

1. **Technical foundation (Phase 1–2, 5):** make every page crawlable, canonical,
   deduplicated, richly previewed, and structured. This is table stakes; it unblocks
   everything else.
2. **Content engine (Phase 3–4):** evergreen standalone pages (weighted high) + a
   cadenced blog (weighted medium). This is where discovery actually grows.
3. **Distribution & measurement (Phase 6):** search console, analytics, internal
   linking, backlinks. Content nobody links to and nobody measures doesn't rank.

Everything shared (site config, `<Head>`, JSON-LD helpers, OG generation) lives in
`packages/astro-shared` so all three sites stay consistent — this directly fixes G10
and matches the monorepo's "single source of truth" convention.

---

## 3. Phase 1 — Technical SEO foundation (do first, ~1–2 days)

**P1.1 — Centralize site metadata in `astro-shared`.**
- Fix `packages/astro-shared/src/site.ts`: correct `url` to `https://bpmnkit.com`,
  add `docsUrl: https://docs.bpmnkit.com`, `learnUrl: https://learn.bpmnkit.com`,
  a single canonical `name`, `tagline`, `defaultDescription`, `ogImage`, social handles.
- Make `apps/landing/src/data/content.ts` `SITE` re-export / consume this instead of
  duplicating (keep landing-specific copy local, pull shared identity from the package).
- *Verify:* `grep -r "bpmn-sdk.github.io"` returns nothing; all three apps import one `SITE`.

**P1.2 — Shared `<Seo>` (Head) component in `astro-shared`.**
- New `packages/astro-shared/src/Seo.astro` (export via `package.json` `exports`) taking
  `title, description, canonical, image?, type?, noindex?`. Emits: `<title>`,
  `meta description`, canonical link, full OG set (`og:title/description/url/type/
  image/site_name`), full Twitter card set. Builds absolute URLs from `Astro.site` +
  `Astro.url.pathname`.
- Adopt it in every landing page (`index`, `cli`, `editor`, `operate`, `casen`, `404`)
  and in `apps/learn/src/layouts/BaseLayout.astro`. Fixes G6, G7.
- For docs (Starlight), extend the existing `head[]` in `astro.config.mjs` to complete
  the OG set (Starlight already handles canonical + og:title/description).
- *Verify:* view-source on one page per site shows canonical + complete OG/Twitter;
  `editor`/`operate` now have descriptions.

**P1.3 — Sitemaps.**
- Add `@astrojs/sitemap` to the `integrations` array of all three `astro.config.mjs`.
  (Dependency already resolvable in lockfile.)
- For learn, first set `site:` (P2.2) or sitemap output is broken.
- *Verify:* `pnpm --filter @bpmnkit/landing build` (and docs, learn) emits
  `dist/sitemap-index.xml`; URLs use the correct production origin.

**P1.4 — robots.txt.**
- Add `public/robots.txt` to each app: `User-agent: *` / `Allow: /` /
  `Sitemap: https://<origin>/sitemap-index.xml`. Consider `Disallow` for the SPA
  app/demo hosts if they share a domain.
- *Verify:* built `dist/robots.txt` present with correct absolute sitemap URL.

**P1.5 — Per-page dynamic OG images (optional but high-CTR).**
- `apps/landing/src/pages/og.png.ts` and `apps/docs/src/pages/og.png.ts` already render
  a static 1200×630 via `@resvg/resvg-js`. Upgrade to accept a `?title=`/`?desc=` param
  (or a `[...slug]` endpoint) so blog posts and comparison pages get bespoke OG cards.
- *Verify:* `/og.png?title=Foo` renders distinct text; posts reference their own OG URL.

---

## 4. Phase 2 — Domain & brand unification (do before content; cheap, high impact)

**P2.1 — One product name.** Pick **"BPMN Kit"** (matches domain + npm org). Rename docs:
`apps/docs/astro.config.mjs` `title`, `apps/docs/src/content/docs/index.mdx`, the
`starlight-llms-txt` `projectName`. Fixes G4.
- *Verify:* `grep -ri "bpmn sdk"` across `apps/docs` returns only intentional prose.

**P2.2 — One canonical domain per site.**
- Docs: set `site: "https://docs.bpmnkit.com"` (or whatever the real production host is)
  and update the hard-coded `og:image` origin in `head[]`. Ensure the Cloudflare Pages
  `pages.dev` URL 301-redirects (or is `noindex`) to the custom domain so it isn't
  indexed as a duplicate. Fixes G3.
- Learn: set `site: "https://learn.bpmnkit.com"` in `apps/learn/astro.config.mjs`. Fixes G5.
- *Verify:* built canonicals + sitemap URLs all use `*.bpmnkit.com`; no `pages.dev`/
  `github.io` origins remain in output.

**P2.3 — Cross-site internal linking.** Landing → docs → learn → blog should link each
  other in headers/footers with descriptive anchor text (not "docs" but "BPMN 2.0 TypeScript
  documentation"). Consolidates topical authority across subdomains.
- *Verify:* each site's global nav/footer links the other two + the blog.

---

## 5. Phase 3 — Blog (content engine; launch after Phase 1–2)

**Where:** add a blog to `apps/landing` (keeps it on the apex domain `bpmnkit.com/blog`,
the strongest domain — better than a subdomain for authority consolidation). Alternatively
a dedicated `apps/blog` Astro app on `blog.bpmnkit.com`; **prefer `bpmnkit.com/blog`**.

**P3.1 — Blog infrastructure.**
- Astro content collection `apps/landing/src/content/blog/` with a Zod schema:
  `title, description, pubDate, updatedDate?, author, tags[], heroImage?, draft?`.
- Routes: `src/pages/blog/index.astro` (list, paginated), `src/pages/blog/[...slug].astro`
  (post), `src/pages/blog/tags/[tag].astro` (tag archives — extra indexable pages).
- Article layout using the shared `<Seo>` with `type: "article"` + Article JSON-LD (Phase 5).
- **RSS:** `@astrojs/rss` at `src/pages/rss.xml.ts`. Fixes G9.
- *Verify:* build emits post pages + `/rss.xml`; posts appear in sitemap; OG per post.

**P3.2 — Editorial calendar (target long-tail, developer-intent).** Suggested first
10 posts, each mapped to a query cluster and each ending in a CTA to the relevant package:

| Post | Primary query cluster | Links to |
|---|---|---|
| Generate BPMN 2.0 XML programmatically in TypeScript | "generate bpmn programmatically", "bpmn xml generator" | `@bpmnkit/core` |
| Migrating from bpmn-js: a headless alternative | "bpmn-js alternative", "bpmn-js headless" | editor/canvas |
| Connect to Camunda 8 from Node.js (Zeebe REST) | "camunda 8 node client", "zeebe rest api" | `@bpmnkit/api` |
| Auto-layout BPMN diagrams (Sugiyama) with zero deps | "bpmn auto layout", "bpmn diagram layout algorithm" | `@bpmnkit/core` |
| Evaluating FEEL expressions in TypeScript | "feel expression evaluator", "dmn feel js" | `@bpmnkit/feel` |
| Simulate a BPMN process without Camunda | "bpmn simulation", "test bpmn locally" | `@bpmnkit/engine` |
| Generating BPMN from natural language with an LLM | "ai generate bpmn", "llm workflow generation" | AI proxy/editor |
| Embedding a BPMN viewer in React | "react bpmn viewer", "embed bpmn diagram" | `@bpmnkit/canvas` |
| BPMN boundary events, explained with code | "bpmn boundary event example" | `@bpmnkit/core` |
| Building a Camunda 8 connector from an OpenAPI spec | "camunda connector openapi" | `@bpmnkit/connector-gen` |

**Cadence:** 2 posts/month sustainable is worth more than 10 then silence. Freshness +
consistency is the ranking signal. Repurpose existing `doc/guides/*` and `apps/docs/guides`
content as blog seeds — much is already written.

---

## 6. Phase 4 — Standalone discoverable pages (highest leverage)

These are evergreen, mostly buildable from existing data, and target the biggest keyword
spaces. **Prioritize this phase over volume-blogging.**

**P4.1 — BPMN glossary / concept hub** (informational intent, very high volume).
- `apps/learn` already has tutorials; add a `glossary`/concepts section: one page per BPMN
  concept — exclusive gateway, parallel gateway, inclusive gateway, boundary event, service
  task, user task, sub-process, message/timer event, call activity, etc. Each page: plain-English
  definition + rendered diagram (use `@bpmnkit/canvas`) + a code snippet building it with
  `@bpmnkit/core` + links to the relevant tutorial/blog. This turns "what is a bpmn X" traffic
  into product awareness.
- Source data: the 22 element type guards + `apps/learn/src/tutorials/*` already enumerate these.
- FAQ JSON-LD on each (Phase 5) → eligible for rich results.

**P4.2 — Comparison & alternative pages** (high commercial intent).
- `bpmnkit.com/compare/bpmn-js`, `/compare/camunda-modeler`, `/alternatives/zeebe-node`,
  `/compare/bpmn-io`. Honest feature tables (TS-native, zero-dep, headless, AI-native,
  auto-layout). These rank for "<competitor> alternative" — buyers with intent.
- *Verify:* each is a real indexable page with a canonical + comparison table + CTA.

**P4.3 — Use-case / solution pages.**
- `/use-cases/ai-workflow-generation`, `/use-cases/camunda-8-automation`,
  `/use-cases/embed-bpmn-editor`, `/use-cases/process-simulation`. One clear job-to-be-done
  per page, mapped to packages.

**P4.4 — Programmatic reference pages** (scale, from data we own).
- **Connector catalog:** we have 100+ connectors / 18,000+ endpoints (`@bpmnkit/connectors`,
  `connector-gen`). Generate one indexable page per connector (name, description, operations,
  code sample). This is the single largest programmatic-SEO opportunity in the repo — hundreds
  of long-tail pages ("camunda <service> connector"). Generate at build time from the connector
  manifests; guard against thin/duplicate content (each needs unique intro + real operation data).
- **FEEL function reference:** one page (or one section) per FEEL built-in from `@bpmnkit/feel`.
- **BPMN element API reference** already exists in docs; interlink it with the glossary (P4.1).
- *Verify:* generator script produces N pages, all in sitemap, each with unique title/description;
  add a thin-content check (min word count / unique body) to the generator.

> **Guardrail (per `CLAUDE.md` simplicity):** programmatic pages must not be thin doorway
> pages. Each needs genuinely unique, useful content (real diagram, real code, real data) or
> Google will treat them as spam. Better 150 substantive pages than 2,000 templated stubs.

---

## 7. Phase 5 — Structured data (JSON-LD)

Add via the shared `<Seo>`/a `<JsonLd>` helper in `astro-shared`:
- **`SoftwareApplication` / `SoftwareSourceCode`** on landing + package pages (name, OS,
  offers=free/open-source, `programmingLanguage: TypeScript`, repo URL).
- **`Organization`** (sitewide, in the shared head) — logo, sameAs (GitHub, npm, X).
- **`Article`** on every blog post (headline, datePublished, author, image).
- **`BreadcrumbList`** on docs/learn/blog (Starlight can supply structure).
- **`FAQPage`** on glossary + comparison pages (Q&A pairs) → rich results.
- *Verify:* Google Rich Results Test passes for one URL of each type; no schema errors.

---

## 8. Phase 6 — Distribution & measurement (ongoing)

- **Google Search Console + Bing Webmaster** for each domain/subdomain; submit sitemaps.
  Nothing below matters without this feedback loop.
- **Analytics** (privacy-friendly, e.g. Plausible) to see which pages convert to GitHub/npm.
- **Canonicalize npm ↔ site:** every published package's `homepage`/`repository` already
  points to `bpmnkit.com`/the monorepo (enforced by `CLAUDE.md`) — verify keywords are rich
  and READMEs (generated by `scripts/generate-readmes.mjs`) link back to docs/blog for backlinks.
- **Backlinks & seeding:** dev.to / Hashnode cross-posts (with canonical back to `bpmnkit.com`),
  Awesome-BPMN / Awesome-Camunda list PRs, answering relevant Stack Overflow / GitHub-discussion
  questions with links, submission to Camunda community.
- **Internal linking discipline:** every new blog post links ≥2 evergreen pages and ≥1 package;
  every glossary page links its tutorial + a post. Descriptive anchors, not "click here".

---

## 9. Keyword map (targets → surface)

| Intent | Example queries | Surface |
|---|---|---|
| Product / branded | bpmn typescript library, bpmn 2.0 sdk, generate bpmn code | landing, `core` page |
| Camunda / Zeebe | camunda 8 rest client node, zeebe typescript, deploy bpmn zeebe | `api` page, blog |
| Editor / viewer | embed bpmn editor react, bpmn viewer javascript, headless bpmn editor | editor/canvas pages, compare/bpmn-js |
| Informational | what is bpmn, bpmn exclusive gateway, bpmn boundary event | glossary/learn (P4.1) |
| DMN / FEEL | feel expression evaluator, dmn typescript | `feel` page, blog |
| AI | generate bpmn with ai, llm process automation | use-case page, blog |
| Comparison | bpmn-js alternative, camunda modeler alternative | compare pages (P4.2) |
| Long-tail programmatic | "<service> camunda connector", "<feel-fn> feel" | programmatic pages (P4.4) |

---

## 10. Recommended sequencing for the implementing agent

Ship in this order; each phase is independently deployable and verifiable.

1. **Phase 1** (foundation) — sitemap, robots, shared `<Seo>`, canonicals, OG. *Unblocks all.*
2. **Phase 2** (domain/brand unification) — one name, one domain each, cross-linking.
3. **Phase 5** (structured data) — cheap once `<Seo>` exists; do alongside Phase 2.
4. **Phase 4** (evergreen pages) — glossary → comparisons → use-cases → programmatic. *Biggest ROI.*
5. **Phase 3** (blog) — infra, then 2 posts/month against the calendar.
6. **Phase 6** (distribution/measurement) — set up early (GSC/analytics), sustain forever.

**First PR-sized chunk for Sonnet:** Phase 1 in full (P1.1–P1.4), since it's self-contained,
touches shared infra, and everything else depends on it.

---

## 11. Guardrails (from `CLAUDE.md`)

- **Shared, not scattered:** SEO config + `<Seo>` + JSON-LD helpers live once in
  `packages/astro-shared`; all sites consume them. Don't hand-roll `<head>` per page.
- **Simplicity first:** use `@astrojs/sitemap`, `@astrojs/rss`, native Astro content
  collections — don't hand-build what integrations provide. No speculative config.
- **devDependencies in root `package.json`**, runtime deps in the app that uses them.
- **No thin content:** programmatic pages must carry unique, real value or omit them.
- **Docs discipline:** log each change in `doc/progress.md`; check items in `doc/roadmap.md`
  (add an "SEO & Discoverability" section there). Update `doc/features.md` when pages ship.
- **Brand tokens:** any new page styling uses `--bpmnkit-*` tokens via `astro-shared`, no
  hardcoded brand colors.
- **Verify each phase** with a `pnpm turbo build` + view-source/Rich-Results check before moving on.
