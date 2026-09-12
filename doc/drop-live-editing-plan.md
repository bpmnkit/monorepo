# Drop — Live Editing: Action Plan

> Status: **plan, nothing implemented.** Written 2026-09-11. Third and last of three:
> `drop-collaborative-editing-analysis.md` (why single-writer), `drop-live-editing-design.md`
> (what to build), this one (in what order, and the bounded version log worked out).
> Where they disagree, this document is current.

**It contains one correction to the design document.** That document said to suppress a version
checkpoint when `semanticHash` is unchanged. `semanticHash` **deliberately excludes all diagram
interchange** — its own header says two documents that mean the same thing hash the same
"however they are laid out". Suppressing on it would silently discard an hour of pure layout
work as a no-op. Suppression must key on `content_hash`; `semanticHash` earns its place
elsewhere (§2.5).

---

## 1. Priorities at a glance

Five tracks. The ordering encodes one rule that is not negotiable:

> **Nothing that writes to a drop may ship before track B.** The version log is what makes
> anonymous, autosaving, mutable drops safe. Shipping autosave first is the reckless order.

| | Track | Delivers | Days | Depends on |
|---|---|---|---|---|
| **P0** | **A** — Author, then drop | A diagram can be created and shared without ever having a file | **1** | nothing |
| **P1** | **B** — The version log | Every edit is recoverable; the original can never be lost | **4.5** | nothing |
| **P2** | **C** — Browser history | Undo across a refresh, at zero server cost | **1** | B3 (panel placement) |
| **P3** | **D** — The room | The baton, live watching, autosave | **9.5** | B |
| **P4** | **E** — Hardening | Abuse, caps, carve-outs | **2.75** | D |

**≈ 19 working days ≈ 4 weeks** for all of it.

This is larger than the "~2–2.5 weeks" in the design document, and the reason is scope, not
re-estimation: the version log there was a table and a retention rule, and here it is a real
feature with a history list, a diff view, restore, and a provable bound. That is the right
trade, but it should be a deliberate one.

**Track A ships on its own, this week, and is not blocked by anything.** Track B ships on its
own too and is independently useful (the drop page gains a "history" affordance showing a single
original — dull, but the schema and the UI are then live and proven before anything writes).

---

## 2. The version log, worked out

This is the part that was asked for in detail, so it comes before the task list.

### 2.1 The requirement, restated

- Bounded, visibly and provably. Not "we prune sometimes".
- The first version is kept **always**.
- About ten milestones after that.
- History the browser can hold does not belong on the server.
- Within a timeframe — an hour was suggested — many changes collapse into one milestone.
- All of it inside the Cloudflare free tier.

Every one of those is right. Two refinements follow.

### 2.2 The original does not need a row at all

`file_content` already stores each file twice: `rep = 'original'` (the uploaded bytes, verbatim)
and `rep = 'json'`. **Nothing in the codebase ever updates those rows** — `insertDrop` writes
them once and only `deleteDrop` / `deleteExpired` remove them.

So do not copy the upload into the version log. Instead:

- add `rep = 'current'` for the live edited XML, and **never write to `'original'`**;
- `/drop/:id/f/:filename` serves `'current'` when it exists, else `'original'`;
- the share page's **Original** download is pinned to `'original'` explicitly;
- `file_versions` holds only milestones 1…10.

"The original can never be lost" then stops being a promise and becomes a property of the
schema: one grep proves no code path writes that row, and one test pins it. It also halves the
storage, and a drop nobody edits costs exactly what it costs today.

### 2.3 The ring: eleven entries, forever

```sql
CREATE TABLE file_versions (
  file_id       TEXT    NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,          -- 1..N, monotonic per file; 0 is file_content.original
  bucket        TEXT    NOT NULL,          -- "<hour>:<session>" — the collapse key, §2.4
  body          TEXT    NOT NULL,          -- full XML, <= MAX_ROW_BYTES
  content_hash  TEXT    NOT NULL,          -- suppression key, §2.5
  semantic_hash TEXT    NOT NULL,          -- labelling only, §2.5
  op_count      INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (file_id, seq)
);
CREATE UNIQUE INDEX idx_versions_bucket ON file_versions (file_id, bucket);
```

