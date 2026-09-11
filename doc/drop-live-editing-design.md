# Drop — Live Editing: Design

> Status: **design, nothing implemented.** Written 2026-09-11, following
> `doc/drop-collaborative-editing-analysis.md`. That document asked whether simultaneous
> multi-writer editing was worth it and concluded mostly not; this one designs what was chosen
> instead. Where the two disagree, this one is current.

Four decisions came back from the analysis:

1. **Author before dropping** — an editor on the way *in*, so a drop can be created, not only uploaded.
2. **Live single-writer editing** — three people open a drop, one takes edit mode, the other two watch it change. Nobody else can edit while they hold it.
3. **Anyone with the link may edit.** No login exists, so no other option is reasonable.
4. **Autosave.** No explicit save action, ever.

(2) is Option A from the analysis — the edit baton — which was already the recommendation. (1)
is nearly free. (3) and (4) are both reasonable, and together they rule out the analysis's
headline recommendation. That is the one thing worth settling first.

---

## 1. The collision, and how it resolves

The analysis recommended **fork on edit**: editing a drop produces a new one, the original stays
byte-identical, and every invariant the schema leans on survives untouched.

Requirements (2) and (4) rule that out, and it is worth being explicit about why:

- **Live watching requires one document.** If the editor forks, the two watchers are looking at
  a share id the writer has already left. "All other viewers see live how the BPMN is changed"
  is only true if everyone stays on the same `shareId`.
- **Autosave requires a mutable target.** A save button is what makes "fork now" a moment you
  can point at. Without one there is no such moment — continuous saving has to save *somewhere*,
  continuously.

So drops become mutable. That is the change of product category the analysis flagged, and
accepting it means accepting its consequences (§7 below). One of them matters enough to be a
design requirement rather than a caveat:

> **Anonymous + mutable + autosave + no save button = a stranger can silently destroy the
> original, and nothing records that it happened.**

The fix is not identity. It is **an append-only version log**. Version 0 is the uploaded file
and is never deleted; every autosave checkpoint appends rather than overwrites; the share page
can show the history, diff any two entries with the already-shipped `diffDiagram`, and restore
one — where restoring is itself just another append.

That single decision is what makes (3) safe. Anonymity is fine when nothing is destroyed. It is
not fine when it is. **This is the one part of the design that is not optional.**

---

## 2. Feature 1 — author, then drop

**This is mostly connecting two things that already ship**, and it is worth saying so before
scoping it as new work:

- `apps/landing/src/pages/editor.astro` is already a full BPMN editor on `bpmnkit.com/editor`,
  mounting `BpmnEditor` + `initEditorHud` + `createSideDock` (`apps/landing/src/scripts/editor.ts:463`).
- `createEmptyDefinitions()` is already exported from `@bpmnkit/editor`.
- `applyAutoLayout` / `editor.autoLayout()` already exist, so a generated or hand-built diagram
  can be laid out properly rather than stacked at the origin.
- The upload endpoint takes `multipart/form-data` with a `files` field
  (`src/routes/upload.ts`), and the client already builds it as
  `body.append("files", file, file.name)` (`src/client/drop.ts:56`).

So the whole feature, server-side, is:

```js
const xml  = editor.exportXml()
const body = new FormData()
body.append("files", new File([xml], "diagram.bpmn"), "diagram.bpmn")
await fetch("/drop/api/drops", { method: "POST", body })
```

**Zero Worker changes.** Same origin, so no CORS. `validateFile` parses and sizes it exactly as
it would an uploaded file, which is the right behaviour — an authored diagram should clear the
same gate as a dropped one.

Two real decisions remain:

