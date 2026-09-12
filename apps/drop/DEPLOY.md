# Deploying Drop

A runbook for taking `apps/drop` from a fresh clone to live, on your own Cloudflare account.
One script does the work; this page is what to have ready before you run it, and how to check
it afterwards.

Everything here fits inside Cloudflare's free tier.

---

## What you are deploying

One Worker, and four things attached to it:

| Piece | What it is |
|---|---|
| Worker | The whole app — pages, upload API, admin, and the room |
| D1 database | `bpmnkit-drop`: drops, files, the version log, reports, ban list |
| Durable Object | `DocRoom` — one per drop: presence, the edit baton, live ops, autosave |
| Static assets | `public/drop/` — client bundles and fonts, built from source |
| Cron trigger | Daily at 03:17 UTC, deleting drops past their expiry |

---

## Before you start

**Tools.** Node LTS, pnpm, and `wrangler` (it comes with the repo — `pnpm install` is enough).
Optional: the [`gh` CLI](https://cli.github.com), if you want the script to set up CI for you.

**A Cloudflare account.** Free is fine. No card needed.

**A domain on Cloudflare — optional.** Without one you get a `*.workers.dev` URL, which works
completely. With one, the Worker can serve `yourdomain.com/drop*`.

```sh
pnpm install
pnpm --filter @bpmnkit/drop test    # optional: 174 tests, ~3s
```

---

## Step 1 — Log in

```sh
npx wrangler login
```

A browser opens; approve the access. Check it took:

```sh
npx wrangler whoami
```

Note the **Account ID** it prints — the script can usually read it for you, but have it to hand.

---

## Step 2 — Create a Turnstile widget *(recommended)*

**Do this before running the script**, so you can paste the keys when it asks instead of
aborting halfway.

A drop is editable by anyone who has the link. Turnstile is what stands between that and a
script rewriting every drop it can find. It is free, with no request cap, and a person is
challenged **once per editing session** — not per keystroke.

1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add widget**.
2. Name it anything (`bpmnkit-drop`).
3. Hostnames: your domain, or `<your-subdomain>.workers.dev` if you have no domain.
   Add `localhost` too if you want to exercise it locally.
4. Widget mode: **Managed**.
5. Copy both keys:
   - **Site key** (`0x4AAA…`) — public, goes in `wrangler.jsonc`
   - **Secret key** (`0x4AAA…`) — goes in a Worker secret

> **Skipping this is a real decision, not a formality.** Without it, anyone with a link can edit
> a drop with nothing in the way. The script says so in yellow at the end if you skip it.

---

## Step 3 — Create a CI API token *(optional)*

Only needed if you want pushes to `main` to deploy automatically. Skip if you will deploy by
hand.

1. Go to **[API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token →
   Create Custom Token**.
2. Permissions — add all three:
   - `Account` → `D1` → `Edit`
   - `Account` → `Workers Scripts` → `Edit`
   - `Zone` → `Workers Routes` → `Edit` *(only if you are using a custom domain)*
3. Account Resources: your account. Zone Resources: your zone, if you added the zone permission.
4. Create, and **copy the token** — it is shown once.

---

## Step 4 — Run it

```sh
pnpm --filter @bpmnkit/drop provision
```

It is idempotent: re-running skips whatever already exists, so it works as a repair tool too.

What it asks, in order:

| Prompt | What to answer |
|---|---|
| Route `yourdomain.com/drop*`? | `y` if your domain is on Cloudflare, else `n` for the `workers.dev` URL |
| Enable AI review (`AI_PASSCODE`)? | `n` unless you want the closed-beta AI review |
| Turnstile site key | Paste from step 2, or blank to skip |
| Turnstile secret key | Paste when wrangler prompts — input is hidden |
| Set GitHub secrets? | `y` if you did step 3 and have `gh` authenticated |
| Cloudflare API token | Paste from step 3 |

What it does without asking: creates the D1 database and writes its id into `wrangler.jsonc`,
applies every migration, builds the client bundles, deploys the Worker, and generates
`DROP_ADMIN_TOKEN` and `REPORT_IP_SALT`.

**Save the admin token it prints at the end — it is shown once.** You need it for `/drop/admin`.
Lost it? Run `npx wrangler secret put DROP_ADMIN_TOKEN` with a new value.

The script finishes by making three requests against what it just deployed:

```
▸ Checking the deployment answers
  ✓ D1 + Worker — 200 https://…/drop/api/stats
  ✓ demo page — 200 https://…/drop/demo-loan-approval
  ✓ client bundle — 200 https://…/drop/assets/viewer.js
```

Three ticks means the Worker, the database and the assets are all really there.

---

## Step 5 — Try it by hand

The smoke test proves it answers. This proves it works.

1. **Open** `https://<your-url>/drop` and drag a `.bpmn` file in — anything from
   `bpmn-samples/` in this repo.
2. **Follow the share link.** The diagram renders.
3. **Press Edit.** If you set up Turnstile you get one challenge, then a palette and toolbar.
4. **Open the same link in a second tab.** Move something in the first. The second follows it
   live, and the header reads `2 VIEWING · 1 EDITING`.
5. **Press Done**, wait half a minute, then reload. The change is still there — that is the
   autosave.
6. **Open History.** The original is pinned at the bottom; your session is a milestone above it,
   labelled *layout only* or *model changed*.
7. **Open** `https://<your-url>/drop/admin` and paste the admin token. The report queue loads.

---

## Step 6 — Turn on CI *(optional)*

If step 3 and the `gh` prompt both went through, you are done: pushing to `main` deploys
whenever anything under `apps/drop/`, `packages/core/`, `packages/canvas/`, `packages/editor/`,
`packages/plugins/` or `packages/ui/` changes.

To check, push anything and watch **Actions → Deploy Drop**. To set the secrets by hand instead:

```sh
gh secret set CLOUDFLARE_ACCOUNT_ID --body "<account id from step 1>"
gh secret set CLOUDFLARE_DROP_API_TOKEN --body "<token from step 3>"
```

---

## Changing things later

| Want to | Do |
|---|---|
| Rotate the admin token | `npx wrangler secret put DROP_ADMIN_TOKEN` |
| Turn Turnstile on later | Re-run `provision` — it picks up where it left off |
| Turn Turnstile off | `npx wrangler secret delete TURNSTILE_SECRET` |
| Change the Turnstile keys | Re-run `provision`, or edit `TURNSTILE_SITE_KEY` in `wrangler.jsonc` and redeploy |
| Turn AI review on | `npx wrangler secret put AI_PASSCODE` |
| Bump the Terms version | Edit `TOS_VERSION` in `wrangler.jsonc`, redeploy |
| Deploy a change by hand | `pnpm --filter @bpmnkit/drop deploy` |
| Add a migration | Drop a `.sql` in `migrations/`; the next deploy applies it |

---

## When something goes wrong

| Symptom | Cause and fix |
|---|---|
| `Not logged in to Cloudflare` | `npx wrangler login` |
| Deploy fails on the route | Your domain is not on this Cloudflare account. Answer `n` to the route prompt and use the `workers.dev` URL |
| `✗ D1 + Worker` in the smoke test | Migrations did not apply. `npx wrangler d1 migrations apply bpmnkit-drop --remote` |
| `✗ client bundle` | The build did not run. `pnpm turbo build --filter @bpmnkit/drop`, then deploy again |
| Edit button does nothing, console mentions `challenges.cloudflare.com` | The Turnstile script is blocked — by an extension, or the hostname is not on the widget's list |
| Edit is refused with *"That check did not go through"* | `TURNSTILE_SECRET` is set but the site key is missing or from a different widget. Re-run `provision` |
| Edit is refused, no challenge shown | The drop is pinned, the demo, or has more than one process — the tooltip on the button says which |
| Admin page rejects the token | `DROP_ADMIN_TOKEN` was regenerated by a later `provision` run, or never set |
| CI runs and fails at the first wrangler step | `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DROP_API_TOKEN` missing — step 6 |
| CI succeeds but nothing changes | The push touched no path in the workflow's trigger list. Use **Actions → Deploy Drop → Run workflow** |

---

## What it costs

Nothing, at any plausible scale for this. The free tier gives 100k Worker requests/day, 100k
Durable Object requests/day and 13,000 GB-s, and 5 GB of D1 with 100k writes/day.

The design keeps well inside that deliberately: hibernating WebSockets mean idle viewers cost
no duration, views are batched into one D1 write per minute per drop rather than one per page
load, and the autosave writes every 30 seconds while someone is editing rather than on every
keystroke. `doc/drop-live-editing-plan.md` §2.7 has the arithmetic — roughly 400 hours of
continuous editing per day before anything gets close.