**`MAX_MILESTONES = 10`.** After every insert, in the same batch:

```sql
DELETE FROM file_versions
 WHERE file_id = ?
   AND seq NOT IN (SELECT seq FROM file_versions WHERE file_id = ?
                    ORDER BY seq DESC LIMIT 10);
```

The invariant is then flat and testable in one line: **a file has at most 10 rows in
`file_versions`, plus its untouchable original. Eleven states, always, no matter what anyone
does.** Write that test first; it is the whole safety argument.

The UI should say it just as plainly — *"The original, plus the last 10 milestones"* — rather
than implying an archive that does not exist.

### 2.4 The collapse key: one hour, and one session

The hour bucket is the right instinct. It needs one addition, and the reason is the specific
thing the version log exists for.

> Anna edits well from 10:00 to 10:30. A stranger opens the link and wrecks it at 10:45. Same
> hour. With an hour-only bucket, the stranger's save **overwrites Anna's milestone**. The
> original survives, so nothing is unrecoverable — but Anna's half hour is gone, in exactly the
> window the feature was built for.

So the bucket key is `"<hourBucket>:<sessionId>"`, where `sessionId` is the baton grant id:

- **Within one editing session, one milestone per hour.** A three-hour session leaves three.
- **A new session always starts a new milestone.** One person's work is never overwritten by the
  next person's.
- Rapid claim/release churn cannot burn the ring, because §2.5 suppresses sessions that changed
  nothing.

This is one extra column and one condition. If it still feels like too much, hour-only is a
defensible fallback and the guarantee in §2.3 survives — but the failure above is the likely one,
not an exotic one.

### 2.5 What suppresses a milestone, and what labels it — the correction

**Suppress on `content_hash`.** If the sha256 of the serialised XML has not moved since the last
milestone, write nothing. That kills "opened it, panned around, took the baton, left" for free.

**Do not suppress on `semanticHash`.** From its own documentation:

> *"Two documents that mean the same thing hash the same, however they are laid out […]
> **Diagram interchange (`diagrams`) entirely** — shapes, edges, waypoints […] are where a
> layout lives."*

An hour spent aligning a diagram changes no semantics at all. Suppressing on it would throw that
hour away and call it a no-op. The design document said to do this; it was wrong.

`semanticHash` is still worth storing, for **labelling**. Comparing both hashes against the
previous milestone classifies it at zero cost:

| `content_hash` | `semanticHash` | Milestone reads |
|---|---|---|
| unchanged | unchanged | *not written* |
| changed | unchanged | **Layout only** — 14 shapes moved |
| changed | changed | **Model changed** — 2 tasks added, 1 flow removed |

The counts come from `diffDiagram` / `diffSemantics`, which already ship. A history list that
distinguishes "someone tidied the layout" from "someone changed what this process does" is
worth far more than a list of timestamps, and it costs one column.

### 2.6 The browser half is already written

`@bpmnkit/plugins/history` already implements exactly what was described, and it does not depend
on the storage plugin — `saveCheckpoint(projectId, fileId, xml)` and
`listCheckpoints(projectId, fileId)` take plain opaque strings, so Drop passes
`(shareId, filename)`.

Its retention is already bounded, and along the same lines: **50 checkpoints from today, then one
per day for 10 days**, pruned inside the same IndexedDB transaction that writes. `createHistoryPanel({ getCurrentContext })` is a 180-line UI on top.

So track C is wiring, not building. Two things to be clear about:

- **Local history and server history are not substitutes.** Local history is per-browser and
  per-device: it gives the editor undo that survives a refresh. It does nothing for the case the
  server log exists for — someone else changed your drop, and you are on another machine. Both,
  for different jobs.