- **Where does the button live?** Adding *"Share as a drop"* to the existing `/editor` page is
  the cheapest and avoids a second editor embed to maintain. A `/drop/new` route inside the
  Worker is more discoverable from the Drop funnel but duplicates ~570 lines of editor wiring
  across two build systems (Astro vs. the Worker's esbuild bundle). **Recommended: the button on
  `/editor` first**, plus a link to it from the drop page's hero ("…or start from a blank
  canvas"). Revisit `/drop/new` only if the funnel data says the detour costs conversions.
- **Terms.** Upload is a passive acknowledgment with `tos_version` recorded
  (`doc/drop-spec.md` §9.3). The authoring page needs the same line next to its share button.

Worth adding while there: a **localStorage draft**, so a refresh before the first share does not
lose the work. There is no server-side identity to attach a draft to, and the heavier
`@bpmnkit/plugins/storage` (IndexedDB projects and workspaces) is more than this needs.

**Effort: ~1–2 days** for the button, the legal line and the draft. Not a week.

---

## 3. Feature 2 — live single-writer editing

### 3.1 What the three people see

| | Anna (takes the baton) | Ben and Cara (watching) |
|---|---|---|
| On open | "3 viewing", an **Edit** button | identical |
| Anna clicks Edit | HUD and palette appear; canvas becomes editable | **Edit** becomes *"Anna is editing"* + **Request control** |
| Anna edits | normal editing, instant and local | each committed change lands live, optionally flashed via the existing `highlight(ids, "changed")` |
| Anna closes the tab | — | baton frees within seconds; **Edit** returns |

Note what is *not* shown: Anna's in-flight drag. The editor commits a move once at pointer-up
(`_commitTranslate`, `editor.ts:1278`), not per frame, so watchers see the result, not the
rubber-banding. Streaming the drag ghost is possible over the awareness channel and is pure
polish — and, per the analysis's §7, it is also the main way to make this design expensive.
**Leave it out of v1.**

### 3.2 Why the baton makes everything easy

Every hard problem the analysis identified — auto-routing that makes moves non-local, merges
that converge on invalid BPMN, snapshot-based undo reverting other people's work — exists only
because two people write at once. With one writer:

- there are no conflicts to resolve;
- **undo is completely correct**, because only one person has history;
- the authoritative state is whatever the writer last committed.

This is why the analysis put the baton at ~1 week and true multi-writer at ~3–4.

### 3.3 What the watchers run

Measured on this workspace, minified, gzipped:

| Bundle | Min | Gzip | vs. today |
|---|---|---|---|
| Today's viewer — `@bpmnkit/canvas` + `@bpmnkit/core` | 215 KB | 56 KB | — |
| **Watcher** — the above + the modeling functions, to replay ops | 233 KB | **59 KB** | **+3 KB** |
| Editor — `@bpmnkit/editor` + HUD + side dock | 385 KB | 96 KB | +40 KB |

So the design is:

- **Everyone loads the watcher bundle** — today's viewer plus ~3 KB, which is nothing.
- **The editor is a dynamic `import()`**, fetched only when someone actually takes the baton.

Watchers replay the *operation* using the same pure function the writer ran, rather than
receiving a new document. A `{ kind: "moveShapes", moves: [{ id, dx, dy }] }` is a few hundred
bytes; a serialised `BpmnDefinitions` is hundreds of kilobytes. At one broadcast per commit that
difference is the whole cost model.

This was the alternative to mounting `BpmnEditor` read-only for everyone and just calling
`setReadOnly(false)` on the baton holder — tempting, because it is one code path and the switch
is instant. It loses on two counts: it costs every watcher +40 KB instead of +3 KB, and
**`initEditorHud` has no read-only awareness at all** (grep finds zero references in its 2,055
lines), so the palette and toolbar would render fully live while every click silently no-ops at
`_executeCommand`. A UI that lies is worse than a remount.

`BpmnEditor` is a sibling of `BpmnCanvas`, not a subclass (`editor.ts:330`), so taking the baton
means destroying the canvas and mounting the editor. Carry `ViewportState { tx, ty, scale }`
across so the diagram does not jump — the editor already exposes `getViewport`/`setViewport` to
plugins (`editor.ts:2630`); the canvas needs the same pair made public.

### 3.4 The room

One `DocRoom` Durable Object per `(shareId, filename)`, replacing and absorbing `PresenceRoom` —
so an editing session needs one socket, not two. While it is being written, pick up the idea
`doc/drop-spec.md` §6 listed and never implemented: debounce `view_count` / `last_viewed_at`
into the room instead of writing to D1 on every single page view (`recordView`, called from
`handleSharePage` on every request today).

```
→ hello      { shareId, filename }
← welcome    { version, defs, viewers, holder }       // joiners always start current
→ claim                                               // "Edit"
← granted    { holder, until }  |  ← denied { holder }
→ op         { seq, op }                              // modeling.ts vocabulary
← applied    { version, op, holder, hash }            // broadcast to everyone
← rejected   { seq, reason }                          // only the writer sees this
← resync     { version, defs }                        // on a hash mismatch
→ release    |  ← released { }
← presence   { viewers, holder }
```

Inside the room:

- **`claim` is race-free for free.** Durable Object input gates serialise concurrent requests, so
  two people clicking Edit in the same millisecond cannot both win. No locking to write.
- **Ops are verified, not trusted.** `if (actor !== holder) return rejected` is the entire
  permission model, and it is enforced server-side rather than by hiding a button.
- **The room replays the op itself** using the same DOM-free `modeling.ts` function, then
  broadcasts `{ version, op, hash }`. Watchers compare the hash after replaying; a mismatch
  costs one `resync` and is self-healing.

### 3.5 Releasing the baton

Three paths, and the third is the one that is easy to get wrong:

1. **Explicit release** — the writer clicks Done, or navigates away.
2. **Disconnect** — `webSocketClose` fires. The compatibility date (`2026-07-01`) is past
   `2026-04-07`, so `web_socket_auto_reply_to_close` is on by default and the runtime completes
   the close handshake.
3. **A silently dead connection** — a closed laptop lid, a dropped network. No close event ever
   arrives, and without handling this the drop is locked until the DO is evicted.

For (3), Cloudflare has exactly the right primitive. `setWebSocketAutoResponse()` answers a
heartbeat ping **without waking the object** — so the heartbeat costs no duration and no
requests — and `getWebSocketAutoResponseTimestamp(ws)` lets a later alarm ask when that socket
last pinged. The autosave alarm is already firing, so liveness is free to check:

```
on alarm:
  flush()                                             // §4
  if (holder && now - getWebSocketAutoResponseTimestamp(holderSocket) > IDLE_MS) release()
```

Tag the writer's socket at `acceptWebSocket(ws, ["holder"])` so `getWebSockets("holder")` finds
it after hibernation without touching storage.

One subtlety worth stating because it is the natural mistake: **the idle timer must key on
operations, not on pings.** Auto-response pings prove the socket is open, not that a human is
there. A writer who has genuinely wandered off still holds a live socket. Use pings to detect a
*dead* connection and an ops-idle window (5–10 minutes, with a warning at the end of it) to
reclaim from an *absent* writer.

---

## 4. Feature 3 — anonymous editing, and Feature 4 — autosave

### 4.1 Yes, anyone-with-the-link makes sense

It matches the existing trust model literally — the spec already calls links "secret-URL access,
same trust model as Cloudflare Drop / secret gists" — and with no login there is no coherent
alternative that is not a worse product. An edit token would mean the uploader's tab is
privileged, which is a real distinction to draw but also means a link pasted into a ticket is
read-only for the whole team, which is the opposite of the point.

**It is safe given §1's version log, and only given that.** The combination to avoid is
anonymous + mutable + autosave + *no history*: that is a link anyone can quietly empty, with
nothing to restore from and no record that it happened.

Two carve-outs, both enforced server-side:

- **The demo drop** (`DEMO_SHARE_ID`) is served from memory and has no D1 row (`src/lib/demo.ts`).
  It must not be editable in place — offer "edit a copy", which routes through the fork path
  and gives a new share id.
- **Pinned drops** (`expires_at IS NULL`, the admin "never expires" marker) should be read-only
  for the same reason.

Put **Turnstile** on `claim`, not on every op. It is free with no request cap, and one challenge
per editing session is invisible to a human and expensive for a script.

### 4.2 Autosave is two clocks, not one

Conflating them is the trap. Durability and history want very different frequencies:

| | Durability | History |
|---|---|---|
| Question | "if the tab dies right now, is the work safe?" | "can we get back to how it was?" |
| Written to | DO SQLite | D1 `file_versions` |
| When | every committed op | checkpoints (§4.3) |
| Frequency | every command | a handful per session |
| Cost | free-plan SQLite is unbilled | one row per checkpoint |

**Durability** is the DO appending each op to its own SQLite as it verifies it. Nothing is ever
"unsaved" — close the tab mid-session and the last committed command is already durable. There
is no save button because there is nothing for it to do.

> **Correction (implemented in track B).** This document and the plan both said edits would live
> at `file_content.rep = 'current'`. That column carries a CHECK constraint, and SQLite cannot
> alter one without rewriting the table under live data, so edits go to a separate `file_current`
> table. The invariant is unchanged and in fact stronger: nothing ever writes to `file_content`.

**The flush** is the alarm, ~2 seconds after the first dirty op: flatten the current defs with
`exportPreserving(original, defs)` — so the uploader's formatting and comments survive rather
than the file being reserialised wholesale — re-hash, re-check `banned_hashes`, and update D1's
`file_content` plus `expires_at` and `files.meta`.

### 4.3 When to cut a version

A checkpoint per flush would be hundreds of rows an hour. Cut one when:

- the baton is released (explicitly, on disconnect, or on idle) — the natural "an edit session
  ended" boundary;
- or every ~10 minutes of continuous editing, so a long session is not one undoable lump;
- and **never** when `content_hash` is unchanged since the last checkpoint, which cheaply
  suppresses "opened it, panned around, left".

> **Correction (see `drop-live-editing-plan.md` §2.5).** This bullet originally said to suppress
> on `semanticHash`. That is wrong: `semanticHash` deliberately excludes all diagram interchange,
> so an hour spent purely on layout hashes identically and would have been discarded as a no-op.
> Suppress on `content_hash`; `semanticHash` is still worth storing, to *label* a milestone
> "layout only" versus "model changed".

That lands at roughly one to five versions per real session. Retention is settled in
`drop-live-editing-plan.md` §2.3: the original is pinned and never stored in this table at all,
plus a hard ring of **10** milestones — eleven recoverable states per file, forever.

```sql
CREATE TABLE file_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id      TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,     -- 0 = the original upload, never pruned
  body         TEXT NOT NULL,        -- full XML; ≤ MAX_ROW_BYTES
  content_hash TEXT NOT NULL,
  semantic_hash TEXT NOT NULL,       -- suppresses no-op checkpoints
  created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_versions_file ON file_versions (file_id, version);
```

Storage: a file caps at 900 KB, so 20 versions of a worst-case file is 18 MB against a 5 GB free
tier. Realistic BPMN is 10–50 KB, so a busy drop's history is under a megabyte.

### 4.4 What the history buys, nearly free

`diffDiagram` and `diffSemantics` already ship, and `/drop/:a/diff/:b` is already a **shipped
route**. Pointing the same machinery at two versions of one file gives "what changed between
10:04 and 10:11" for roughly the cost of a new route and a dropdown. That is also the honest
answer to anyone worried about (3): vandalism is visible and one click from reverted.

---

## 5. What changes, and where

| Where | Change | Size |
|---|---|---|
| `apps/landing/src/scripts/editor.ts` | "Share as a drop" → `FormData` → existing endpoint; ToS line; localStorage draft | small |
| `apps/drop/src/presence.ts` → `room.ts` | `PresenceRoom` becomes `DocRoom`: baton, op log, alarm flush, idle reclaim, debounced view counting | the bulk of it |
| `apps/drop/src/client/viewer.ts` | op replay + hash check; Edit / Request-control UI; dynamic `import()` of the editor on claim | moderate |
| `apps/drop/migrations/0003_*.sql` | `file_versions`; `drops.updated_at` | small |
| `apps/drop/src/routes/` | history list, version fetch, version diff, restore | small |
| `apps/drop/src/lib/db.ts` | `appendVersion`, `listVersions`, `restoreVersion`, `updateFileContent` | small |
| `apps/drop/wrangler.jsonc` | register the DO class — note the July 2026 declarative `exports` field now supersedes `migrations` | trivial |
| `@bpmnkit/editor` | **injectable ids** (22 `genId()` → `Math.random()` call sites; an id must travel *in* the op to replay); **an op-describing change event**; `getViewport`/`setViewport` made public on the canvas | small but cross-package |

Note what is **not** on this list, because the baton removes it: no CRDT, no operational
transform, no rebasing, no merge, no conflict UI, no `applyRemote` that has to preserve local
history — a watcher has no local history to preserve. `modeling.ts` is not touched beyond ids.

---

## 6. Cost

Nothing here moves Drop off the free tier, and one detail does most of that work:
**outgoing WebSocket messages are free.** Broadcasting to two watchers, or twenty, costs nothing.
Only inbound messages count, at a 20:1 ratio — so the free 100 K DO requests/day is roughly
**2 M inbound messages/day**, and only the writer sends any.

A writer committing 10 operations a minute for an hour sends 600 messages, which bills as 30
requests. Heartbeats are auto-responses and never wake the object at all. The alarm writes to D1
a few hundred times an hour at most, against 100 K/day.

The expensive version of this design — streaming drag frames as ops, flushing per op instead of
per alarm, keeping rooms awake — is the version this document deliberately does not describe.

---

## 7. What to accept going in

Mutable drops mean the consequences from the analysis's §8 are now live, not hypothetical:

- **Re-hash on every flush and re-check `banned_hashes`**, halting the room on a match.
  `content_hash` was taken once at upload and is the ban key; a mutable document's hash moves.
- **A report now points at a moving target.** File the report against the current *version*, so
  the admin queue shows what the reporter actually saw.
- **The ETag on `/drop/:id/f/:filename` must become version-derived**, not content-hash-derived.
- **`MAX_ROW_BYTES` (950 KB) must be enforced on save,** not only in `validateFile` at upload.
  An editing session can grow a document past a cap that is currently checked once.
- **"Original" needs a decision.** The share page offers an *Original* download. With a version
  log the honest answer is easy — that link serves version 0, and the current file is a separate
  download — but it has to be made.
- **Retention should slide on edit as well as view**, or an actively-edited drop can expire.

And one pre-existing limit that only becomes visible once people edit files that arrived from
elsewhere: the editor hard-codes `defs.processes[0]` / `defs.diagrams[0]` in **49 places**, so a
two-participant collaboration diagram would only ever edit the first pool. **Gate the Edit
button on `processes.length === 1`** and say why, rather than letting someone edit half a
diagram.

---

## 8. Phases

```
0. "Share as a drop" on /editor            → verify: author a diagram, click share, get a
                                              working share link; refresh mid-authoring and the
                                              draft survives
1. file_versions + history UI              → verify: version 0 is the upload; the diff route
                                              renders two versions of one file
2. DocRoom: presence + baton, no editing   → verify: three tabs; one claims, two are told who
                                              holds it; the baton frees on close and on idle
3. Live op replay                          → verify: the writer's commits land in both watchers;
                                              a forced hash mismatch triggers exactly one resync
4. Editor on claim + autosave flush        → verify: kill the writer's tab mid-session and the
                                              last committed command is still there on reload
5. Restore, Turnstile, ban re-check, caps  → verify: restore round-trips; a banned hash halts
                                              the room; a 1 MB save fails with a real message
```

Phases 0 and 1 ship value with no realtime code at all, and phase 1 is the prerequisite that
makes phase 4 safe rather than reckless. **Do not ship autosave before the version log.**

**Estimate: ~2–2.5 weeks** for phases 0–4, plus ~3–4 days for phase 5 and the §7 cleanup. That
is roughly half the cost of the multi-writer design, for something closer to what was actually
wanted.

---

## 9. Still open

1. **Does the baton queue?** "Request control" can notify the holder and hand over on release,
   or it can just be a disabled button that polls. The first is nicer and is maybe half a day.
2. **`/drop/new` or the `/editor` button?** §2 recommends the button; the funnel may disagree.
3. **How long is the idle window**, and does the holder get a warning before losing it? Ten
   minutes with a sixty-second warning is a reasonable first guess, not a researched one.
4. **Should watchers see *who* is editing, by name?** There is no identity, so it would be a
   per-tab random animal, as the original spec suggested for presence. Cheap and humanising, but
   it invents a persona the product otherwise does not have.
5. **Do DMN and Form tabs stay read-only?** Recommended yes — their editors emit a bare
   `onChange()` with no description of what changed (~40 call sites), so there is no operation
   to broadcast. Live-editing them means whole-document replacement per keystroke.
