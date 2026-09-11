# Drop — Editing & Multi-User Editing: Analysis

> Status: **analysis only, nothing implemented.** Written 2026-09-11 in answer to two questions
> about `apps/drop`: (1) how hard is it to allow *editing*, not just dropping and viewing, and
> (2) how hard is it to let *several people edit the same file at the same time*. Cloudflare
> primitives are preferred throughout, as they already are in `doc/drop-spec.md` §6.

The short version: **(1) and (2) are not the same order of difficulty.** Single-user editing is
a few days and is mostly a *product* decision about what a drop is. Multi-user editing is weeks,
and almost none of that cost is the realtime transport — Durable Objects hand you the hard part
(a single authority per document) for free. The cost is in BPMN itself: the editor's history is
snapshot-based, its move operation re-routes unrelated edges, and a merged-but-invalid diagram
is worse than a conflict, because it exports as XML an engine will reject.

There is also a cheap third answer that this document argues for as step one, and which the
original spec already hinted at under "Open in Studio": **fork on edit**.

---

## 1. What exists today

Established by reading the code, not from memory.

**The app** (`apps/drop`, 44 files, ~2,900 lines of `src`): a single Worker behind
`bpmnkit.com/drop*`, D1 for storage, one `PresenceRoom` Durable Object per `shareId`,
Workers AI for the review feature, a daily cron for expiry.

**The data model is immutable by construction** (`migrations/0001_init.sql`). A drop is written
once, in one `db.batch()` (`insertDrop`, `src/lib/db.ts:71`), and then only ever read, counted,
or deleted. Three consequences the codebase leans on:

- `content_hash` is a sha256 of the uploaded bytes, taken once at upload. It is the **ban key**
  (`banned_hashes`, `findBannedHashes`) *and* the **ETag** on `/drop/:id/f/:filename`
  (`src/routes/drop.ts:63`). Both assume the bytes never change.
- `file_content` stores two rows per file — `original` (the uploaded XML/JSON verbatim) and
  `json` (`JSON.stringify` of the parsed model). Editing means deciding which of those is now
  the truth.
- Retention is a sliding TTL refreshed *on view* (`recordView`). An edited document that people
  keep opening never expires — which is fine, and is also the point below in §8.

**Presence is a head-count and nothing more.** `src/presence.ts` is 45 lines: accept the socket
via the hibernation API, ignore all inbound messages (`webSocketMessage` is an empty method),
broadcast `{ viewers: n }` on join and leave. No storage, no alarm, no identity. It is the
right shape to grow into an edit room, and it is currently doing none of the work.

**The viewer is genuinely read-only.** `src/client/viewer.ts` mounts `BpmnCanvas` for BPMN and
the `DmnViewer` / `FormViewer` plugins for the other two kinds. `@bpmnkit/editor` is not in
`apps/drop/package.json` at all.

**But a full editor already exists in this monorepo,** and it is better positioned than it
looks:

| Fact | Where | Why it matters |
|---|---|---|
| Every mutation funnels through one private method | `packages/editor/src/editor.ts:1162` `_executeCommand(fn, label, coalesceKey)` | One choke point to intercept. 20 call sites, no others. |
| Modeling ops are pure functions `(defs, args) => defs'` | `packages/editor/src/modeling.ts` — `createShape`, `moveShapes`, `deleteElements`, `updateLabel`, `changeElementType`, `pasteElements`, … (21 exported) | An operation vocabulary already exists. It was not designed for sync, but it is the right shape for it. |
| `modeling.ts`, `geometry.ts`, `rules.ts`, `id.ts` contain **zero** DOM references | verified by grep | **The same modeling code can run inside a Durable Object.** This is the single most consequential finding in this document. |
| A public escape hatch already exists | `editor.ts:930` `applyChange(fn)`, `getDefinitions()` | Close to what a sync layer needs — see §6.3 for the one gap. |
| The editor chrome is already on the Drop design system | `CLAUDE.md` → `--bpmnkit-ds-*`; used by `apps/landing`, `apps/drop`, `@bpmnkit/editor` | The share page already uses `ed-topbar` / `ed-tabs` / `ed-tools` class names. Visually, the editor drops in. |
| Minimal-diff writer exists | `exportPreserving(original, defs)` in `@bpmnkit/core` | Saving an edit can rewrite one line of the uploader's file, not reformat the whole document. |
| Diff and semantic hashing exist | `diffDiagram`, `diffSemantics`, `semanticHash`; `/drop/:a/diff/:b` is already a shipped route | Version history and "did this edit actually change anything" come mostly for free. |