- **Local checkpoints are free and should be frequent** (every ~30s of dirty editing, and on
  blur). Server milestones are scarce and should be rare. That asymmetry is the whole point.

### 2.7 The budget

Per file, worst case: 10 × 900 KB = **9 MB**. Realistic BPMN is 10–50 KB, so **330 KB**. Against
the 5 GB D1 free tier that is roughly **15,000 actively-edited files**, and unedited drops cost
nothing extra at all.

Writes, per hour of *active* editing in one room:

| Sink | Per hour | Free/day | Headroom |
|---|---|---|---|
| DO SQLite — one row per committed op | ~200 | 100,000 rows | ~500 room-hours |
| D1 — flush `file_content` + `drops`, every 30s while dirty | ~240 | 100,000 writes | — |
| D1 — milestone insert + prune | ≤ 2 | — | — |
| **D1 total** | **~242** | **100,000** | **~410 room-hours/day** |

~410 hours of active editing per day is about 17 people editing continuously, around the clock.

Two details make that comfortable rather than tight:

- **The flush is every 30 seconds, not every 2 seconds** as the design document had it. The DO's
  own SQLite is the durability layer and is unbilled on the free plan; D1 is the store of record
  and only needs to be *fresh*, not *live*. Anyone who opens the page connects to the room and
  gets `welcome { version, defs }`, which corrects any staleness immediately — so D1 lag is
  invisible except to `curl` and the CLI.
- **Duration is not a constraint.** Cloudflare bills duration on eligibility to hibernate, not on
  eviction: a room idle between two keystrokes accrues nothing. The room must therefore reload
  its snapshot on wake rather than trust a field — `blockConcurrencyWhile` plus a `JSON.parse` of
  a few tens of kilobytes, which is sub-millisecond.

And one that runs the other way: **track D1 makes Drop cheaper.** `recordView` writes to D1 on
*every single page view* today (`handleSharePage`). Debouncing it into the room removes the
largest write on the read path — likely more writes than editing will ever add.

---

## 3. The work

Every item has an acceptance check, because "done" on a plan like this is otherwise a matter of
opinion.

### Track A — Author, then drop · P0 · 1 day · no dependencies

| # | Task | Est | Acceptance |
|---|---|---|---|
| **A1** | *Share as a drop* on `/editor`: `exportXml()` → `new File([xml], "diagram.bpmn")` → `FormData` → existing `POST /drop/api/drops`. Show the returned link with copy/open. Add the Terms line next to the button (upload is a passive acknowledgment and records `tos_version`) | 0.5d | Author a diagram on `/editor`, click share, open the returned link, see the diagram render. **No Worker changes in the diff.** |
| **A2** | localStorage draft on `/editor` — write on `diagram:change` (debounced), restore on load behind an explicit *"Restore your draft?"* prompt, clear on successful share | 0.5d | Edit, hard-refresh, accept the prompt, get the work back. Decline it and the draft is gone. |

**Recommendation: the button on `/editor`, not a new `/drop/new`.** A second editor embed means
duplicating ~570 lines of wiring across two build systems (Astro and the Worker's esbuild
bundle) and maintaining both. Add a link from the drop page hero — *"…or start from a blank
canvas"* — and revisit only if funnel data says the detour costs conversions.

### Track B — The version log · P1 · 4.5 days · blocks all of D

