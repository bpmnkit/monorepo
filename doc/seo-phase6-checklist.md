# SEO Phase 6 — Distribution & Measurement Checklist

> Companion to [`doc/seo-plan.md`](seo-plan.md). Phases 1–5 (technical foundation,
> domain/brand unification, evergreen pages, blog, structured data) are done — see
> `doc/roadmap.md`'s "SEO & Discoverability" section. **Nothing in this document can be
> done from the repo.** It requires domain ownership, third-party account creation, and
> human judgment calls (what to post where, who to contact) — this is a checklist for
> whoever holds those credentials, not a coding task.

## Prerequisites

- Admin/DNS access to `bpmnkit.com` (needed for domain-wide Search Console verification
  and any analytics DNS-based setup).
- The three sites already live and serving the sitemap/robots.txt this repo generates:
  - `https://bpmnkit.com/sitemap-index.xml`
  - `https://docs.bpmnkit.com/sitemap-index.xml`
  - `https://learn.bpmnkit.com/sitemap-index.xml`

  Confirm these resolve before starting — Search Console will fail silently on a 404.

## 1. Google Search Console

1. Go to [search.google.com/search-console](https://search.google.com/search-console).
2. Add a **Domain property** for `bpmnkit.com` (not a URL-prefix property) — this is the
   important choice: a domain property verified via DNS covers `bpmnkit.com`,
   `docs.bpmnkit.com`, and `learn.bpmnkit.com` in one verification, since they're all
   subdomains of the same registrable domain. Verify via the DNS TXT record Google gives
   you, added at the domain registrar/DNS provider.
3. Once verified, under **Sitemaps**, submit all three:
   - `sitemap-index.xml` (relative to `bpmnkit.com`)
   - `https://docs.bpmnkit.com/sitemap-index.xml`
   - `https://learn.bpmnkit.com/sitemap-index.xml`
4. Under **URL Inspection**, spot-check that the homepage of each site and one deep page
   (e.g. a `/connectors/<id>` page, a glossary page, a blog post) can be indexed —
   "Coverage" errors here (usually `noindex`, blocked by robots.txt, or a redirect loop)
   are worth fixing immediately since they silently affect every page of that type.
5. Set the **International targeting** / preferred domain if applicable (not usually
   needed for an English-only, non-geo-targeted product site).

## 2. Bing Webmaster Tools

1. Go to [bing.com/webmasters](https://www.bing.com/webmasters).
2. Use the **"Import from Google Search Console"** option — this imports verification and
   sitemap submission in one step once GSC is set up (step 1), rather than repeating DNS
   verification.
3. Submit the same three sitemap URLs if the import doesn't carry them over automatically.

## 3. Analytics

No analytics is wired into the codebase today (deliberately — adding a third-party
script tag with no account behind it would just be dead weight). Once an account exists:

1. Pick a privacy-friendly, cookie-consent-free analytics provider — **Plausible** or
   **Fathom** are reasonable defaults for a developer-tool site (no cookie banner
   required in the EU, which matters more for conversion than raw feature count).
2. Create one site entry per domain (`bpmnkit.com`, `docs.bpmnkit.com`,
   `learn.bpmnkit.com`) or one shared property with subdomain tracking, depending on the
   provider's model.
3. Add the tracking script. The natural place in this codebase is the shared `<Seo>`
   component (`packages/astro-shared/src/Seo.astro`) so it's wired once and applies
   everywhere — add it as a new optional prop or a separate `<Analytics>` component in
   the same package, gated so dev builds don't report. This is a small follow-up PR once
   an account/site-ID exists; there's no useful stub to add before that.
4. What to actually watch: which of `/connectors`, `/compare`, `/use-cases`, `/blog`,
   and `/glossary` pages drive outbound clicks to `github.com/bpmnkit/monorepo` or
   `npmjs.com/org/bpmnkit` — that's the real conversion event for a library, not
   pageviews.

## 4. Backlinks & outreach

Concrete, specific targets — not generic "build backlinks" advice:

- **Awesome-lists**: submit a PR to `awesome-camunda`/`awesome-bpmn`-style curated lists
  if they exist and accept submissions (search GitHub for current maintained ones before
  assuming a specific repo name — these lists come and go). Link to `bpmnkit.com`, not a
  subpage.
- **Camunda community**: the [Camunda Forum](https://forum.camunda.io/) is the highest-
  relevance place to mention the project — genuinely helpful answers to real questions
  (not drive-by link drops) that happen to reference a relevant BPMN Kit page. This is
  the single highest-leverage channel given the shared audience.
- **dev.to / Hashnode cross-posts**: republish 2–3 of the 10 existing blog posts
  (`apps/landing/src/content/blog/`) with a `canonical_url` front-matter field pointing
  back to the `bpmnkit.com/blog/<slug>` original, so the cross-post doesn't compete with
  or dilute the source page in search. Good first candidates: "Generate BPMN 2.0
  diagrams programmatically" and "Simulate a BPMN process without Camunda" — the two
  with the broadest (non-Camunda-specific) developer appeal.
- **Stack Overflow**: monitor the `bpmn`, `camunda`, and `zeebe` tags for questions the
  existing content genuinely answers (e.g. "how do I generate BPMN programmatically",
  "bpmn-js alternative for Node.js") — answer with a real, complete answer, and link to
  the matching glossary/blog/compare page as a *reference*, not as the whole answer.
- **npm/GitHub discoverability** (already done, verify periodically): every published
  package's `README.md`/`package.json` links back to `bpmnkit.com` and the GitHub repo —
  this is enforced by `CLAUDE.md` and generated by `scripts/generate-readmes.mjs` /
  checked by `scripts/check-packages.mjs`. Re-run `node scripts/check-packages.mjs`
  after adding any new published package to confirm it still passes.

## 5. Ongoing cadence

| Cadence | Task |
|---|---|
| Weekly (first month), then monthly | Check Search Console Coverage report for new errors (404s, `noindex` surprises, redirect issues) |
| Monthly | Check which pages/queries are gaining impressions in Search Console's Performance report — use this to decide what to write next, not the original guesswork in `doc/seo-plan.md` |
| Per new blog post | Publish → submit the specific post URL via Search Console's URL Inspection "Request Indexing" (sitemap crawl alone can take days) → cross-post to dev.to a few days later with `canonical_url` set |
| Per new package/page | Confirm it appears in the relevant sitemap after the next deploy; if not, check the `astro.config.mjs` `site` value and the `@astrojs/sitemap` integration is still wired |
| Quarterly | Revisit `doc/seo-plan.md`'s keyword map against actual Search Console query data — the plan was written from best-guess keyword research, not real query data, and should be corrected once real data exists |

## What NOT to do

- Don't buy backlinks or use link-exchange schemes — Google's spam policies penalize
  this, and it's a worse ROI than the organic channels above for a technical product.
- Don't keyword-stuff new pages to chase the terms in `doc/seo-plan.md`'s keyword map —
  those are *targets to write genuinely useful content around*, not strings to repeat.
- Don't skip the Search Console Coverage check after a deploy that changes routing
  (e.g. adding/removing a page, changing `build.format`) — the canonical-URL bug fixed
  in Phase 1 (`Astro.url.pathname` resolving to `.html`) is exactly the kind of silent
  regression that only shows up there, not in a visual QA pass.