**Measured bundle cost** (esbuild, minified, this workspace's sources):

| Bundle | Minified | Gzipped |
|---|---|---|
| Today's viewer (`@bpmnkit/canvas` + `@bpmnkit/core`) | 215 KB | 56 KB |
| Editor (`@bpmnkit/editor` + HUD + side dock) | 385 KB | 96 KB |
| **Delta for editing** | **+170 KB** | **+40 KB** |
| `yjs` + `y-protocols`, for comparison (§5.3) | 82 KB | 25 KB |

+40 KB gzipped for a full BPMN editor is cheap, and it only has to load when someone actually
clicks Edit.

---

## 2. Four decisions determine the whole cost

Before any architecture, four questions. Three of them are product questions, and they dominate
the engineering.

### 2.1 Who is allowed to edit?

Drop has **no identity at all**. No accounts, no cookies, no upload token — `handleUpload`
returns `{ shareId, url, files }` and nothing else. The trust model is stated in the spec:
"anyone with the link", same as a secret gist.

Extending that to writes is not automatic. "Anyone with the link may *view*" is a very
different sentence from "anyone with the link may *overwrite*". Four options, cheapest first:

1. **Anyone with the link can edit.** Zero work, matches the existing trust model literally,
   and turns every shared link into something a stranger can silently vandalise. For a
   throwaway review link this may genuinely be fine; for anything someone pasted into a ticket,
   it is not.
2. **Edit token issued to the uploader.** `handleUpload` also returns an `editToken`
   (a second unguessable id); the drop page stores it and the "edit" URL is
   `/drop/:id#e=<token>` — in the fragment, so it never reaches the server logs or a `Referer`
   header. Sharing the edit link is an explicit act. Roughly a day, no new infrastructure. The
   spec already lists "deletion tokens for uploaders" as a future idea; this is the same
   mechanism.
3. **Per-drop passcode.** Uploader sets one; joiners enter it; the Worker verifies and issues a
   short-lived signed cookie. Adds a rate-limit surface — the codebase already has the pattern
   in `ai_unlock_attempts` and `src/routes/ai-review.ts`.
4. **Real accounts.** Out of scope, and it contradicts the product ("no account required" is
   the entire pitch).

**Recommendation: (2).** It preserves the zero-friction promise, it is the smallest thing that
makes "who may write" a deliberate decision, and it composes with (3) later.

Whichever is chosen, put **Turnstile** in front of the endpoint that mints or claims edit
rights. It is free with no request cap, it is already a Cloudflare primitive, and an
anonymous-writable endpoint is exactly what it exists for.

### 2.2 Is a drop still immutable?

This is the decision that ripples furthest, and there are only two coherent answers.

**(a) Fork on edit — copy-on-write.** Editing a drop produces a *new* drop with a new
`shareId`, leaving the original byte-identical. Nothing in §1's immutability table breaks:
`content_hash` stays honest, ETags stay valid, the ban list keeps working, retention is
unchanged, `insertDrop` is reused verbatim. Provenance is one nullable column
(`drops.forked_from`). The existing `/drop/:a/diff/:b` route then means "see what changed"
already works, for free, between a drop and its fork.

**(b) Mutable drops — edit in place.** The drop becomes a living document. Every assumption in
§1 has to be revisited: re-hash on save and re-check the ban list; drop or version the ETag;
decide whether `original` or `json` is canonical; decide whether the original uploader's bytes
are still retrievable; extend retention semantics from "last viewed" to "last viewed or
edited"; and accept that the moderation queue now points at a moving target (§8).

These are not equally sized. (a) is a feature. (b) is a change of product category — from
"pastebin for diagrams" to "hosted document store". Note that (b) also quietly makes Drop
compete with `apps/studio`, which already exists and already edits BPMN, DMN and forms.

**Recommendation: (a) first, and possibly forever.** It delivers "I opened someone's diagram,
fixed the gateway, and sent back a link" — which is the actual review workflow — without
touching a single invariant. (b) is what you need only if you want the *same URL* to keep
changing, which is a real but different product.

Multi-user realtime editing (§5) is orthogonal to this choice: you can co-edit a fork in a
Durable Object and only materialise it into D1 when the session ends.

### 2.3 What conflict model?

The core of question (2). Three candidates, compared in §5 — soft lock, server-authoritative
operation log, or a CRDT.

### 2.4 Which file kinds?

Drop accepts three kinds. They are in very different states:

- **BPMN** — `@bpmnkit/editor` is a real editor with a described-operation command stack.
  Co-editable with effort.
- **DMN** and **Forms** — `@bpmnkit/plugins/dmn-editor` and `/form-editor` exist and work, but
  they mutate their model in place and emit a bare `onChange()` with **no description of what
  changed** (`dmn-editor.ts:135`, `form-editor.ts:427` — ~40 call sites between them, all
  `this._emit()`). There is no operation vocabulary to send over a wire. Co-editing them means
  either whole-document last-write-wins, or giving them a command stack first.

Also note a pre-existing constraint that only becomes *visible* once people edit arbitrary
uploaded files: the BPMN editor hard-codes `defs.processes[0]` / `defs.diagrams[0]` in **49
places** across `modeling.ts` and `editor.ts`. A single-pool diagram edits fine. A
collaboration diagram with two participants — common in real uploads — will only ever edit the
first process. In Studio people usually start from scratch, so this rarely bites; in Drop,
where the file arrived from somewhere else, it will.

**Recommendation: BPMN only for any editing work.** Make DMN/Form tabs stay read-only with an
explicit "download and edit locally" affordance. Gate the Edit button on `processes.length === 1`
until the multi-process constraint is lifted, and say why in the UI.

---

## 3. Why BPMN co-editing is harder than text co-editing

Four properties of this document model make it materially harder than the collaborative-editing
examples everyone reaches for. None is fatal; all cost time.

### 3.1 The document is two parallel trees that must agree

`BpmnDefinitions` (`packages/core/src/bpmn/bpmn-model.ts:755`) carries the semantic tree
(`processes[].flowElements[]`, `sequenceFlows[]`, nested through sub-processes) **and**,
separately, the visual tree (`diagrams[].plane.shapes[]` / `.edges[]`, BPMN DI), joined only by
a `bpmnElement` string reference.

Renaming a task touches one tree. Moving it touches the other. Creating one touches both, and
if the two get out of step the file is not merely ugly — it is a diagram with an element that
has no shape, which renderers handle inconsistently and `checkDiCompleteness` exists in core
specifically to detect. Any merge strategy must keep both sides in lockstep.

### 3.2 A move is not a local change

This is the finding that rules out naive CRDT merging. `moveShapes`
(`packages/editor/src/modeling.ts:624`) does far more than add a delta to `bounds.x`:

- it **cascades** to boundary events sitting on a moved host, and to every descendant of a
  moved sub-process;
- it then **re-routes edges**, with obstacle avoidance and port deconfliction — the code's own
  comment: *"Never pass behind/through other elements … Never share the same connection point"*.

So "user A moved task X" rewrites the waypoint arrays of an unbounded set of edges, including
edges attached to shapes A never touched. If user B concurrently moves task Y, both edits
rewrite overlapping waypoint arrays. A CRDT will merge those arrays element-wise and converge
on a route that neither router would ever have produced — visually wrong, and wrong in a way
that is invisible to the merge algorithm because a waypoint list is just a list of numbers.

The correct resolution is *re-run the router over the merged layout*. That is a function of the
whole document. One authority can do it trivially; a set of peers cannot do it without becoming
one.

### 3.3 Convergence is not validity

Standard graph-CRDT problem, with a BPMN-specific sting. A deletes task `T`; B concurrently
draws a sequence flow into `T`. Every CRDT converges — on a document containing a
`<sequenceFlow targetRef="T">` where no `T` exists. `Bpmn.export` will serialise it happily;
Camunda will reject it at deploy.

The literature offers resolutions (remove-wins with compensation, or update-wins resurrecting
the node), and both are defensible, but both mean **writing BPMN-aware repair logic on top of
the CRDT**. Once you are writing a validating repair pass, the argument for the CRDT is mostly
gone: a single authority can just refuse the second operation and tell the user why.

Worth noting that the pure modeling functions are already *total* in the helpful direction —
`updateLabel` returns `defs` unchanged if the id is absent, `deleteElements` no-ops on an empty
set. Applying a stale operation against newer state is usually a safe no-op rather than a
crash. That is a real advantage for the server-authoritative design in §5.2.

### 3.4 Undo is snapshot-based, and that is actively wrong when shared

`CommandStack` (`packages/editor/src/command-stack.ts`) stores **whole `BpmnDefinitions`
snapshots** — deliberately, and it is a good design for one user: the modeling ops return
structurally-shared copies, so 100 edits share nearly all memory and undo is a pointer swap.

But `undo()` (`editor.ts:902`) calls `_renderDefs(prev)` and emits `diagram:change` with that
whole snapshot. In a shared session that means: **user A pressing Ctrl-Z reverts everyone
else's concurrent work**, because the snapshot A is restoring predates it.

There is no cheap fix. Real per-user undo needs an *inverse operation* per command, rebased
over everything that happened since — which the snapshot model does not have and which is the
classic hard part of collaborative editing. This is not a theoretical worry: Camunda's Web
Modeler documents exactly this compromise, that you can only undo your own actions *until
another collaborator makes a change*, at which point the history is reset.

**Plan on shipping the same compromise** (clear the redo stack and truncate undo at the first
remote change), and treat true multi-user undo as a separate project.

---

## 4. Cloudflare primitives, and what each is actually for here

| Primitive | Role | Notes for this design |
|---|---|---|
| **Durable Object** (one per document) | The single authority. Serialises all writes, fans out to all viewers. | Already in use for presence. Cloudflare guarantees one instance per id, no split-brain — this *is* the feature you would otherwise build. Soft limit ~1,000 req/s per object; a drop room will see single digits. |
| **WebSocket Hibernation API** | Keeps idle collaborators connected at no duration cost. | Already used by `PresenceRoom`. **In-memory state is reset on hibernation** and the constructor re-runs — so the authoritative document must live in storage, not in a field. `serializeAttachment()` holds ≤16 KB of per-connection state (actor id, colour, display name, permission) across hibernation. |
| **DO SQLite storage** | The hot store: operation log + periodic snapshot. | 10 GB per object, 2 MB per row, 100 KB per SQL statement. Free plan: 5 M rows read/day, 100 K rows written/day. Free-plan users are **not charged for SQLite storage** even after billing began in Jan 2026. |
| **DO Alarms** | Debounced persistence and compaction. | Set an alarm ~10 s after the first unsaved change; on fire, compact the op log to a snapshot and write through to D1. Since Aug 2026 alarms take `{ retryAlarm: false }` for use with `ctx.abort()`. |
| **D1** | Remains the store of record: queryable, moderatable, cron-expirable. | Unchanged role. The DO is a write-through cache in front of it, not a replacement. Keep the 950 KB `MAX_ROW_BYTES` guard on save — an edited document can grow past the upload cap. |
| **DO point-in-time recovery** | Disaster recovery only. | Restores the object's SQLite to any point in the last 30 days via bookmarks. Excellent safety net for "a bug corrupted a room"; do **not** build the user-facing version history on it — build that on the op log plus `diffDiagram`, which is already shipped. |
| **Turnstile** | Gate on claiming edit rights. | Free, unlimited requests, no cap. The right answer for an anonymous writable endpoint. |
| **Workers AI** (already bound) | Out of scope, but adjacent: summarising a session's changes. | The `AI` binding and budget ledger already exist. |
| **R2** | Not needed. | tldraw needs R2 because whiteboards carry images. BPMN files are ≤900 KB of text. D1 + DO SQLite is enough. |

One configuration note: since July 2026 a declarative `exports` field supersedes imperative
`migrations` for DO lifecycle, and new namespaces must be SQLite-backed. `wrangler.jsonc`
currently uses `migrations: [{ tag: "v1", new_sqlite_classes: ["PresenceRoom"] }]` — adding a
second DO class is the moment to look at which form to use.

---

## 5. Three architectures for multi-user editing

### 5.1 Option A — the edit baton (one writer at a time)

The room grants a **soft lock** to exactly one participant. Everyone else watches live, in
read-only mode, and can request the baton; it releases on disconnect or after an idle timeout.

Mechanically this is the smallest possible change: the DO tracks `holderId` in
`serializeAttachment` plus a storage key, and rejects operations from anyone else. The writer
broadcasts its post-command `BpmnDefinitions` (or better, the op); everyone else calls a
read-only apply. `setReadOnly(true)` already exists on the editor and does the right thing —
it drops selection, clears ghosts and switches the state machine to pan.

- **There are no conflicts**, so §3.2, §3.3 and §3.4 all evaporate. Undo is correct because
  only one person has history.
- It is honest in the UI ("Anna is editing — request control") and users understand it
  immediately.
- It is unsatisfying for two people actively working, and it is not what was asked for.

**This is the highest value-per-day option by a wide margin**, and it is a strict subset of
Option B — the room, the socket protocol, the persistence, the awareness channel and the
read-only apply path are all shared. Nothing is thrown away by starting here.

### 5.2 Option B — server-authoritative operation log *(recommended for true multi-writer)*

The DO holds the authoritative `BpmnDefinitions` and a monotonically increasing `version`.

1. A client edits locally (optimistic) and sends `{ baseVersion, op }` — where `op` is a
   serialised call into the existing `modeling.ts` vocabulary, e.g.
   `{ kind: "moveShapes", moves: [{ id, dx, dy }] }`.
2. The DO applies the *same pure function* to its authoritative defs — **this is why
   §1's "modeling.ts is DOM-free" finding matters**; there is no second implementation to write
   and no chance of client/server divergence.
3. It validates the result (referential integrity, DI completeness, size cap), rejects with a
   reason if invalid, otherwise increments `version`, appends to the SQLite op log, and
   broadcasts `{ version, op, actor }` to everyone.
4. Each client applies the same op. A client whose `baseVersion` was stale just applies the
   server's ordering; because the modeling functions are total (§3.3), a stale op is usually a
   safe no-op rather than corruption. On divergence — detected by comparing a cheap hash — the
   client asks for a full snapshot and reloads.

This is the shape tldraw sync uses on Cloudflare (authoritative Durable Object per room, SQLite
persistence, throttled writes), and the shape `prosemirror-collab-commit` uses (rebase on the
authority rather than merge without one). It is not a novel design.

What it buys that a CRDT does not:

- **§3.2 is solved properly**: the router re-runs on the authority over the merged layout, and
  the resulting waypoints are broadcast as part of the result. Everyone sees the same routes.
- **§3.3 is solved properly**: an operation that would dangle a reference is *rejected*, with a
  message ("Anna deleted that task while you were connecting to it"), rather than silently
  producing invalid XML.
- Permissions, rate limits and abuse checks all have an obvious home — the authority.
- No new runtime dependency, which matches the repo's stated dependency policy.

What it costs: a defined op schema, a validation pass, snapshot/resync handling, and the undo
compromise from §3.4.

### 5.3 Option C — Yjs (or Loro / Automerge) in the Durable Object

The mature path. `y-partyserver` is Cloudflare-maintained, extends `DurableObject`, and as of
v2.1.0 handles hibernation and awareness correctly by keeping connection state in
`connection.setState()` rather than in memory. `y-durableobjects` is a smaller alternative.
Measured cost to the client bundle: **82 KB minified / 25 KB gzipped** for `yjs` +
`y-protocols`.

If the document model were a text buffer or a flat list of records, this would be the
recommendation. It is not, for four specific reasons:

1. **The model would have to be rewritten.** To get real CRDT merging you must mirror
   `BpmnDefinitions` into `Y.Map`/`Y.Array` structures and rewrite all 21 modeling operations
   (~1,900 lines) to mutate shared types in place. The pure-function design — which is what
   makes server-side replay possible in Option B, and what makes the structurally-shared undo
   stack cheap — is lost.
2. **The alternative to rewriting is worse.** Keeping the pure functions and diff-patching a
   Y.Doc after each command re-introduces exactly the merge problem you adopted the CRDT to
   avoid: a structural diff of two snapshots is not a statement of user intent, and concurrent
   auto-routed waypoint rewrites (§3.2) merge into nonsense.
3. **It converges without validating** (§3.3), so a BPMN-aware repair pass is needed anyway —
   at which point you have an authority, and Option B is simpler.
4. **You do not have the problem CRDTs solve.** CRDTs earn their complexity when there is no
   authority — offline-first, peer-to-peer, masterless. A Durable Object *is* an authority,
   guaranteed single-instance, and you are already paying for it.

**Revisit this if the goal changes** to genuine offline editing (edit on a plane, sync later)
or local-first desktop/web convergence with `apps/desktop`. For a browser tab editing a shared
link, it is the wrong tool.

### 5.4 Comparison

| | A — Edit baton | B — Server-authoritative op log | C — Yjs CRDT |
|---|---|---|---|
| Simultaneous writers | 1 | n | n |
| New client dependency | none | none | +25 KB gz |
| Changes to `@bpmnkit/editor` | small (§6.3) | moderate (op ids, remote apply) | rewrite `modeling.ts` |
| §3.2 auto-routing | not an issue | solved on the authority | **broken merges** |
| §3.3 invalid documents | not an issue | rejected with a reason | converges to invalid, needs repair |
| Undo | fully correct | Camunda-style compromise | Camunda-style compromise |
| Offline editing | no | no | yes |
| Rough effort (BPMN only) | ~1 week | ~3–4 weeks | ~4–6 weeks |

---

## 6. The recommended design, concretely

### 6.1 Topology

One `DocRoom` Durable Object per **(shareId, filename)**, addressed by
`idFromName(`${shareId}:${filename}`)`. Per-file rather than per-drop keeps a 20-file drop from
funnelling every edit through one object, and keeps the authoritative state small.

`PresenceRoom` stays as it is for the read-only viewer (it is 45 lines and costs nothing), or
`DocRoom` absorbs presence so an editing session needs one socket rather than two. Either way,
the spec's still-unimplemented idea from §6 — *"the same DO debounces `view_count` /
`last_viewed_at` writes to D1 instead of writing on every page load"* — is worth picking up
while the room is being touched, since `recordView` currently writes to D1 on **every** page
view.

### 6.2 Inside the room

```
DO SQLite:
  meta(version INTEGER, base_hash TEXT, dirty INTEGER)
  ops(seq INTEGER PRIMARY KEY, actor TEXT, op TEXT, ts INTEGER)
  snapshot(seq INTEGER PRIMARY KEY, defs TEXT)     -- compacted, one row
```

- `blockConcurrencyWhile` in the constructor loads the latest snapshot and replays any ops after
  it, so a hibernation wake-up is correct without keeping anything in memory (§4).
- On each accepted op: append, increment `version`, broadcast, and `setAlarm(now + 10s)` if not
  already dirty.
- On alarm: compact (snapshot, delete replayed ops), then **write through to D1** — flatten with
  `exportPreserving(original, defs)` so the uploader's formatting survives, re-hash, re-check
  `banned_hashes`, refresh `expires_at`, update `files.meta`.
- Room goes idle → one final flush, then hibernate. Storage is cheap and free-plan SQLite is
  not billed.

### 6.3 Protocol sketch

```
→ hello        { shareId, filename, editToken?, actor: { name, colour } }
← welcome      { version, defs, participants[], canEdit }
→ op           { baseVersion, op }                       // modeling.ts vocabulary
← applied      { version, op, actor }                    // broadcast to all
← rejected     { baseVersion, reason }                   // e.g. "target was deleted"
← resync       { version, defs }                         // client-detected divergence
↔ awareness    { actor, selection[], cursor?, dragging? } // ephemeral, never persisted
```

Awareness is the cheap half and is worth doing properly: the canvas already exposes
`highlight(ids, style)` (used today by the AI review panel) and an `OverlayManager` for HTML
overlays anchored to elements, so remote selection and name badges need no new rendering
machinery. Note that during a drag the editor shows a *ghost* and only commits at pointer-up
(`_commitTranslate`, `editor.ts:1278`) — so remote users see nothing until the drop unless
drag state is broadcast on the awareness channel. Broadcasting it is optional polish; the
commit rate stays at a handful per second either way, which is what keeps §7 cheap.

### 6.4 Required changes to `@bpmnkit/editor`

Small, precise, and each one is independently useful:

1. **Injectable ids.** `createShape`, `createConnection`, `createBoundaryEvent`,
   `pasteElements` and friends mint ids internally via `genId()` → `Math.random()`
   (`modeling.ts`, 22 call sites). For an op to be replayable on the server *and* on every
   peer, the id must travel *in* the op. Add an optional id (or id-factory) parameter. Also
   worth giving each session a short prefix so two clients cannot mint the same id.
2. **A remote-apply path.** `applyChange(fn)` (`editor.ts:930`) pushes onto the local command
   stack, so a remote edit would become locally undoable — wrong. `loadDefinitions(defs)` is
   the other option and it *clears* the stack, resets selection and re-fits the viewport —
   also wrong. Needed: `applyRemote(defs)` that renders and swaps `_defs` while preserving
   selection, viewport and local history. ~15 lines, using the existing `_renderDefs`.
3. **An op-describing change event.** `diagram:change` emits only the new defs. Emitting the
   op alongside it (`_executeCommand` already receives a `label` and a `coalesceKey`) is what
   lets the client send intent rather than a snapshot.
4. **Render cost.** `_renderDefs` (`editor.ts:1108`) clears four SVG groups and re-renders the
   whole scene on every command. At human commit rates this is fine — it is already how
   single-user editing works. It only becomes a problem if drag state is ever streamed as real
   ops rather than as awareness; don't do that.

### 6.5 Phasing

```
0. Fork-to-edit, single user (§2.2a)        → verify: edit a drop, get a new shareId,
                                               original bytes unchanged, /diff shows the change
1. Live read-only follow                    → verify: a second tab sees the writer's commits;
                                               presence shows names, not just a count
2. Edit baton + awareness (§5.1)            → verify: two tabs, control passes on request and
                                               on disconnect; no lost writes
3. Multi-writer op log (§5.2)               → verify: scripted concurrent ops converge; a
                                               delete-vs-connect race is rejected, not corrupted
4. Persistence, history, moderation (§6.2)  → verify: kill the room mid-edit, state survives;
                                               a banned hash halts the room
```

Steps 0–2 are a coherent product on their own. Step 3 is the expensive one, and stopping at 2
is a legitimate outcome rather than a failure.

---

## 7. Cost on Cloudflare's free tier

Free-plan Durable Objects allowances: **100,000 requests/day**, **13,000 GB-s/day**, 5 M SQLite
rows read/day, 100 K rows written/day, 5 GB stored. Workers free: 100 K requests/day. D1 free:
5 GB, 100 K writes/day.

Two details make this comfortable:

- **Incoming WebSocket messages bill at 20:1.** Opening the socket is one request; outgoing
  messages and protocol pings are free. So 100 K request/day ≈ **2 M inbound messages/day**.
  At the editor's commit rate (one op per drag, not per frame) a busy two-hour session is a few
  thousand messages.
- **Hibernation means idle rooms cost nothing.** Duration accrues only while the object is
  active or ineligible to hibernate. 13,000 GB-s/day against a 128 MB object is roughly **29
  hours/day of *active* room time** across all drops — and an editing room is only active while
  messages are actually flowing.

The write path is the one to watch: the free 100 K SQLite rows/day would be consumed by ~100 K
appended ops. Debounced compaction (§6.2) and D1 write-through on an alarm rather than per op
keep this in the low thousands per busy day. The realistic first paid trigger is the same one
the original spec named — sustained traffic past 100 K requests/day.

**Editing is not what makes Drop expensive.** The design choices that would are streaming drag
state as ops, persisting per op instead of per alarm, or keeping rooms ineligible for
hibernation.

---

## 8. The consequences nobody asks about

These are not edge cases; they are the reason (b) in §2.2 is a change of product category.

- **The ban list stops working.** `banned_hashes` keys on the sha256 taken at upload. A mutable
  document's hash changes on every save, so a banned hash bans nothing. Re-hash and re-check on
  every persisted save, and hard-stop the room if it matches — cheap at alarm time, but it must
  be deliberate.
- **The moderation queue points at a moving target.** A report filed at 10:00 describes content
  that may be gone by 10:05, innocently or not. The admin view would need the version the
  report refers to, which means retaining at least that snapshot.
- **An anonymous, writable, never-expiring URL is a different object than a paste.** Retention
  slides on view; if editing also slides it, a drop lives forever. An unauthenticated writable
  store with no account trail is attractive for staging content you would rather not host
  yourself. The §2.1 edit token plus Turnstile is the minimum, not a nicety.
- **Caching assumptions break.** `/drop/:id/f/:filename` returns `ETag: "<content_hash>"` today
  precisely because the bytes are immutable. Mutable content needs a version-derived ETag or no
  ETag at all.
- **The upload size cap must become a save cap.** `MAX_ROW_BYTES` (950 KB) is enforced in
  `validateFile` at upload only. An editing session can grow a document past it; the save path
  needs the same guard with a real error, not a silent D1 failure.
- **"Original" stops meaning original.** The share page offers an `Original` download. Once
  edited, either that link serves the uploader's bytes (and is now misleading) or the current
  bytes (and the label is wrong). Decide, and say so in the UI.

---

## 9. Answering the two questions directly

**"How complicated is it to also allow editing?"** — Modest, and mostly not about editing.
The editor exists, is DOM-portable, is already on Drop's design system, and costs +40 KB
gzipped. **Roughly 2–3 days** for fork-on-edit (§2.2a), plus about **a week** for the edit-token
permission model (§2.1). The real work is deciding whether a drop stays immutable; if it does,
almost nothing in the existing schema or invariants has to move.

**"How complicated is it to let several people edit at once?"** — Substantially harder, and
the difficulty is BPMN's, not Cloudflare's. Durable Objects hand you the single authority that
is normally the hard part. What remains is auto-routing that makes every move non-local (§3.2),
merges that converge on invalid diagrams (§3.3), and a snapshot-based undo stack that makes one
user's Ctrl-Z everyone's problem (§3.4).

- The **edit baton** (§5.1) removes all three by construction: **~1 week**, and it is the
  substrate for everything after it.
- True multi-writer via a **server-authoritative op log** (§5.2): **~3–4 weeks** for BPMN alone,
  plus the moderation and retention rework in §8. Undo ships as the Camunda compromise.
- **Yjs** (§5.3) is the mature, wrong answer here: a rewrite of `modeling.ts`, weaker guarantees
  about document validity, and it solves the absence of an authority — which is not a problem
  Drop has.

DMN and Form co-editing is a separate project and should be scoped separately (§2.4).

---

## 10. Open questions

1. **Does the same URL have to change?** If forking is acceptable, §2.2b and most of §8
   disappear. This is the highest-leverage question in the document.
2. **Who may write?** §2.1 — anyone with the link, or a token the uploader chooses to share?
3. **Is "one writer at a time" actually insufficient?** For a review workflow — the use case
   Drop's own landing page leads with — a baton may be the whole feature.
4. **Does this belong in Drop at all, or in `apps/studio`?** Studio already edits BPMN, DMN and
   Forms. "Open this drop in Studio" (the original spec's own future idea) may be the cheaper
   product answer than growing Drop into an editor.
5. **Offline?** The only answer that would change the §5.3 recommendation.

---

## Sources

- [Cloudflare — Durable Objects: Use WebSockets / Hibernation API](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare — Durable Objects pricing](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx)
- [Cloudflare — Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Cloudflare — Durable Objects changelog](https://developers.cloudflare.com/changelog/product/durable-objects/)
- [Cloudflare — SQLite-backed Durable Object Storage & point-in-time recovery](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Cloudflare — Billing for SQLite storage (free plan unaffected)](https://developers.cloudflare.com/changelog/post/2025-12-12-durable-objects-sqlite-storage-billing/)
- [Cloudflare — Turnstile is free for everyone](https://blog.cloudflare.com/turnstile-ga/)
- [cloudflare/partykit — y-partyserver](https://github.com/cloudflare/partykit/blob/main/packages/y-partyserver/README.md)
- [napolab/y-durableobjects](https://github.com/napolab/y-durableobjects)
- [tldraw/tldraw-sync-cloudflare](https://github.com/tldraw/tldraw-sync-cloudflare)
- [tldraw sync documentation](https://tldraw.dev/docs/sync)
- [Moment devlog — Lies I was Told About Collaborative Editing, Pt. 2: Why we don't use Yjs](https://www.moment.dev/blog/lies-i-was-told-pt-2)
- [Camunda 8 — Web Modeler collaboration (undo/redo reset behaviour)](https://docs.camunda.io/docs/components/modeler/web-modeler/collaboration/)
- [Borth, *Directed Acyclic Graph CRDTs*, PaPoC '25](https://dl.acm.org/doi/10.1145/3721473.3722141)