| # | Task | Est | Acceptance |
|---|---|---|---|
| **B1** | Migration `0003`: `rep = 'current'` permitted in `file_content`; `file_versions` per §2.3; `drops.updated_at`. Serve `'current'` else `'original'` from `/f/:filename`; pin the **Original** link to `'original'` | 1d | A test asserts no code path writes `rep = 'original'` after insert. Existing drops are unaffected — no `'current'` row, same bytes served. |
| **B2** | `appendMilestone(fileId, xml, sessionId, now)` in `lib/db.ts`: bucket key (§2.4), `content_hash` suppression (§2.5), insert-or-upsert, prune to 10, all in one `db.batch()` | 1.5d | **Write this test first:** 500 synthetic saves across 40 hours and 12 sessions leave exactly 10 rows. A save with an unchanged `content_hash` leaves the row count and `created_at` untouched. |
| **B3** | History UI: `GET /drop/:id/history`, `GET /drop/:id/v/:seq`, and a history list on the share page — timestamp, the §2.5 label, and its change counts from `diffDiagram` | 1.5d | Seed a file with 3 milestones; the list shows 4 entries ending in *Original*, each labelled *Layout only* or *Model changed* correctly. |
| **B4** | Restore: `POST /drop/:id/restore/:seq` writes the chosen body as the new `'current'` and cuts a milestone — restore is an append, never a rewind | 0.5d | Restore milestone 2, then restore the original; both round-trip byte-exact and each leaves a new milestone. Row count still ≤ 10. |

**Recommendation: build B in this order and merge it before touching the room.** B3 gives you a
UI to prove B2 against, which is much easier than asserting on a table. And a history that exists
before the first write is the difference between a safety net and an apology.

### Track C — Browser history · P2 · 1 day

| # | Task | Est | Acceptance |
|---|---|---|---|
| **C1** | Call `saveCheckpoint(shareId, filename, xml)` from the editor's change handler, debounced ~30s and on blur | 0.5d | Edit, refresh, and the local checkpoints are listed. Pruning holds at 50-today / 10-days without extra code. |
| **C2** | Mount `createHistoryPanel({ getCurrentContext })` in the drop editor, alongside the server history from B3 and clearly distinguished from it | 0.5d | The panel shows local checkpoints; restoring one loads it into the editor as an ordinary edit. |

**Recommendation: label the two histories differently in the UI and never merge them into one
list.** *"On this device"* and *"Saved milestones"* answer different questions, and a merged list
would quietly imply your local checkpoints are shared — they are not.

### Track D — The room · P3 · 9.5 days · requires B

| # | Task | Est | Acceptance |
|---|---|---|---|
| **D1** | `PresenceRoom` → `DocRoom`: keep the head-count, add debounced `view_count` / `last_viewed_at` (the idea `drop-spec.md` §6 listed and never built), register the class in `wrangler.jsonc` — note the July 2026 declarative `exports` field now supersedes `migrations` | 1d | Presence still works. 50 page views produce **one** D1 write, not 50. |
| **D2** | Baton: `claim` / `granted` / `denied` / `release`; tag the holder's socket `acceptWebSocket(ws, ["holder"])`; `setWebSocketAutoResponse` for heartbeats; idle reclaim on the alarm via `getWebSocketAutoResponseTimestamp` | 1.5d | Two tabs claim simultaneously → exactly one wins. Kill a tab → freed within seconds. Hold it and go idle → reclaimed after the window, with a warning first. |
| **D3** | `@bpmnkit/editor`: injectable ids (22 `genId()` sites — an id must travel *in* the op to replay); an op-describing change event; `getViewport`/`setViewport` public on the canvas | 1d | Same op replayed on two machines yields byte-identical XML. Existing editor tests still pass. |
| **D4** | Op protocol + server-side replay: the room applies the same `modeling.ts` function, validates referential integrity and DI completeness, versions, appends to DO SQLite, broadcasts `{ version, op, hash }` | 2d | An op from a non-holder is rejected. An op that would dangle a reference is rejected with a reason, not applied. The room survives hibernation mid-session. |
| **D5** | Watcher replay: apply the op locally, compare the hash, `resync` on mismatch. Optional: flash the touched elements with the existing `highlight()` | 1.5d | Writer's commits land in two watchers. A deliberately corrupted watcher state triggers exactly one resync and recovers. |
| **D6** | Editor on claim: dynamic `import()` of the editor chunk, carry `ViewportState` across the swap, HUD hidden for watchers | 1d | The watcher bundle stays ≈59 KB gzipped; the editor chunk is fetched only on claim. The diagram does not jump when the editor mounts. |
| **D7** | Autosave: alarm every 30s while dirty → `exportPreserving` → `'current'` + `drops.updated_at`; milestone per §2.4 on hour boundary and on release | 1.5d | Kill the writer's tab mid-session; reload and the last committed command is there. One hour of continuous editing produces **one** milestone. |

**Recommendation on sequencing inside D:** D1 alone is worth merging on its own — it reduces D1
writes and touches no editing behaviour, so it is a safe first contact with the room. D3 is a
cross-package change to a published package; land it early so it can bake.

**One shortcut worth naming and not taking.** Editing could ship far sooner without the room at
all: click Edit, and the client `PUT`s the whole file every 30 seconds. That is roughly a week
instead of three — but it is last-write-wins between two anonymous strangers with no signal that
it happened, and it throws away the live-watching feature that prompted this. Track B would make
it *recoverable*, which is not the same as *correct*. Mentioned because it is the obvious
temptation; the recommendation is to skip it.

### Track E — Hardening · P4 · 2.75 days

| # | Task | Est | Acceptance |
|---|---|---|---|
| **E1** | On each flush: re-hash and re-check `banned_hashes` (halt the room on a match); enforce `MAX_ROW_BYTES` on save with a real message; make the `/f/:filename` ETag version-derived rather than content-hash-derived | 1d | A banned hash halts an active room. A 1 MB save fails with an actionable error, not a silent D1 failure. |
| **E2** | Turnstile on `claim` — one challenge per session, not per op | 0.5d | A scripted claim without a token is refused; a human sees nothing. |
| **E3** | Carve-outs: the demo drop (no D1 row) offers *"edit a copy"*; pinned drops (`expires_at IS NULL`) are read-only; gate **Edit** on `processes.length === 1` with a stated reason | 0.5d | All three enforced server-side, not by hiding a button. |
| **E4** | Retention slides on edit as well as view | 0.25d | An actively-edited drop does not expire underneath the people editing it. |
| **E5** | Reports carry the version the reporter saw | 0.5d | The admin queue shows the content as reported, not as since-edited. |

---

## 4. Recommendations, condensed

1. **Ship track A this week.** One day, no dependencies, no Worker changes, and it closes the
   "you can only share a file you already have" gap on its own.
2. **Merge track B before any code that writes to a drop.** Structural, not advisory: D7 depends
   on B2.
3. **Eleven states per file, forever** — the untouchable original plus 10 rolling milestones.
   Bound it in a test before writing the feature, and say it in the UI in those words.
4. **Never write to `rep = 'original'`.** It makes "the original survives" a property of the
   schema instead of a promise, and costs nothing.
5. **Suppress on `content_hash`, label with `semanticHash`.** The design document's suppression
   rule was wrong and would have thrown away layout-only sessions.
6. **Bucket on hour *and* session,** so one person's work is never overwritten by the next
   person's inside the same hour.
7. **Flush to D1 every 30 seconds, not every 2.** The room is the durability layer; D1 only needs
   to be fresh, and the room corrects any staleness on connect.
8. **Reuse `@bpmnkit/plugins/history` as-is** for browser-side history, and keep the two
   histories visibly separate — they answer different questions.
9. **Do not take the PUT-every-30s shortcut.** It buys two weeks and sells the feature.

## 5. Still open

1. **`MAX_MILESTONES = 10` — a product number, not a derived one.** Ten is what was asked for and
   is comfortable at any plausible file size. It is one constant.
2. **Is hour-only bucketing good enough?** §2.4 argues no; the counter-argument is one fewer
   column.
3. **The idle window.** Ten minutes with a sixty-second warning is a guess, not a measurement.
4. **Does the baton queue?** *"Request control"* could hand over on release. Half a day, nicer,
   not required.
5. **Do watchers see a name?** There is no identity, so it would be a per-tab random animal, as
   the original spec suggested for presence. Cheap, but it invents a persona the product does not
   otherwise have.
