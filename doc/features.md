# Features

## Three drops the editor will not write (2026-09-12)

Anyone with the link can edit a drop — except three kinds, each for its own reason, and all three
enforced on the socket rather than by hiding a button. A hidden button is a suggestion; a socket
is an API, and anyone who opens devtools has one.

- **The demo** is served from memory with no row behind it, so there is nothing to save to. Its
  button says **Edit a copy** and makes you a real drop of your own from the same diagram — which
  the upload endpoint already does, with no new server code.
- **A pinned drop** — one an operator marked as never expiring — is a fixture or a reference.
  Anyone-with-the-link editing is right for an ordinary drop and wrong for that one.
- **More than one process** is past what the editor addresses. It edits one process; a file with
  several would come back with the others intact but unreachable, which is worse than declining.

The button is **disabled with the reason in its tooltip** rather than removed, because a button
that is not there looks like a feature you do not have rather than one this file cannot use. The
room says the same thing back if a claim arrives anyway, and a read-only drop stays perfectly
readable.

## One challenge per editing session (2026-09-12)

A drop is editable by anyone with the link, so taking the edit baton can be challenged with
Turnstile.

- **On the claim, not on the op.** A person takes the baton once and edits for half an hour; a
  script that wants to rewrite other people's drops pays for every one it touches. Challenging
  each keystroke instead would be invisible to the script — which batches anyway — and maddening
  for the person.
- **The widget appears when Edit is pressed**, not on the page. Almost everyone who opens a drop
  is reading it, and a challenge to look at for a diagram you came to read is a worse page for no
  benefit.
- **The content policy is widened only where the widget can appear**, and only when a key is
  configured. A policy that is loose everywhere because one page needs it protects nothing.
- **A verification outage is a refusal, not a pass.** Failing open would mean anyone who can
  cause one can skip the check.
- **A connection that keeps failing stops being served.** Verification is an outbound request
  made inside the room's handler, so it stalls the room while it runs — fair once a session, and
  not something a prober gets to make the room pay repeatedly.
- **A challenge that cannot be shown says so.** An extension blocking `challenges.cloudflare.com`
  would otherwise leave Edit doing nothing at all, silently.
- **Off by default.** No key, no widget, no challenge — so local development and a self-hosted
  deployment need no Cloudflare account. Set the secret without the site key and every claim
  fails, which is the right way round for a check whose job is to say no.

## The checks follow the edits (2026-09-12)

Every safety check Drop had was a check on an *upload*. A document that changes needs them at
edit time too.

- **Banned content cannot walk back in through the editor.** The ban list is keyed on content,
  and a mutable document's content moves — so a drop could be uploaded clean and then *edited
  into* something banned. Every save re-checks. On a hit nothing is written, the baton is taken
  away, and the room refuses edits from then on; the drop stays readable and reportable.
- **The row cap is enforced on the edit, not just the save.** A change that would push the file
  past what a D1 row holds is refused with the size in the message, while it is still the last
  thing you did — rather than failing silently thirty seconds later with nothing useful to say
  about which change caused it. The save re-checks the stored forms as a backstop, since the JSON
  model is several times the XML.
- **The entity tag names what it identifies.** It was the content hash, which meant the XML and
  the JSON model of one state were served under the *same* tag — different bytes, one name. It
  now carries the version and the format, so `?format=json` and `?v=0` are distinct, the current
  tag moves as the file is edited, and the original's never does.
- **`If-None-Match` is honoured**, so an unchanged file costs a 304 instead of a download. Weak
  tags, lists and `*` all work.

## Autosave, and no save button (2026-09-12)

Edits reach the store of record without anyone asking, and the version log fills itself in.

- **Nothing is ever unsaved.** The Durable Object's own storage takes every op as it is verified,
  so losing a tab loses nothing. D1 is the store of record and only has to be *fresh*: it is
  brought level thirty seconds after the first unsaved edit, and at once when the baton is put
  down or the writer's connection drops.
- **The debounce bounds staleness; it does not wait for a lull.** The deadline is set by the
  first unsaved edit and never pushed back by the ones after it, so a room edited continuously
  still saves every thirty seconds rather than never.
- **An edited drop is not reformatted.** Saves go through `exportPreserving`, so a real edit is a
  handful of changed lines against the upload rather than a whole-file rewrite — a drag of one
  task leaves a five-line diff. Each save becomes the next one's source, so formatting survives a
  session ending as well as an op.
- **One milestone per hour of each editing session**, cut the first time that hour is saved and
  refreshed when the baton is released — so an hour of continuous editing leaves one row holding
  the state that hour ended in, at two D1 writes rather than a hundred.
- **One person's hour cannot overwrite another's.** The collapse key carries the baton grant, so
  a stranger editing forty minutes after you leaves your milestone standing.
- **Retention slides on an edit**, not only on a view, so an actively edited drop cannot expire.
- **The uploaded original is never written to.** `?v=0` is the bytes that were uploaded, however
  many times the drop has been edited since.

## Editing a drop (2026-09-12)

A drop is now editable in place. Press **Edit**, and the read-only canvas becomes a full editor —
palette, toolbar, undo — with everyone else watching it change.

- **Readers never download the editor.** It is reached through a dynamic `import()` and arrives
  as its own 25 KB chunk when Edit is pressed. The overwhelming majority of people who open a
  drop are reading it, and should not pay for a palette they will never click.
- **The diagram does not move when the editor mounts.** The view is carried across the swap by
  hand, so the corner you had zoomed into is the corner you are still looking at.
- **No HUD to hide from watchers.** A reader's page never constructs an editor at all, so the
  question of a disabled palette does not arise.
- **Undo reaches everyone.** An undo describes itself as a whole-document op, because the command
  stack records states rather than inverses — a watcher that never heard about one would be
  silently wrong from then on.
- **A second claimant is told, not ignored.** "Someone else is editing this drop right now", and
  no editor opens.
- **Idle warnings, and a graceful exit.** A minute before the baton is reclaimed the writer is
  told; when it goes, the page says why and returns to reading.
- **Two histories, never merged.** *On this device* lists local checkpoints — written to
  IndexedDB after 30 seconds of dirty editing and when the page is hidden, bounded at 50 today
  plus one a day for ten days, and visible to nobody else. *Saved milestones* is the shared,
  server-side log. A merged list would quietly imply the local ones are shared. They are not.

## Watching someone else edit (2026-09-12)

Open a drop while someone is editing it and the diagram now changes under you, live.

- **Watchers are sent the op, not the document.** A move is a few hundred bytes where the
  document is tens of kilobytes, so the watcher runs the same `applyOp` the writer and the room
  both ran. Three machines, one function, ids travelling in the op — all three land on
  byte-identical XML.
- **Which is a claim, so every `applied` carries a hash.** The watcher re-serialises what it
  produced and compares. Disagreement is not resolved by guessing which side is right: the room
  is right, and the watcher throws its document away and asks for the current one. One round
  trip, and it is correct again rather than subtly wrong forever.
- **Exactly one resync per divergence.** Ops keep arriving while the answer is in flight, and
  replaying them onto a document already declared lost would produce more mismatches and more
  requests. A watcher awaiting `state` drops everything until it arrives.
- **A quiet drop costs nothing.** The watcher asks for state only when the room reports a holder
  *for the file it is showing* — so viewers of an unedited drop, and viewers on another tab of an
  edited one, never wake the room.
- **The view holds still.** The canvas replaces the document with `keepViewport`, so someone
  zoomed into one corner stays there while it changes around them.
- **Changed elements flash.** The op says what it altered; `applyOp` reports what it created.
  Amber for changed, green for new, for just over a second.
- **The header says why.** `4 VIEWING · 1 EDITING`, so a diagram moving on its own is legible
  rather than unsettling.

## The room edits the document (2026-09-11)

A drop's room is now the authority on what the drop *is* while anyone has it open. The holder's
ops arrive over the socket, and the room runs them itself.

- **Ops are replayed, not trusted.** The room imports the same `applyOp` the browser ran, from
  the new DOM-free `@bpmnkit/editor/headless` entry. A client cannot write anything it could not
  have reached by editing, and what everyone sees is the room's document rather than a writer's
  claim about it.
- **The permission model is one line, server-side.** An op from someone who does not hold the
  baton is refused — not by hiding a button.
- **A document is judged after the replay, never before.** `checkIntegrity` asks one question:
  *may this be stored?* Two elements under one id, a flow pointing at nothing, an element with no
  shape to draw it — each comes back to the writer as a reason (`"a reference would point at
  nothing (flow2 → end)"`), not as a silent no-op. Judging the *result* rather than the op is
  what keeps the check free of any knowledge of what individual ops do.
- **Untrusted input is shaped before it reaches the modeling layer.** `parseOp` checks that
  `kind` is one the editor knows and every field it will read is the type expected, with bounds
  on strings and arrays. Whether the edit makes *sense* is the integrity check's job; this one
  only stops a crash.
- **The whole document lives in Durable Object storage**, rewritten on every applied op. A
  SQLite-backed object allows 2 MB per key and value together — comfortably above the 900 KB file
  cap — so waking a hibernated room costs one read and one parse, with no op log to replay and
  nothing that grows without bound. D1 is where a cold room starts and stays behind until the
  autosave checkpoint; the room is ahead, and the room is right.
- **One canonical serialisation.** The hash the room broadcasts, the XML it stores, and the body
  a resync sends are all `Bpmn.export(defs)`, so a hash mismatch means a real divergence rather
  than a formatting difference.

## Editor operations: an edit that can be replayed (2026-09-11)

Every edit the editor makes now also *describes itself*. `diagram:op` fires alongside
`diagram:change` carrying an `EditorOp` — a move is a few hundred bytes where the document it
produced is hundreds of kilobytes, which is the difference between sending an edit over a wire
and not.

- **`applyOp(defs, op)` performs an op, and is how the editor performs its own edits.** There is
  no separate local path: if the editor composed the modeling calls itself and `applyOp` composed
  them again, the two could drift, and the entire promise is that they do not.
- **Ids travel in the op.** `Math.random()` is right for one person editing one diagram and wrong
  the moment the same edit happens twice. Creating ops carry a seed; `createIdFactory(seed)`
  mints the same sequence of ids on every machine, and the `modeling.ts` functions take an
  optional `IdFactory`. The same op yields **byte-identical XML** wherever it runs.
- **Placement and routing travel too.** Where the editor decides a position from what is on
  screen — smart placement, obstacle-avoiding waypoints, a snapped drop point — the decision is
  in the op rather than recomputed on replay, which would need the same screen to agree.
- **Undo, redo and `loadDefinitions` stay silent.** They replace the document rather than advance
  it, so they are not ops.
- **One escape hatch.** `applyChange(fn)` takes an arbitrary function, which cannot be replayed,
  so it emits a whole-document `snapshot` op. Under a single writer that is still correct — just
  larger on the wire.
- **`getViewport()` / `setViewport()`** are public on `BpmnCanvas` and `BpmnEditor`, so a view
  survives being handed from a viewer to an editor taking its place, instead of jumping on a
  re-fit.

## The edit baton (2026-09-11)

A drop's room now hands out a single write token. At most one participant may edit at a time,
which is the whole concurrency story — with one writer there is nothing to merge, and no
operational transform anywhere in the codebase.

- **Claiming is race-free without a lock.** Durable Object input gates deliver one message at a
  time, so a read-then-write inside the handler cannot interleave with another claim. Two sockets
  claiming in the same tick against a live Worker: one granted, one denied.
- **Identity is per-connection and opaque** — there are no accounts. The actor id is also the
  socket's tag, because tags are fixed at accept time and tagging by actor is what lets a later
  alarm find the holder's socket after the object has been evicted from memory.
- **Two kinds of reclaim, deliberately different.** A closed laptop lid sends no close event, so
  the holder's socket simply stops pinging and the baton is taken at once. A holder who is still
  connected but has done nothing is **warned a minute first**, because they are there and a
  keystroke should keep it.
- **The idle clock keys on messages that wake the room, never on heartbeats.** Pings are answered
  by the runtime without waking the object — they prove the socket is open, not that a human is
  behind it.
- **One alarm, many deadlines.** A Durable Object has a single timer, so the view flush and both
  baton deadlines share it: whichever is due next arms it, each firing re-arms for the one after,
  and a quiet room holds no timer at all.

## The presence room becomes the document room (2026-09-11)

`PresenceRoom` is now `DocRoom`, and it has taken over view counting — the idea
`doc/drop-spec.md` §6 described and never built. The head-count behaves exactly as before.

- **Fifty people opening a drop is one D1 write, not fifty.** `recordView` used to fire on every
  share-page load. Joins now accumulate in the room's own storage and reach D1 on a 60-second
  alarm, which also slides `expires_at`. Measured against a live Worker: 51 sockets, one write.
- **It costs no extra requests.** The viewer already opens this socket, so a join is a view the
  room can see without anyone asking it — no Durable Object request is added to trade against
  the D1 write removed.
- **A "view" now means a browser that connected**, not every HTTP request for the page. That
  excludes bots and JS-less fetches, and the share page renders client-side anyway, so a request
  that never runs the script never saw the diagram.
- Renamed via a wrangler `renamed_classes` migration, so existing instances and their stored
  counters carry over rather than starting fresh.

## Version history for a drop — eleven states, forever (2026-09-11)

Drops can now hold more than one state, and the number they hold is fixed: **the uploaded
original, kept forever, plus at most ten rolling milestones**. This is the safety net that makes
the coming "anyone with the link may edit" rule survivable — anyone can overwrite a drop, nobody
can destroy what it was.

- **The original is untouchable by construction.** Edits go to a new `file_current` table;
  nothing ever writes to `file_content` after the upload, so "the original survives" is a
  property one grep confirms rather than a promise. `?v=0` serves it, and the share page's
  **Original** download is pinned to that.
- **Bounded, and the panel says so.** A milestone is keyed by `<hour>:<session>`, so an hour of
  one editing session collapses to one entry and a new session always starts its own — a
  stranger's save at 10:45 cannot overwrite the previous editor's 10:30 work. Everything past
  the newest ten is pruned in the same batch as the write.
- **Suppression keys on `content_hash`, never on `semanticHash`**, which excludes all diagram
  interchange: an hour spent purely on layout hashes identically and would have been thrown away
  as a no-op. `semanticHash` instead *labels* each entry **Layout only** or **Model changed**, at
  no cost, from hashes already stored.
- **Restoring appends, never rewinds.** The state being replaced becomes a milestone first, so
  restoring can never be the thing that loses work; undoing a restore is another restore.
- **History panel** on the share page: view any kept version on the canvas without making it
  current, or restore it. The demo drop and admin-pinned drops are read-only, enforced server-side.

## An unsaved diagram survives a refresh (2026-09-11)

`bpmnkit.com/editor` keeps a single localStorage draft of the open diagram and offers it back
after a reload. It closes one specific hole: `@bpmnkit/plugins/storage` autosaves to IndexedDB
only for files that live in a project — both of its save paths return early without a file id —
so a diagram opened straight from the welcome screen persisted **nowhere**, and a refresh brought
the welcome screen back. Confirmed in the browser before building anything: localStorage was
empty and the work was gone.

- **Three gates, each ruling out a wrong draft rather than a redundant one**: a non-BPMN tab has
  no XML; a project file is already autosaved and a second copy would compete with it behind the
  prompt; and an untouched diagram is not work. The third needs a dirty flag — without it the
  `pagehide` flush drafted a diagram nobody had touched, so merely opening the editor earned you
  a restore prompt on the next visit.
- **Declining never deletes.** The prompt is answered once per tab via `sessionStorage`; the draft
  itself survives, to be overwritten by the next edit or cleared by a successful share. A stray
  click cannot destroy the only copy of someone's work.
- **Bounded**: one slot, a 7-day age limit, and malformed or expired values are cleared on read
  rather than left to prompt forever.
- Reuses `showConfirmDialog` from `@bpmnkit/plugins/storage`, so the prompt is the app's existing
  dialog rather than a second one.

## Author a diagram, then share it as a drop (2026-09-11)

`bpmnkit.com/editor` gains **Share as a drop** in the main menu: it posts the open diagram
straight to BPMN Kit Drop and hands back a link that renders it. Until now a drop could only
start from a file you already had.

- **No Worker changes.** It posts to the same `POST /drop/api/drops` the drop page uses, as a
  single multipart file, so an authored diagram clears exactly the gate a dropped one does —
  same parser, same size caps, same recorded `tos_version`.
- **Same-origin in both environments.** `bpmnkit.com/drop*` is carved out to the Drop Worker in
  production; `apps/landing/astro.config.mjs` proxies the same prefix to a local `wrangler dev`,
  so the browser never makes a cross-origin request and nothing needs CORS.
- **Gated on a BPMN tab.** `currentFileName` is the app's existing "a BPMN diagram is on screen"
  signal; without it, `exportXml()` would hand back the last BPMN from behind a DMN tab.
- The dialog reads the `--bpmnkit-chrome-*` tokens the editor already injects, so it follows the
  canvas through light, dark and neon without restating a palette.

## Every Cloudflare app deploys from the CLI (2026-09-11)

`apps/landing`, `apps/studio`, `apps/demo` and `apps/learn` each gained a `deploy` script
matching the command CI already runs, alongside the one `apps/drop` had. A release is now
`pnpm turbo build --filter <app>` then `pnpm --filter <app> deploy`, documented in the README.

## One design system across every editor panel (2026-09-11)

The `@bpmnkit/plugins` panels — command palette, config panel, process runner, AI bridge,
element docs, connector catalog, main menu, history, deploy, optimize, storage, ascii view,
live mode, diff, lint, minimap, story view, variable flow, pattern advisor, zoom controls,
presentation and feel playground — are flat, square and hairline-ruled, on one accent.

- **`--bpmnkit-chrome-*`, declared once.** `packages/editor/src/chrome.ts` holds the per-theme
  ground, line, ink, accent and scrim that every piece of editor chrome reads. A panel
  stylesheet is now one set of rules; the dark/light/neon copies it used to carry are gone.
- **1,060 lines net removed** across 32 files, almost all of it duplicated theming.
- **Exempt, deliberately**: circular marks, semantic state (success / warning / danger), and the
  two document palettes the brief leaves to their renderers — the DMN decision table and the
  FEEL syntax classes.

## The design system reaches the editor's start page and the studio (2026-09-10)

- **Editor start page** (`@bpmnkit/plugins/tabs`) — flat, square, hairline-ruled: actions in one
  bordered box, examples in one bordered box divided by hairlines rather than gapped cards, mono
  labels and file-type marks in the single accent, and the `bpmn**kit**` wordmark in place of the
  logo lockup. The file-tab bar above it matches, with the accent underline sitting on the row's
  own rule.
- **Studio** — one seam (`src/styles/design-system.css`) re-points the `--bpmnkit-*` tokens the
  whole app already reads onto `--bpmnkit-ds-*`, so cascivo components, Tailwind utilities and
  the embedded editor all follow. Radius and shadow are collapsed at the scale rather than at
  164 call sites; circular marks keep their shape. Space Grotesk and Space Mono are self-hosted.
- **The studio now opens in the design system**, not the `neon` white-label theme, which remains
  available in the switcher.

## One design system across Drop and the Editor (2026-09-10)

The bpmnkit.com landing system — flat, square, hairline-ruled, terracotta accent, Space Grotesk
for prose and Space Mono for every label and datum — now covers `apps/drop` and the
`@bpmnkit/editor` chrome as well as the marketing site.

- **`--bpmnkit-ds-*` in `packages/ui`.** The system's grounds, ink scale, hairlines, code-panel
  syntax colours, type scale and layout metrics, in `tokens.css` and the mirrored
  `UI_TOKENS_CSS`. Additive: the existing `--bpmnkit-*` product palette is unchanged, so no
  other app shifts colour.
- **Drop's pages rebuilt on it.** Split hero with a vertical hairline, square dashed dropzone,
  hairline-divided card grids, one full-bleed dark band, a `--dark-code` API panel, and a
  single-open FAQ using native `<details name>`. The share viewer, diff, moderation and policy
  pages match. No `border-radius`, `box-shadow` or `linear-gradient` remains in the app's CSS.
- **Self-hosted type.** Space Grotesk and Space Mono are copied from the landing app into
  `public/drop/fonts/` at build time, licences included, so Drop serves its own faces.
- **Editor chrome flattened.** Toolbars, the tool palette and the zoom cluster are each a single
  bordered box with internal hairlines instead of gapped rounded pills; panel labels are mono
  uppercase; the properties dock tabs carry a 2px accent underline on the row rule; the input
  modal and shortcut sheet are square and unshadowed. Icon buttons set
  `font-variant-emoji: text` so no glyph is promoted to a colour emoji.
- **Selection is a halo, not a recolour.** A selected element gets a dashed accent outline
  *around* the shape; the BPMN stroke, its rounded task corners and its labels are untouched.

## Formatting-preserving writes for DMN, measured (2026-09-10)

DMN shipped with the first cut of the preserving writer and did not deliver: a real Camunda
decision came back from a save that changed nothing with six to eighteen lines rewritten. Two
defects fixed — one in the XML patcher, one in `serializeDmn` — and the numbers are now the
same as for BPMN and forms.

- **An element with an id in the file and none in the update is paired again.** A DMN file's
  `dmndi:DMNDI` section names its `DMNDiagram` and `DMNShape` where the model does not, so the
  whole diagram block used to be deleted and rewritten on every save.
- **`hitPolicy` is written whenever the model has one, `UNIQUE` included.** The parser reads
  it, so omitting it as a schema default broke `parse(export(m)) === m` — the comparison a
  preserving write checks itself against before it uses anything it kept.

Measured on two decision tables, each as the modeler writes it and tab-indented: an identity
save changes **0** lines in all four cases (against 6 and 18 before, and 10 to 90 for a plain
write), and editing one rule changes **two**.

## Formatting-preserving writes for form files (2026-09-10)

The JSON counterpart of yesterday's XML writer. `exportForm` writes
`JSON.stringify(…, null, 2)` in its own key order, so a form indented with tabs came back with
every line rewritten the first time anyone touched it. Now it comes back with the line they
touched.

- **`preserveJsonFormatting(original, updated)`** in `@bpmnkit/core` — keeps the file's
  indentation, key order, number and string spellings, and trailing newline. Numbers and
  strings are compared by *value*, so `1.0` is never rewritten as `1` and `\u00e9` never as `é`.
- **`exportFormPreserving()`** for `.form` files.
- **It checks itself**, and needs no strategy and no injected reader: an object is an unordered
  collection and an array is an ordered sequence (RFC 8259), so deep equality with those rules
  states exactly what "unchanged" means for JSON. The XML writer cannot make that claim, which
  is why it asks the caller to verify instead.
- Wired into the VS Code form editor.

Measured on one form written four ways — as the modeler writes it, tab-indented, four-space and
minified: opening and saving changes **0** lines in every case (against 21, 109, 101 and 57),
and relabelling one field changes **one**.

## Formatting-preserving writes (2026-09-10)

A visual editor serialises the whole model, so saving a diagram used to reformat the file to
this toolkit's output and bury one change in a rewrite of everything. `exportPreserving()`
writes the file that was already there and changes only what the model changed. Renaming one
element across sixteen real diagrams: **313 changed lines before, 32 after**. Opening and
saving without editing: **0**.

- **`preserveFormatting(original, updated)`** in `@bpmnkit/core` — generic XML, no model
  involved. Attribute values are compared decoded, so `&#10;` is never rewritten as `&#xA;`;
  comments survive; an inserted element is re-indented to match its new siblings.
- **`preserveFormattingVerified(original, updated, read)`** — the strategies worth having are
  ones no generic tool may assume: keeping the file's own sibling order, and keeping an
  attribute the serializer drops as a schema default. Each is tried, then the result is parsed
  with the caller's own reader and compared against a plain write. The plain write is the
  floor.
- **`exportPreserving()`** for BPMN and **`exportDmnPreserving()`** for DMN, each supplying its
  own parser as the check — which is what stops the order-keeping strategy from undoing a
  reordering of DMN rules, where order is the decision rather than the layout.
- Wired into the VS Code editor, so a save is a diff a reviewer can read.

## Editing in VS Code, and the rest of the deferred list (2026-09-10)

Phase 7 of [`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md).

**BPMN, DMN and forms are edited in VS Code, not only read.** The custom editors are *text*
custom editors, backed by the same `TextDocument` a text editor opens — so the file is dirty
when the document is, Ctrl+S saves, hot exit restores, undo is the editor's undo, and a text
editor open on the same file is a second view rather than a competing copy. Type in the XML
and the diagram follows; move a box and the XML follows. `bpmnkit.editing.enabled` mounts the
same editors with editing switched off.

**Test data from the repository.** Deploy-and-start offers the payloads found in
`.camunda/payloads/*.json`, walking up from the diagram the way element templates already do.
A payload is a JSON object of process variables named by its file; one beside the diagram
overrides one at the project root sharing its name.

**Detail cards in the connector picker.** Selecting a template shows what it binds — the job
type, the element type it applies to and converts to — and every property it will ask for,
with the ones that read like credentials marked, before anything is applied. `summarizeTemplate()`
is now exported from `@bpmnkit/connectors`, so the picker and `casen connector show` describe a
template through the same code.

**A localisation harvest, and what it measured.** `createTranslationRecorder()` is a `Translate`
that records what it is asked for; a test runs a real editor, presses every button it can reach,
and writes `packages/editor/i18n/en.json`. The running editor asks for **58** strings; a grep
over the source finds **11**. Localising from the grep would have shipped a mostly-English
editor with a full-looking catalogue.

## Simulation, FEEL and deployment inside VS Code (2026-09-09)

Phase 6 of [`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md) — the
part of the editor experience that exists because of what is in this repository rather than in
spite of it.

**Step-through simulation.** `@bpmnkit/engine` is a BPMN engine in TypeScript with no server
behind it, so the preview executes the diagram on screen: Run, One Step, Cancel, tokens drawn on
the elements holding them, live variables and FEEL evaluations, a replay timeline. Nothing is
deployed and nothing leaves the machine. Turned off with `bpmnkit.simulation.enabled`.

**FEEL playground on the selection.** Select an expression in the XML and the playground opens
pre-filled, evaluating against an editable context as you type — expressions and unary tests
both. One panel, re-seeded on each invocation rather than stacked.

**Deploy and start against a `casen` profile.** The clusters are the ones the CLI already knows;
the extension reads the same profile store rather than adding a second place to configure a
connection or holding credentials in workspace settings. Deploy the open resource, or deploy and
start an instance with variables and get its key back. Starting is by process definition key, so
the instance runs the version that deploy just produced.

**Copy Diagram as ASCII.** `@bpmnkit/ascii` rendering, fenced and dedented, for a pull request
or an issue — the places a picture cannot go.

**Two fixes in `@bpmnkit/plugins`, found by mounting them in a new host.** The process runner no
longer offers a Tests tab to a host that cannot run a scenario, and `buildFeelPlaygroundPanel()`
now injects its own stylesheet instead of depending on every caller to remember.

## BPMN Kit for VS Code (2026-09-09)

Phase 5 of [`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md) — the
toolkit, resident in the editor. `apps/vscode` is a VS Code extension built entirely from the
packages in this repository; nothing in it wraps bpmn.io, so the files it shows are the files git
has, byte for byte.

**Read-only custom editors for `.bpmn`, `.dmn` and `.form`**, rendered by `@bpmnkit/canvas` and
the `dmn-viewer` / `form-viewer` plugins, with minimap and zoom for BPMN. The preview opens
*beside* the text editor rather than replacing it, follows the buffer as it is typed rather than
only on save, and keeps the last drawing that parsed when the XML is momentarily invalid.

**Visual BPMN diff**, from the Source Control panel against `HEAD` and from an Explorer two-file
selection. Phase 1's `diffDiagram()` and `@bpmnkit/plugins/diff` unchanged, driving two
synchronised canvases. VS Code's diff editor pairs two *text* editors and a custom editor cannot
stand in for either side, so this is a second view of the same change rather than a replacement
for the first.

**Analysis findings in the Problems panel**, from Phase 3's `lintDiagram()` running in the
extension host where `@bpmnkit/core` runs unchanged. Each finding is placed on the element that
caused it by a scanner over the raw XML — a parser would be the obvious tool and the wrong one,
since the file on screen is routinely mid-edit and unparseable. The engine rule is the same one
every other surface applies: a diagram naming no execution platform is not judged against Camunda
8 deployability unless `bpmnkit.lint.forceEngineRules` says so.

**Colours follow the active VS Code theme**, with the `@bpmnkit/ui` palette as the last link in
every fallback chain, so a theme that skips a colour degrades to the brand value rather than to
nothing.

`vsce package` produces the `.vsix`; the extension is pre-1.0 and community-supported, and
`apps/vscode/README.md` is the Marketplace listing that says so.

## Keyboard navigation, go-to-reference, and the port pattern (2026-09-09)

Phase 4 of [`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md) — the
phase that establishes how a plugin talks to whatever application is hosting it.

**`@bpmnkit/plugins/flow-navigation`** adds the traversal keyboard modelling was missing. Tab
follows a sequence flow out, Shift+Tab follows it back, and at a fan-out Tab selects between the
outgoing flows rather than guessing which branch was meant; Enter follows the choice, or drills
into a collapsed sub-process, and `u` drills back out. The canvas already binds Tab to document
order, so the plugin intercepts in the capture phase and stops the event **only when it moved** —
an element with no outgoing flow still falls through to that walk instead of trapping the user.

**`@bpmnkit/plugins/model-navigation`** jumps from a Call Activity to its process, a Business
Rule Task to its decision, a User Task to its form — reading both the Camunda 8 extension shape
and the Camunda 7 attribute one. Following a reference means opening a file, and a canvas has no
idea what a file is, so the plugin does the model half and takes the rest as an injected
`ReferencePort`. Availability is optimistic and then corrected: a link shows as soon as the
model states it and is withdrawn only once the host says it does not resolve.

**[`doc/port-pattern.md`](port-pattern.md)** writes the pattern down — the four rules, the ports
already in this repo, the two shapes that look like ports and are not, and where the seam sits
when a plugin produces data a host forwards.

**`CanvasApi` gains `getPlanes()` and `showPlane()`.** `BpmnCanvas` had both and plugins could
not reach them, so no plugin could drill into a sub-process.

**A serializer fix.** Verifying that an engine-neutral model stays engine-neutral turned up the
opposite defect: the writer emitted only the namespaces a model was parsed with, so a neutral
diagram given a `zeebe:taskDefinition` exported a prefix bound to nothing — not
namespace-well-formed. Extension prefixes the document uses are now declared; ones the model
already bound anywhere are left alone. The structural prefixes the serializer emits itself are a
separate gap, recorded on the roadmap.

## Static analysis on the canvas (2026-09-09)

`casen lint` has had five categories of rules built on `packages/core/src/bpmn/optimize/` for a
while, and none of them were visible while modelling. Phase 3 of
[`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md).

**`@bpmnkit/plugins/lint`** marks every offending element with its worst severity — a task with
an error and three warnings reads as an error, because drawing both would say neither — and puts
a control in the top-left corner counting them. Clicking it centres the next offending element
and pulses it, wrapping around. It says how many findings sit on a plane the canvas is not
showing, and re-lints after an edit on a 300 ms debounce, so typing a name does not re-run the
analysis on every keystroke. `setEnabled(false)` turns it off for a host that wants a toggle.

**`lintDiagram()` in `@bpmnkit/core`** is the host-facing seam, and does two things calling
`optimize` directly does not:

- **The result is serialisable.** An `OptimizationFinding` carries an `applyFix` function and so
  cannot cross a `postMessage` or a JSON boundary; a `LintDiagnostic` reports `fixable: true` and
  leaves the fix where it can still be called. Each diagnostic also names the diagram plane its
  elements are drawn on.
- **The rules match the model.** A diagram naming no `modeler:executionPlatform` is not judged
  against Camunda 8 deployability. Measured rather than assumed: on an engine-neutral model every
  other category either stays quiet or reports something structural that holds regardless, while
  `deploy` calls a plain service task an **error** for having no `zeebe:taskDefinition`.

**`casen lint` follows the same rule** — it skips the engine categories on a neutral model and
says why, and `--profile deploy` forces them back on. Both surfaces ask `lintCategories` rather
than keeping separate lists.

The plugin is installed in the studio editor, so the findings show up where the modelling
happens.

## Element templates by convention (2026-09-09)

Drop element templates in `.camunda/element-templates/` and the tools pick them up — no project
configuration, no registration step. Phase 2 of
[`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md), and the largest
capability gap it found: `@bpmnkit/connectors` understood the Zeebe element-template schema but
could only ever load its own generated catalogue, so a team's in-house connectors could not
reach the editor at all.

**Discovery** (`@bpmnkit/connectors/node`) walks up from a diagram to the project root,
collecting templates at every level. Nearest wins: a template beside the diagram overrides one
at the project root, which overrides the bundled version of the same id. The folder name follows
a `configFolder` setting rather than being hard-coded. `collectElementTemplates({ root })` is
the opposite walk — the one a CI check wants, since a project whose broken template sits beside
a sub-folder's diagrams would otherwise pass a check that only read the root.

**Validation** is structural rather than a JSON-schema engine: the rules the published schema
enforces, checked against the shapes this package already declares, so a message names
`properties[3].binding.type` instead of "must match exactly one schema in oneOf". Every problem
is reported at once, a rejected template is named and skipped, and one bad file never costs the
good ones beside it. A separate warnings channel flags a binding the schema allows but
`applyElementTemplate` does not write yet, so a template cannot fail silently at apply time.

**`casen connector validate`** runs the same check in CI — a whole project or one `.json` file,
`--format json`, non-zero exit on a problem, warnings that do not fail. `list`, `search` and
`show` now include the project's own templates.

**The browser path** does not assume a filesystem. The proxy serves `GET /element-templates?root=…`
and the connector-catalog plugin takes `workspaceRoot` (fetch via proxy) or `workspaceTemplates`
(supplied directly), registering them after the built-ins so a project's version wins. The
studio passes its active project's path.

`TemplateBinding` also gains the three binding types the bundled catalogue uses across 98
properties but the union did not admit: `bpmn:Message#property`,
`bpmn:Message#zeebe:subscription#property`, and `zeebe:linkedResource`.

## Visual BPMN diff — engine, CLI, studio and drop (2026-09-09)

Two versions of a diagram compared side by side, with every element marked added, removed,
changed or moved. The first phase of
[`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md), complete.

**`diffDiagram(before, after)`** in `@bpmnkit/core` (`src/bpmn/diagram-diff.ts`) sits beside
`diffSemantics`, which excludes diagram interchange by design — so a task somebody dragged reads
there as no change at all. `diffDiagram` adds that half back as its own `moved` category,
computed from DI: bounds, waypoints, label placement, and flags such as collapsed/expanded. That
is the difference between a model diff and a *diagram* diff. An element that both changed and
moved is reported as changed, since a semantic change is what a reviewer needs first. The result
covers only elements carrying DI on one side or the other — a changed `targetNamespace` has
nothing to draw — and carries a per-plane breakdown.

**`@bpmnkit/plugins/diff`** renders it. `createBpmnDiff()` returns a *pair* of canvas plugins,
because a canvas plugin only ever sees its own canvas: each side publishes the model it loaded,
and the diff computes once both have arrived, in whichever order. Elements are marked on the side
that can show them, a legend counts each category, and panning or zooming either canvas moves the
other. Element lookup goes through `getShapes()` / `getEdges()` rather than an attribute selector
built from an id read out of a file.

**`casen diff bpmn <before> <after>`** reports the same thing in a terminal, naming elements
rather than printing bare ids, with `--format json`, `--ascii`, and `--exit-code` to gate a
pipeline.

**`apps/studio`** gets `/models/diff`: two pickers, a swap button, a summary bar, and a
**Compare** entry point on the Models page. **`apps/drop`** gets `/drop/:a/diff/:b`, resolving
both drops server-side so an expired share is a 404 rather than half a comparison, and pairing
files by name with a picker per side.

**Planes.** A canvas draws one plane at a time, so a change inside a collapsed sub-process is
invisible until the reader drills in. The legend says `N on other planes`, and the CLI names
them.

Colours are brand tokens with hex fallbacks: `--bpmnkit-success` added, `--bpmnkit-danger`
removed, `--bpmnkit-warn` changed, `--bpmnkit-accent` moved.

## Documentation served from the landing site at `/docs` (2026-08-29)

The reference documentation renders from `apps/landing` at `bpmnkit.com/docs` in the landing's
own engineering-specification design, replacing the separate Starlight app on
`docs.bpmnkit.com`. The sidebar, prev/next pager, `/docs` index, search index and both
`llms.txt` endpoints are derived from the `docs` content collection, so adding a Markdown file
under `src/content/docs/<section>/` is the whole procedure for adding a page; `sidebar.order`
in the front matter positions it. Code blocks use a Shiki theme built from the site's own
`--code-*` tokens. Search is a build-time `/docs/search.json` (58 KB) ranked client-side —
no crawler, no dependency.

## Landing site engineering-specification design (2026-08-22)

The landing site (`apps/landing`) moved off the dark-gradient dev-tool template to a paper-ground engineering-specification system: `#f4f5f7` ground, hairline `#dcdfe4` rules, ink `#14161a` code panels and dark bands, one accent `#a8503a`, self-hosted Space Grotesk + Space Mono (six woff2 subsets, ~140 KB, no third-party request on first paint), no radius, shadows or gradients. Tokens live in `apps/landing/src/styles/global.css` and every page inherits them. The homepage is a hero plus eight numbered sections instead of eleven undifferentiated ones, with the builder snippet and its rendered diagram above the fold, and pre-1.0 versions plus the engine simulator caveat stated up front in section 03 rather than at the page bottom.

## Documentation as an installable package for AI agents (2026-08-21)

`@bpmnkit/docspack` ships the BPMN Kit documentation as an npm package in the [docspack format](https://docspack.dev/spec): `.llms/chunks/*.md`, a schema-valid `.llms/manifest.json` and an `llms.txt` table of contents, built from `apps/landing/src/content/docs`. An agent installs it and runs `npx bpmnkit-docs ask "<question>"`; the answer comes from a local BM25 index with Porter stemming, capped at three chunks and 3,000 tokens, and names the pack, version and chunk it came from. Every command reads the filesystem only — no server, no network call. The vendor-scope name means the upstream `docspack` CLI indexes the pack too.

## Auto-layout comparison page (2026-08-21)

`/auto-layout` on the landing site lays out five real process models with both engines and lets you toggle between them. The models ship as model-only BPMN with no diagram interchange, so both layouts are computed in the browser from the same source; per-diagram counts for crossings, routes over shapes, backward flows, bends and edge length are measured at build time. `applyAutoLayout(defs, engine)` accepts `"semantic"` (default) or `"grid"`, matching `layoutProcess`.

## Semantic BPMN layout engine (2026-08-20)

`@bpmnkit/core`'s auto-layout is now a **semantic** engine (`packages/core/src/layout/semantic/`) rather than a cell-grid walk. It follows the layout contract that [`bpmn-auto-layout` 2.x](bpmn-auto-layout-evaluation.md) documents, reimplemented in our own code against our own AST — no new runtime dependency, and still fully synchronous.

- **Ranks and semantic bands** — a primary path (spine) is picked one edge at a time, preferring edges that can still reach an end event and the gateway's default flow, so a dead-end alternative never becomes the main narrative. Branches take bands around it: error handlers below, escalation handlers above, plain alternatives alternating; branches whose rank spans do not overlap share a band.
- **Lane membership is a placement constraint** — nodes are moved into the lane that claims them and lanes are sized to their content, nested lane sets included (a parent lane spans the lanes inside it). Lane bands come from the engine, so lanes tile their pool exactly. Previously lanes were ignored by placement and tiled proportionally afterwards, which put **43 of 257** lane-assigned elements in the wrong lane across the reference corpus; it is now **0 of 257**.
- **Obstacle-aware orthogonal routing** — each edge proposes candidate routes and takes the first that clears every unrelated shape: a straight spine segment, a turn out of the source's top or bottom, a turn in the empty gutter in front of the target's column, then a corridor detour. Detours stack in separate corridor lanes, widest span outermost, and loops run underneath the flow they repeat.
- **Collaboration pipeline** (`packages/core/src/layout/collaboration/`) — pools are ordered by their message-flow relationships rather than by declaration (exhaustive up to eight pools, remove-and-reinsert above), and each process slides sideways as a unit so the elements it exchanges messages with line up vertically. Message endpoints inside a collapsed sub-process dock on the nearest ancestor that is actually on the plane.
- **`layoutProcess(process, engine)`** selects `"semantic"` (default) or `"grid"`; the grid walk still backs `layoutFlowNodes()` for ascii, proxy and compact rendering.
- **Complete diagram interchange** — every participant gets a pool, black boxes included (a participant with no process still gets a band and its message flows are routed); collapsed sub-processes keep their own `BPMNDiagram` for drilldown instead of being flattened into the root plane; root processes beyond the first get a plane of their own. Across the reference corpus auto-layout now emits DI for **every** element, connection and plane.

## BPMN Kit Drop v2 — engaging landing + AI process review (2026-07-10)

Second iteration of [BPMN Kit Drop](drop-v2-spec.md), shipped in `apps/drop`.

- **cloudflare.com/drop-style landing** — the whole page is a drop target (full-viewport overlay on drag), `Ctrl/Cmd+V` pastes BPMN/DMN/Form content to create a drop, and a **live hero canvas** renders a real diagram with a draw-in animation. A built-in **demo drop** (`/drop/demo-loan-approval`, a BPMN + linked DMN + Form) is served from memory — one click shows the full share experience, and it works on a fresh deploy with no seeding.
- **Story sections** — "what people drop" cards each render a real mini BPMN (built at deploy time via `exportSvg`), a developer `curl` walkthrough, live D1-backed counters (shown once ≥ 100 drops), and an FAQ.
- **AI process review (closed beta)** — a one-click panel that reviews a BPMN process. Deterministic `@bpmnkit/core` analysis (`optimize`: pattern advisor, variable flow, FEEL, naming) is narrated by Workers AI (`@cf/openai/gpt-oss-120b`, JSON-schema output) into a prioritized summary + suggestions; each suggestion highlights its element on the canvas. Reviews are cached in D1 by content hash, guarded by a daily neuron budget, and degrade to deterministic-only if the AI is unavailable.
- **Passcode gate** — the AI review is invite-only: off unless the operator sets an `AI_PASSCODE` secret (feature hidden entirely when unset), verified constant-time via an `X-Drop-AI-Code` header, with per-IP brute-force limiting and client-side persistence. Rotating the secret is an instant kill switch.

## BPMN Kit Drop — one-drop diagram sharing (2026-07-09)

New Cloudflare Worker app (`apps/drop`) served at `bpmnkit.com/drop`: drop BPMN, DMN, and Camunda Form files and get a short shareable link (`/drop/:shareId`) that renders them read-only in the browser. Inspired by [Cloudflare Drop](https://www.cloudflare.com/drop/). Design and rationale: [`doc/drop-spec.md`](drop-spec.md).

- **Multi-file drops** (up to 20 files / 5 MB): tabbed viewer with cross-file navigation — clicking a user task or business-rule task jumps to the referenced form/decision file when it's in the drop.
- **Renders with bpmnkit only** — BPMN via `@bpmnkit/canvas` (+ zoom/minimap plugins), DMN via the `dmn-viewer` plugin, Forms via `form-viewer`; no bpmn-js/dmn-js/form-js.
- **JSON-native storage** — every file is validated and converted with `@bpmnkit/core` on both client and server, then stored in Cloudflare D1 as the full typed model alongside the byte-faithful original.
- **Live presence** — a Durable Object per share (WebSocket Hibernation API) shows "N viewing" with no external SaaS.
- **90-day sliding retention** — drops expire 90 days after their last view; a daily cron deletes expired rows.
- **Moderation & safety** — passive Terms/Privacy acknowledgment on upload, a public "Report abuse" flow, and token-gated admin endpoints + a `/drop/admin` page to delete drops (optionally banning their content hashes). Strict CSP, `noindex` share pages, XSS/XXE regression tests.

## SEO & discoverability foundation (2026-07-07)

Technical SEO across `bpmnkit.com`, `docs.bpmnkit.com`, and `learn.bpmnkit.com`, plus new evergreen and blog content aimed at organic search. Full plan: [`doc/seo-plan.md`](seo-plan.md).

- **Shared `<Seo>` component + JSON-LD helpers** (`@bpmnkit/astro-shared`) — one source of truth for title/description/canonical/OG/Twitter tags and schema.org structured data (`Organization`, `SoftwareApplication`, `Article`, `BreadcrumbList`, `FAQPage`) across all three Astro apps.
- **Sitemaps + `robots.txt`** on `landing`, `docs`, and `learn` (none existed before).
- **Domain/brand unification** — `docs` was titled "BPMN SDK" and pointed at `bpmn-sdk-docs.pages.dev`; now "BPMN Kit" / `docs.bpmnkit.com`, matching the product everywhere else. `learn` had no `site` URL configured at all.
- **`/connectors`** (`bpmnkit.com`) — 116 pages, one per Camunda 8 connector template, generated from `@bpmnkit/connectors`' real catalog data (required/optional inputs, task type, an `applyConnectorTemplate()` code sample).
- **`/compare`** (`bpmnkit.com`) — `bpmn-js` and `camunda-modeler` comparison pages with FAQ structured data.
- **`/glossary`** (`learn.bpmnkit.com`) — 12 BPMN element definitions (events, gateways, tasks, sub-processes, boundary events, message events, timer events, call activities), each with a generated diagram, a runnable `@bpmnkit/core` example, and a link to the matching tutorial where one exists.
- **`/blog`** (`bpmnkit.com`) — Astro content collection + RSS feed, all 10 posts from the editorial calendar published: generating, laying out, simulating, and deploying BPMN diagrams; migrating from bpmn-js; evaluating FEEL; AI-generated BPMN; embedding a viewer in React; boundary events; generating a connector from an OpenAPI spec.
- **`/feel-functions`** (`bpmnkit.com`) — reference for all 87 `@bpmnkit/feel` built-in functions, verified 1:1 against the package's real `builtinNames()` export.
- **`/use-cases`** (`bpmnkit.com`) — 4 pages (AI workflow generation, embedding the editor, Camunda 8 CI automation, process simulation), each with a runnable code sample and FAQ structured data.
- **`doc/seo-phase6-checklist.md`** — a step-by-step checklist for Search Console, Bing Webmaster, analytics, and backlink/outreach setup — the one part of the SEO plan that requires live domain access and can't be done from the repo.

## AIKit v2 — Deterministic Generation Pipeline (2026-07-07)

Replaces the LLM-in-the-loop `bpmn_create`/`bpmn_update` MCP tools with a deterministic, CLI-first pipeline: every BPMN process is authored as a `ProcessPlan` JSON file and compiled by `casen synth` — the LLM never writes BPMN XML, element IDs, or connector property keys by hand.

- **`@bpmnkit/connectors` package** — the 116-template Camunda 8 OOTB connector catalog plus a complete, deterministic template applier (`listConnectors()`, `searchConnectors()`, `getTemplate()`, `applyElementTemplate()`/`applyConnectorTemplate()`) covering every binding kind (`zeebe:input/output/taskHeader/taskDefinition/property/adHoc`), dropdown-gated conditions, and FEEL parse-validation.
- **`buildAiAgentSubProcess()`** (`@bpmnkit/core`) — deterministic constructor for Camunda's AI Agent Sub-process pattern: tools as root-node activities, `fromAi()` tool-schema generation, verified against the real bundled `io.camunda.agenticai:aiagent-job-worker:1` template.
- **`ProcessPlan` JSON IR + `casen synth|plan|connector` CLI** — `casen synth <plan>.json` compiles a plan deterministically to laid-out, deployable BPMN (or `--merge`s a delta plan into an existing process); `casen plan extract` lifts an existing process back into plan form; `casen plan schema` prints the format reference; `casen connector search|show` browse the catalog.
- **Deploy-grade lint profile** — `casen lint --profile deploy` gates on Zeebe/Reebe deploy-parity rules (`deploy/*`), AI Agent sub-process structural rules (`agentic/*`), connector completeness (`connector/missing-required`), and full-tree FEEL syntax validation (`feel-syntax/*`) — errors only, the deploy-readiness gate.
- **Honest simulation** — `bpmn_simulate` actually executes scenarios via the TS engine (`mode: "execution"`) when given any, instead of always doing structural-only analysis; the engine's dispatcher runs job-worker-backed ad-hoc sub-processes (e.g. the AI Agent Sub-process) through the same job-mock mechanism as any other task, so scenarios can mock them.
- **Consolidated, CLI-first Claude Code plugin** (`plugins-claude/bpmnkit-claude`) — `/bpmnkit:implement`, `:extend`, `:agent`, `:connect`, `:review`, `:test`, `:deploy`, `:instances`, `:incidents`; no MCP server or proxy daemon required. Generated + hand-written reference docs (`references/plan-format.md`, `connectors.md`, `agentic.md`, `feel.md`, `modeling-style.md`) read by every skill before it authors a plan.
- **New `casen deploy deploy <file> [--target camunda8]`** — file-based multipart BPMN deployment to local Reebe or Camunda 8, standalone (previously only reachable via the `bpmn_deploy` MCP tool).
- **`scripts/eval-generation/`** — a 15-golden-prompt eval harness verifying the pipeline end-to-end (synth-clean, deploy-profile-clean, test pass rate, deploys-green where Reebe is available) without requiring an LLM call.

Full design rationale: [`doc/ai-bpmn-generation-analysis.md`](ai-bpmn-generation-analysis.md); implementation spec: [`doc/spec-bpmn-generation-skills.md`](spec-bpmn-generation-skills.md).

## Cascivo design system — studio (2026-06-20)

Migrating the studio console to the [cascivo](https://cascivo.com) design system
(`@cascivo/react`), replacing the Radix + Tailwind UI layer. Stage 0 foundation
landed: dependencies, a cascivo↔`@bpmnkit/ui` brand-token bridge
(`apps/studio/src/styles/cascivo.css`), and a staged migration plan
(`doc/cascivo-migration.md`). Scope: studio, `@bpmnkit/operate`, desktop.

## BPMN Builder SDK improvements (2026-06-13)

Nine incremental improvements to `@bpmnkit/core`'s `bpmn-builder.ts` API:

| # | Feature | Entry point |
|---|---|---|
| 1 | Element factory functions extracted (refactor + `userTask` `formId` fix) | internal |
| 2 | Gateway/branch support in `SubProcessContentBuilder` | `SubProcessContentBuilder.exclusiveGateway()`, `.branch()`, etc. |
| 3 | Build-time validation + strict mode | `Bpmn.createProcess(..., { strict: true })` |
| 4 | Ergonomic boundary event attachment | `ProcessBuilder.withBoundary(config, cb)` |
| 5 | Service task type default + `disconnectedStartEvent()` alias | `ProcessBuilder.disconnectedStartEvent()` |
| 6 | Multi-process diagram builder | `Bpmn.createDiagram(id).process(...).build()` |
| 7 | `EXPORTER_VERSION` constant (replaces hardcoded `"0.0.1"`) | internal constant in `bpmn-builder.ts` |
| 8 | **`executionPlatformVersion` setter** (2026-06-26) | `ProcessBuilder.executionPlatformVersion("8.x.0")`, `DiagramBuilder.executionPlatformVersion("8.x.0")` |
| 9 | **Fluent text annotations + DI** (2026-06-26) | `.textAnnotation(text)`, `.annotate(elementId, text)` on `ProcessBuilder`, `BranchBuilder`, `SubProcessContentBuilder`; annotation shapes/edges in `withAutoLayout()` |
| 10 | **Abstract `.task()` method** (2026-06-28) | `ProcessBuilder.task()` / `BranchBuilder.task()` / `SubProcessContentBuilder.task()` — emits abstract `<bpmn:task>` with no Zeebe extensions, for documentation-grade diagrams. |
| 11 | **Branch sub-builder: boundary events and nested gateway branches** (2026-06-30) | `BranchBuilder.boundaryEvent()`, `.withBoundary()`, nested `.branch()` on sub-builder with full open-branch-ends propagation |

## CLI — `casen generate` and `casen view` (2026-04-25)

### `casen generate bpmn` — Generate BPMN files from parameters or JSON

Two input modes:

**Template mode** — predefined patterns:
```sh
casen generate bpmn --template minimal --process-id order --name "Order Processing"
casen generate bpmn --template approval --process-id leave-request
casen generate bpmn --template parallel --process-id enrichment
casen generate bpmn --template error-boundary --process-id resilient-job
casen generate bpmn --template event-subprocess --process-id with-error-handler
casen generate bpmn --template timer-start --process-id nightly-sync
casen generate bpmn --template message-start --process-id message-driven
```

**Definition mode** — full control via CompactDiagram JSON (AI path):
```sh
# Pass JSON inline
casen generate bpmn --definition '{"id":"Defs","processes":[...]}'

# Pipe from AI output or file
echo '{"id":"Defs","processes":[...]}' | casen generate bpmn --output my-process.bpmn

# Print the full JSON schema reference
casen generate bpmn --help-schema
```

**Templates** (auto-layout applied to all):

| Template | Pattern |
|---|---|
| `empty` | Start event only |
| `minimal` | Start → service task → end |
| `user-task` | Start → user task → end |
| `call-activity` | Start → call activity → end |
| `business-rule` | Start → business rule task → end |
| `approval` | Start → user task → XOR gateway → approve/reject paths |
| `parallel` | Start → parallel fork → 2 tasks → join → end |
| `inclusive` | Start → inclusive gateway → 2 conditional tasks → merge → end |
| `timer-start` | Timer start event → service task → end |
| `message-start` | Message start event → service task → end |
| `error-boundary` | Service task with error boundary → two end events |
| `subprocess` | Start → sub-process (with inner flow) → end |
| `event-subprocess` | Process with non-interrupting error event sub-process |

**All flags:**

| Flag | Short | Description | Default |
|---|---|---|---|
| `--process-id` | `-i` | Process ID (template mode) | `process` |
| `--name` | `-n` | Process display name (template mode) | — |
| `--output` | `-o` | Output path (`-` for stdout) | `<process-id>.bpmn` |
| `--template` | | Template name | `minimal` |
| `--definition` | `-d` | CompactDiagram JSON string | — |
| `--help-schema` | | Print JSON schema reference and exit | — |
| `--input` | `-f` | Existing .bpmn file to modify | — |
| `--patch` | | Patch JSON `{elements:[...],flows:[...]}` to add to `--input` | — |
| `--dump-compact` | | Print compact JSON of `--input` for AI inspection | — |

**Modifying existing files** (`--input` mode):

```sh
# Step 1 — inspect existing file as compact JSON (AI reads this to learn element IDs)
casen generate bpmn --input order.bpmn --dump-compact

# Step 2 — add a new path to an existing gateway
casen generate bpmn --input order.bpmn \
  --patch '{"elements":[{"id":"notify","type":"serviceTask","name":"Notify","jobType":"notify-worker"},{"id":"end-notify","type":"endEvent","name":"Notified"}],"flows":[{"id":"fn1","from":"gw","to":"notify","condition":"= urgent"},{"id":"fn2","from":"notify","to":"end-notify"}]}'

# Or pipe the patch from AI
echo '{...}' | casen generate bpmn --input order.bpmn

# Re-apply auto-layout without changes (normalize positions)
casen generate bpmn --input messy.bpmn --output clean.bpmn
```

Patch mode targets the first process in the file. The patch JSON is `{elements:[...], flows:[...]}` where flows can reference existing element IDs already in the file.

**CompactDiagram JSON schema** (shown by `--help-schema`):

The `--definition` flag and stdin accept a `CompactDiagram` JSON object — the same compact format used internally by the AI improvement tools. It supports all 23 BPMN element types, all event definition types, boundary events, sub-processes, and Zeebe extensions (job type, task headers, form references, decision references).

---

### `casen view` — View BPMN, DMN, and Form files in the browser

Spawns a local HTTP server (default port 3044) and opens the system browser. All renderers work server-side — no dependencies required in the browser.

**Subcommands:**

| Command | Input | Rendering |
|---|---|---|
| `casen view open <paths>` | Any mix of .bpmn/.dmn/.form files or folders | Auto-detects by extension |
| `casen view bpmn <paths>` | .bpmn files or folders | SVG (via `exportSvg`) |
| `casen view dmn <paths>` | .dmn files or folders | ASCII table (monospace) |
| `casen view form <paths>` | .form files or folders | ASCII layout (monospace) |

**Folder support:** Pass a directory path — all matching files are scanned and each gets its own tab.

```sh
# View a single BPMN file
casen view bpmn process.bpmn

# View all .bpmn files in a folder
casen view bpmn ./processes/

# View multiple specific files with tabs
casen view bpmn order.bpmn payment.bpmn

# View a DMN decision table
casen view dmn eligibility.dmn

# View all DMN files in a folder
casen view dmn ./decisions/

# View a Camunda form
casen view form approval.form

# View any mix of types (auto-detect)
casen view open ./project/

# Mixed explicit files
casen view open order.bpmn routing.dmn review.form

# Dark theme, custom port, no auto-open
casen view bpmn process.bpmn --theme dark --port 8080 --no-open
```

**Flags (all subcommands):**

| Flag | Description | Default |
|---|---|---|
| `--port` | Local server port | `3044` |
| `--theme` | `light` or `dark` | `light` |
| `--no-open` | Do not open browser automatically | false |

Press `Ctrl+C` in the terminal to stop the server.

---

## Claude Code Plugin — `/plugin install bpmnkit` (2026-04-17)

A Claude Code plugin that makes Claude AI-first for BPMN workflows. Install once, works automatically.

**Prerequisite:** `npm install -g @bpmnkit/cli`

**Install:** `/plugin install bpmnkit` (or `claude --plugin-dir plugins-claude/bpmnkit-claude` locally)

### Skills (slash commands)

| Skill | What it does |
|---|---|
| `/bpmnkit:generate <description>` | Natural language → BPMN file + ASCII preview |
| `/bpmnkit:review [file]` | Static analysis: pattern checks, variable flow, findings by severity |
| `/bpmnkit:deploy [file] [--local\|--camunda]` | Deploy to local reebe or Camunda 8 |
| `/bpmnkit:worker <job-type>` | Scaffold TypeScript worker using `@bpmnkit/worker-client` |
| `/bpmnkit:test [file]` | Run scenario tests, show path coverage |
| `/bpmnkit:instances [id] [--active\|--failed]` | List running process instances |
| `/bpmnkit:incidents [--process-id X]` | List open incidents with suggested actions |
| `/bpmnkit:ascii <file>` | Render BPMN/DMN/Form as Unicode ASCII art |

### Agents

| Agent | What it does |
|---|---|
| `process-builder` | End-to-end: describe → generate → validate → scaffold workers → deploy |
| `incident-resolver` | Triage → root cause analysis → propose fix → execute → verify |

### Hooks

- **SessionStart** — checks `casen` is installed, auto-starts proxy in background
- **PostToolUse** — silently lints any `.bpmn` file written during the session

### MCP

Connects to the existing `aikit-mcp.js` server via `casen proxy mcp` (10 tools: `bpmn_create`, `bpmn_read`, `bpmn_update`, `bpmn_validate`, `bpmn_deploy`, `bpmn_simulate`, `bpmn_run_history`, `worker_list`, `worker_scaffold`, `pattern_list`, `pattern_get`).

---

## AIKit MCP — `form_create` Tool (2026-04-21)

Generates a Camunda Form JSON file for a user task in a BPMN process. Called by the `/design` skill and available directly via the AIKit MCP server.

## AIKit MCP — `dmn_create` Tool (2026-04-21)

Generates a DMN decision table XML file for a business rule task in a BPMN process. Called by the `/design` skill and available directly via the AIKit MCP server.

## CLI Skill — `/design` (2026-04-21)

Design-only workflow skill for Claude Code. Given a process description, generates the BPMN flow diagram, Camunda Form JSON for every user task, and DMN decision tables for every business rule task. Does not scaffold workers or prompt for deployment.

Install with `casen skills install`.

## CLI — Start Proxy & Reebe from the CLI (2026-04-03)

The `casen` CLI is now the single entry point for starting local infrastructure:

| Command | What it does |
|---|---|
| `casen proxy` | Start the AI bridge + Camunda API proxy server (port 3033) |
| `casen proxy start --port 4000` | Start on a custom port |
| `casen reebe` | Start the Reebe workflow engine with embedded SQLite (port 8080) |
| `casen reebe start --database-url postgres://…` | Start with PostgreSQL |
| `casen reebe start --port 9090` | Start on a custom port |

Both commands appear in the pinned section of the main TUI and stream server output directly to the terminal.

## Local Automation Workflows — Phase 4: Multi-Instance & Flow UX (2026-04-02)

Sub-processes can now be configured as multi-instance loops directly from the config panel, with visual feedback on the canvas and variable scope visibility in the variable-flow overlay.

**Multi-instance config panel** (select any sub-process):
- "Process each item in a list" action button — one click to configure parallel for-each with `item` as the element variable
- Loop type dropdown (Parallel / Sequential), Collection (FEEL), and Element variable fields appear after setup
- Fields are hidden when no loop is configured, keeping the panel clean

**Canvas markers** — multi-instance sub-processes show standard BPMN bottom markers:
- Parallel: three vertical lines `|||` to the right of the expand `+` marker
- Sequential: three horizontal lines `≡` to the right of the expand `+` marker

**Variable flow overlay** — the iteration variable (e.g. `email`) is now shown in scope tooltips for sequence flows inside multi-instance sub-processes. Inner elements that produce additional variables also appear in scope.

**BPMN model** — `BpmnMultiInstanceLoopCharacteristics` now carries `isSequential?: boolean`, parsed from and serialized to the native BPMN `isSequential` attribute. The builder's `MultiInstanceOptions.isSequential` field is now wired through.

## Local Automation Workflows — Phase 3: Connector UX (2026-04-02) — `packages/plugins`

Built-in workers are now a first-class part of the connector catalog with full form UI.

**Connector catalog panel** (Ctrl+K → "Browse connectors…"):
- "Built-in Workers" tab: card grid for all 8 bpmnkit workers — always visible, no proxy needed
- "Community APIs" tab: 30+ OpenAPI-backed connector entries with search
- Click "Use" on a worker card to register it; select any service task to apply via the Connector field
- Footer: Import from URL / Import from file actions

**Template form renderer** — all worker fields rendered correctly in the config panel:
- Text with `feel: "optional"` → FEEL expression field with toggle (prompts, paths, content)
- Dropdown → searchable select (model picker, events picker)
- Boolean → toggle (ignore exit code)
- Number → numeric text field (timeout)
- `{{secrets.NAME}}` syntax works in any String/Text field (documented in field descriptions)

**Static templates** in `packages/plugins/src/connector-catalog/builtin-templates.ts`:
- 8 templates always embedded in the plugin — no network call needed to discover workers

## Local Automation Workflows — Phase 2: Triggers (2026-04-02) — `apps/proxy`

Workflows now start automatically without a "Run" click.

**Webhook trigger** (`POST /webhooks/:processId`):
- Any HTTP client can start a process instance; request body becomes process variables
- Optional `WEBHOOK_TOKEN` env var for Bearer token protection

**Timer trigger** (scan + schedule):
- Parses `<timeDuration>`, `<timeDate>`, `<timeCycle>` from deployed BPMN timer start events
- ISO 8601 duration/date/repeating-interval support (`PT1H`, `R/PT30M`, `2026-01-01T00:00:00Z`)
- Persists last-fired timestamps to `~/.bpmnkit/timer-state.json`

**File-watcher trigger** (`io.bpmnkit:trigger:file-watch:1`):
- Service tasks with `watchPath` header trigger a process instance on file add/change
- `glob` header for filename filtering; `events` header for add/change/all
- Injects `{ filePath, fileName, fileContent, relativePath, eventType }` as process variables

**Connector catalog integration**:
- Built-in worker templates auto-loaded from proxy on Studio startup and shown in the connector catalog

Set `BPMNKIT_TRIGGERS=false` to disable all triggers.

## Local Automation Workflows — Phase 1 (2026-04-02) — `apps/proxy`

bpmnkit now executes BPMN service tasks locally. Deploy a diagram to a running reebe instance and the
proxy's built-in worker daemon picks up jobs automatically.

**Built-in workers** (all configurable via element templates, no code required):

| Job type | Purpose |
|---|---|
| `io.bpmnkit:cli:1` | Run any shell command; `{{var}}` interpolation; outputs stdout/stderr/exitCode |
| `io.bpmnkit:llm:1` | Call Claude/Copilot/Gemini with a prompt; auto-detects available adapter |
| `io.bpmnkit:fs:read:1` | Read a file into a process variable |
| `io.bpmnkit:fs:write:1` | Write a process variable to a file |
| `io.bpmnkit:fs:append:1` | Append to a file |
| `io.bpmnkit:fs:list:1` | List a directory into an array variable |
| `io.bpmnkit:js:1` | Evaluate a JS expression with process variables in scope |

- `GET /worker-templates` — serves element template JSON for all built-in workers
- `GET /status` — now includes `workers` object with active state, job types, poll count
- Set `BPMNKIT_WORKERS=false` to disable the daemon

## Connector Secrets (2026-04-02) — `packages/engine`, `apps/proxy`, `apps/studio`

Use `{{secrets.NAME}}` in REST connector fields (URL, auth token, headers) to keep credentials out of BPMN diagrams — matching Camunda's native secrets syntax.

- **`SecretResolver` interface** (`@bpmnkit/engine`) — pluggable resolution strategy; `EnvSecretResolver` for standalone/Node.js
- **Proxy endpoint** (`POST /secrets/:name`) — proxy encrypts env var values with a client-supplied AES-256-GCM key before sending; the key is ephemeral (generated fresh on each Studio boot) and never stored
- **Session key store** (`useSecretsStore`) — generates key on boot, caches resolved secrets for the session, exposes `proxySecretResolver` for use in job workers
- **WASM adapter** — resolves secrets in URL, headers, and auth token before making HTTP calls
- **TS engine** — resolves secrets in IO mapping inputs and task headers at job execution time
- **Settings panel** — scans all BPMN models for `{{secrets.*}}` references and shows which are configured vs missing in the proxy environment

## File System Persistence & Project Management (2026-04-01) — `apps/proxy`, `apps/studio`, `packages/plugins`

Studio models can now be stored as real files on disk instead of (or alongside) browser IndexedDB.

- **Two storage modes**: _Local (IndexedDB)_ — the always-available default; _Project_ — a folder on the machine running the proxy, selectable in Settings.
- **Proxy FS API** (`/fs/*`): 10 new endpoints for tree listing, file read/write/delete/move, folder creation, and sidecar metadata; only `.bpmn`, `.dmn`, `.form`, `.md` files are served.
- **Sidecar metadata** (`.bpmnkit/<file>.meta.json`): stores stable UUID, deployment links, test scenarios, and run-variable defaults alongside the source file so everything is checkable into git.
- **Project registry**: configured projects stored in browser IndexedDB; the active project is remembered across reloads via `localStorage`.
- **Folder tree UI**: when a project is selected, the Models page shows a collapsible folder tree sidebar and shows only the files in the selected folder.
- **Move to... dialog**: move files between folders within the same project.
- **Markdown files** (`.md`): standalone notes in the project; opened with a plain textarea editor that auto-saves.
- **Test scenario persistence**: process-runner now supports `onSaveScenarios`/`onLoadScenarios` callbacks; in FS mode, scenarios are written into the sidecar file next to the BPMN.

Full specification: [`doc/projects-files.md`](projects-files.md)

## Process Input Validation (2026-03-29) — `packages/core`, `packages/plugins`, `apps/studio`

Validates process input variables at the start event using a companion Collect-hit-policy DMN table.

- **`buildValidationDmn(startEventId, variables)`** (`@bpmnkit/core`): generates a DMN decision table from `InputVariableDef[]` — one input column per variable, one rule per violation (required, type, min/max, minLength/maxLength, regex pattern).
- **`insertValidationStructure` / `removeValidationStructure`** (`@bpmnkit/core`): splice a Business Rule Task + XOR gateway + error end event after the start event; the happy-path flow requires `count(validationErrors) = 0`; `VALIDATION_FAILED` BPMN error thrown on violation. Fully reversible.
- **Start Event config panel "Input Validation" group** (`@bpmnkit/plugins/config-panel-bpmn`): Add/Edit/Remove actions with a modal variable editor (name, type, required, numeric/string constraints).
- **Process runner variable hints** (`@bpmnkit/plugins/process-runner`): reads input column names from the companion DMN and displays them as hint chips above the Play panel variable input.
- **Studio companion deploy** (`apps/studio`): all deploy paths auto-detect `zeebe:calledDecision` references in the BPMN XML and bundle matching DMN models as multipart companions; creating a validation DMN auto-saves it as a new studio model; Edit navigates to it.

## AI-Assisted BPMN Improvement (2026-03-28) — `apps/proxy`, `packages/core`, `packages/plugins`, `apps/cli`

Token-efficient pipeline for AI-powered BPMN analysis and improvement.

- **`POST /improve` proxy endpoint**: 4-phase pipeline — auto-fix (zero AI tokens), residual analysis, AI explanation + `BpmnOperation[]` output (~5× fewer tokens than full XML regeneration), apply ops and emit final XML via SSE.
- **`BpmnOperation` + `applyOperations()`** (`packages/core`): discriminated union (7 op types) + pure functional apply step; exported from `@bpmnkit/core`.
- **Sub-process support in compact format** (`packages/core/bpmn/compact.ts`): `CompactElement.children` for nested processes; `compactify()` recurses, `expand()` reconstructs.
- **Canvas highlight API** (`packages/canvas`): `highlight(ids, variant)` marks elements amber (`"changed"`) or green (`"new"`); `clearHighlights()` removes all marks.
- **AI panel improve flow** (`packages/plugins/ai-bridge`): "✦ Improve" streams explanation, shows auto-fix count + op diff list, renders canvas preview with highlights, "Apply to diagram" button.
- **CLI `bpmn improve <file> [--auto]`** (`apps/cli`): streams AI explanation + shows diff; `--auto` writes result back to file; `--server` for custom proxy URL.
- **CLI `bpmn lint --fix`** (`apps/cli`): applies all auto-fixable static analysis findings and writes the BPMN file in place.

## Studio Process Runner + Scenario Testing (2026-03-28) — `apps/studio`, `packages/plugins`

Play mode and scenario-based BPMN testing are wired into the Studio model editor.

- **Play button in HUD**: click to enter in-browser simulation — runs the current diagram against the TypeScript engine (`@bpmnkit/engine`) with real-time token highlights.
- **Play panel sub-tabs**: Variables, FEEL, Errors, Input (configurable start variables).
- **Tests as first-class dock tab**: dedicated "Tests" tab in the side dock, always accessible without entering play mode.
- **Scenario runner**: each scenario runs against a fresh `@bpmnkit/reebe-wasm` WASM engine instance for authoritative, isolated results.
- **Visual scenario editor**: click ✎ on any scenario to open a point-and-click editor:
  - **Start Variables**: key=value editor for process inputs.
  - **Task Outputs**: auto-populated task cards from the diagram; click a card (or click the element on the canvas) to configure output variables and optional error injection per task.
  - **Expected Variables**: key=value assertions checked after the run.
  - **Inline failure diff**: last run failures shown directly in the editor.
- **Scenario-based testing**: define named test scenarios with input variables, per-task mock outputs/errors, and assertions (expected path + expected variables). Results show pass/fail with per-field diffs. Scenarios persist in IndexedDB scoped to the model.
- **Run all / run one**: run all scenarios at once or individually, with live pass/fail status per scenario.
- **Chaos import**: after a chaos run, import triggered injections as draft test scenarios.
- **AI generate** (when configured): generate draft scenarios from the current BPMN via AI.

## BPMNkit Studio (2026-03-24) — `apps/studio` + `packages/user-tasks`

A unified Preact web application replacing fragmented Camunda tooling (Modeler, Operate, Tasklist).

- **Shell**: 3-column layout (Sidebar / main content / AI Drawer), theme switching (light/dark/neon), developer/operator mode toggle that reorders sidebar navigation.
- **Cluster connection**: proxy-based (localhost:3033), profile selection via `ClusterPicker` dropdown, `x-profile` header on all requests.
- **Dashboard**: `StatusHeader` (profile, status dot, tags, last-updated ticker, refresh button), `IncidentBanner` (dismissible full-width alert), `OfflinePanel` (proxy-down replacement), `GettingStarted` strip (3-step onboarding for empty clusters), stat cards with pinging live-alert dot, improved empty states with CTAs, sparkline time-series, auto-refresh every 15s.
- **Models**: local BPMN/DMN/Form files stored in IndexedDB. Grid and list views, `DiagramPreview` via offscreen BpmnCanvas + IntersectionObserver, create/import/delete with confirmation dialogs.
- **Model Editor**: full-height `BpmnEditor`, 2-second debounced auto-save, ⌘S immediate save, deployed-versions sidebar panel.
- **Definitions**: searchable/filterable table of deployed process definitions; detail page with BpmnCanvas + token-highlight + metadata sidebar.
- **Instances**: filterable table with state pills, bulk cancel, detail page with BpmnCanvas overlay, variable tree (recursive), incidents tab.
- **Incidents**: filterable table, detail page with BpmnCanvas highlighting the failing element in red via `tokenPlugin.api.setError()`.
- **User Tasks**: filterable table with overdue highlighting, detail page with form rendering via `@bpmnkit/plugins/form-viewer`, claim/unclaim/complete actions.
- **Decisions**: browsable DMN decision table list and detail view.
- **AI Drawer**: context-aware chat — in editor view mounts the full `createAiPanel` (BPMN context, XML preview, Apply button, companion file creation); in all other views uses text chat via `/operate/chat`. Accepts initial messages transferred from the command palette.
- **Command Palette AI Chat**: typing a query + selecting "Ask AI" transforms the palette into an inline chat modal (no context switch). Chat is context-aware: uses `/chat` with BPMN context on model pages, `/operate/chat` elsewhere. Returns XML → "Diagram ready" + Apply button. "Sidebar" button moves the conversation to the AI Drawer.
- **Incident AI**: IncidentDetail sidebar has a third "AI" tab that calls `/operate/incident-assist` for structured root-cause / remediation analysis (matching Operate's implementation).
- **Command Palette**: ⌘K dialog with arrow-key navigation, fuzzy word-prefix matching, match highlighting, styled `<kbd>` shortcuts, footer hint bar.
- **Zen / Presentation Mode**: ⌘K → "Start Presentation Mode" hides all Studio chrome (TopBar, Sidebar, AI Drawer, save bar, editor HUD toolbars) for a distraction-free BPMN view.
- **`@bpmnkit/user-tasks`**: standalone vanilla TS widget (`createUserTaskWidget`) for embedding task completion forms in any host page.

## Hot Reload Live Mode (2026-03-22) — `packages/plugins/live-mode`

- **`createLiveModePlugin(options)`**: Canvas plugin that keeps a running Zeebe process instance in sync with the diagram as you edit.
  - Toolbar toggle button and status pill (OFF / CONNECTING / LIVE / ERROR / BLOCKED / TESTS FAIL).
  - Auto-deploys via the proxy on every diagram change (debounced 500ms).
  - Maintains dev instance across reloads via IndexedDB persistence.
  - Auto-migrates the running instance to each new version; shows conflict banner with "Start fresh" on migration failure.
  - Polls active element instances and drives token-highlight canvas overlay.
  - Variable inspector: hover an active element → tooltip showing live variable values.
  - Sandbox guard: blocked when the active profile is tagged as production.
  - Optional test-green gate: require `runTests()` to pass before each deploy.

## Story Mode (2026-03-22) — `packages/core/bpmn/story.ts`, `packages/plugins/story-view`

- **`renderStoryHtml(defs, options?)`** (`@bpmnkit/core`): Pure HTML string renderer (no DOM). Topologically sorts flow elements (Kahn's algorithm, cycle-safe), groups by swim lane, renders typed cards with role-colored left borders. Gateway cards show outgoing conditions. `standalone: true` produces a complete self-contained HTML document.
- **`createStoryViewPlugin(options?)`**: Canvas plugin with `📖 Story` toggle. Renders story HTML from current definitions and mounts it in the editor container. Comment threads per element stored in IndexedDB. AI condition summarizer hook for plain-English FEEL translations.

## CLI lint & story commands (2026-03-22) — `apps/cli`

- **`casen lint <file.bpmn>`**: Runs all static analysis (`optimize()`) on a BPMN file, prints findings with symbols, exits 1 on errors. Supports `--categories` filter and `--format json`.
- **`casen story <file.bpmn>`**: Renders a BPMN process as a standalone story-mode HTML file. Supports `--output` and `--theme dark|light`.

## Variable Flow Analysis (2026-03-22) — `packages/core/optimize`, `packages/plugins/variable-flow`

- **`analyzeVariableFlow(process)`**: Static analysis engine that scans IO mapping inputs/outputs and sequence flow FEEL conditions to build a producer/consumer graph, then emits:
  - `data-flow/undefined-variable` (warning) — variable consumed but never produced anywhere in the process; includes Levenshtein ≤ 2 typo suggestions.
  - `data-flow/dead-output` (info) — variable produced but never consumed downstream.
  - `data-flow/role` (info) — per-element metadata listing which variables it reads and writes (used by the canvas overlay).
- **`extractFeelIdentifiers(expr)`**: Parses a FEEL expression string, walks the AST, and returns all variable name references (excluding ~95 built-in function names).
- **`createVariableFlowPlugin()`**: Canvas overlay plugin — colors elements green (writes), blue (reads), teal (reads & writes). Hovering any colored element shows a tooltip table listing each variable and whether it's read or written. Includes a legend.

## Time-Travel Simulation Debugger (2026-03-22) — `packages/plugins/process-runner`

- **Event log recording**: Every engine event is pushed to an in-memory log (capped at 10,000) during simulation runs.
- **Timeline scrubber**: Range input above the tab bar. Dragging left enters time-travel mode; the Variables/FEEL/Errors tabs instantly update to show state at the selected event index.
- **State projection**: `computeStateAt(idx)` replays the event log up to index idx and returns projected variable state, FEEL evals, and errors — O(n) pass, no re-execution.
- **Live / Replay**: "Live" button returns to the tail of the log. "Replay from here" snapshots variable state at the scrub point and starts a fresh engine run with those variables as inputs.

## Scenario-Based Testing (2026-03-22) — `packages/engine`, `packages/plugins/process-runner`, `apps/cli`

- **`runScenario(engine, defs, scenario)`** (`@bpmnkit/engine`): Runs a single test scenario against a BPMN definition with mock job workers. Supports path assertions (expected element visit order) and variable assertions (expected final state). Returns a typed `ScenarioResult` with `passed`, `failures`, `visitedElements`, `finalVariables`, `errors`, `durationMs`.
- **`.bpmn.tests.json` sidecar format**: Scenarios as a JSON array of `ProcessScenario` objects — each has `id`, `name`, `inputs`, `mocks` (keyed by task type), and `expect.path`/`expect.variables`.
- **Tests tab** in process runner panel: Create/delete scenarios, run all or individually, see pass/fail per scenario, and expand failure diffs showing field/expected/actual.
- **`casen test <file.bpmn>`**: CLI command that reads a BPMN file and its `.bpmn.tests.json` sidecar, runs all scenarios, prints PASS/FAIL with diffs, and exits 1 if any scenario fails.

## Pattern Advisor Plugin (2026-03-22) — `packages/plugins/pattern-advisor`

- **`createPatternAdvisorPlugin`**: Canvas plugin that continuously analyzes the loaded process against 15 production-failure patterns and surfaces findings in a persistent side panel.
- **15 pattern rules** across two new severity levels: error (blocks deploy), warning (advisory), info (hygiene). Rules cover missing error boundaries on HTTP tasks, sub-processes, call activities; exclusive gateway without default flow; parallel variable conflicts; user tasks without SLA timers; catch-and-swallow error handlers; literal-only FEEL conditions; duplicate job types; empty annotations; and more.
- **Reactive analysis**: Re-runs on every diagram change — no manual trigger needed.
- **Canvas badges**: Affected elements get a colored ring (red/amber/blue) indicating the worst finding severity.
- **Per-finding actions**: [Apply Fix] for auto-fixable patterns; [Dismiss] to suppress a finding without fixing it.
- **Deploy guard integration**: Error-severity pattern findings (e.g. HTTP task without error boundary) automatically block the deploy plugin — same as the existing optimizer guard.

## Chaos Simulation Mode (2026-03-22) — `packages/plugins/process-runner`

- **Chaos toggle** in the process runner toolbar (visible when idle): enables random failure injection for the next simulation run.
- **20% default probability**: Each eligible task (service, send, business-rule, script) is independently rolled at 20% chance of receiving an injection.
- **Three injection types**: `service-failure` (task throws an error — reveals missing error boundaries), `null-response` (task completes but returns nothing — reveals missing null guards downstream), `random-delay` (500–2500ms artificial delay — reveals timer boundary gaps).
- **Errors tab summary**: The chaos schedule is printed to the Errors tab before execution begins, showing which elements were targeted and with which injection type.

## Deploy Plugin (2026-03-20) — `packages/plugins/deploy`

- **`createDeployPlugin`**: Editor sidebar plugin (new "Deploy" tab in SideDock) for deploying processes and starting instances without leaving the editor.
- **Proxy-first**: All Camunda API calls are routed through the proxy server (`casen proxy start`) to avoid CORS issues. Shows an offline hint with the start command when the proxy is not running.
- **Profile selector**: Loads available CLI profiles from `/profiles` and passes the selected profile via `x-profile` header on all requests — same mechanism as `@bpmnkit/operate`.
- **Cluster health check**: Calls `GET /api/v2/topology` before allowing deploy; shows broker count and gateway version, or blocks with an error if the cluster is unreachable.
- **Optimizer guard**: Runs `optimize(defs)` before every deploy attempt. Errors block the Deploy button; warnings are shown but non-blocking.
- **One-click deploy**: `POST /api/v2/deployments` with the current BPMN XML as multipart/form-data, using the editor filename as the resource name.
- **Start Instance**: Shown automatically when the current process definition is already deployed (checked via `POST /api/v2/process-definitions/search`). Accepts optional JSON variables and opens the started instance in the operate app via a `#/instances/{key}` deep link.

## Connector Catalog Plugin (2026-03-18) — `packages/plugins/connector-catalog`

- **`createConnectorCatalogPlugin`**: Canvas plugin that wires `@bpmnkit/connector-gen` into the editor via the command palette. Press Ctrl+K / ⌘K, search for an API name (GitHub, Stripe, Slack, Anthropic, …), and the spec is fetched, templates generated, and registered in the connector selector — all in the current session.
- **30+ catalog entries**: All built-in `connector-gen` catalog entries (GitHub, Stripe, Jira, Slack, Notion, OpenAI, Discord, PagerDuty, etc.) appear as individual commands.
- **Custom URL import**: "Import from OpenAPI URL…" command accepts any OpenAPI 3.x spec URL for private or custom APIs.
- **Zero UI friction**: No dialog, no file picker. Commands appear in the existing command palette; a toast confirms success or surfaces errors.

## Mobile Editor Usability (2026-03-17) — `packages/editor`, `packages/plugins`, `apps/desktop`

- **Fix zoom stuck after pinch-to-zoom**: `pointercancel` now resets the state machine, unlocking the viewport when a system gesture interrupts an editor drag.
- **Sidebar auto-collapse**: On viewports ≤600px the side dock starts collapsed so it doesn't overlay the screen.
- **Simplified mobile HUD**: Top-center toolbar and bottom-left toolbar are hidden on mobile. Bottom-center toolbar repositions to the bottom-left corner with its existing collapse toggle.
- **Mobile "Edit" menu**: On mobile viewports, the main menu gains an "Edit" submenu with Undo, Redo, Delete, Duplicate, Select All, and Auto-layout actions.
- **Unified file tab on mobile**: The per-type grouped tab bar is replaced by a single tab showing the active file. A unified dropdown lists all open files across all types (with type badges) when multiple files are open.

## OpenAPI → Camunda Connector Generator (2026-03-14) — `packages/connector-gen`, `apps/cli`

- **`@bpmnkit/connector-gen`**: Zero-dep (+ `yaml`) library that converts OpenAPI 3.x specs to Camunda REST connector element templates.
- **Strategy A**: one `.json` template per API operation; job type `io.camunda:http-json:1`.
- **URL handling**: Hidden field for plain paths; FEEL expression (`="https://base/" + param + "/rest"`) for paths with `{param}` variables.
- **Auth**: 5-type auth block (noAuth, API key, Basic, Bearer, OAuth2 Client Credentials) with conditions; auto-detected from `securitySchemes` or overrideable via `--auth`.
- **Body expansion**: `--expand-body` decomposes top-level request body properties into individual typed fields (String / Number / Boolean).
- **Catalog**: 30 built-in API entries across payments, messaging, CRM, monitoring, AI, and more — `casen connector generate --api <id>`; `casen connector catalog` lists all entries.
- **Output**: one file per operation (default) or all in one array file (`--format array`); `--dry-run` prints to stdout.
- **CLI commands**: `casen connector generate` + `casen connector catalog`.

## Interactive Learning Center (2026-03-13) — `apps/learn`, `packages/astro-shared`

- **`apps/learn`**: Astro v6 app (port 4322) with interactive BPMN tutorials. Tutorial catalog, per-tutorial overview, and step-by-step pages with live BpmnEditor embedded in a split-pane layout.
- **`packages/astro-shared`**: Shared CSS package (`@bpmnkit/astro-shared`) providing `tokens.css` (oklch design tokens), `background.css` (aurora orbs + dot grid + grain), and `site.ts` (SITE metadata).
- **Tutorial 1 — "Getting started"**: 5-step no-install tutorial: run a process, add a task, connect it with a sequence flow, name it, then run again. Uses `BpmnEditor` + `Engine` + `ProcessRunnerPlugin`.
- **Progress tracking**: localStorage-based progress (`bpmn_learn_progress`), including saved BPMN XML carried across steps, step completion state, and continue-from-last-step support.
- **Hint system**: Progressive hint reveal with tiered styling; up to N hints per step.
- **Validation**: `manual`, `bpmn-element-count`, `bpmn-has-connection`, `bpmn-element-labeled` validators; success/error banners; completion overlay with CSS confetti.

## Auto-layout (2026-03-11) — `packages/core`, `packages/editor`

- **`Bpmn.autoLayout(xml)`**: applies auto-layout to all processes in a BPMN XML string and returns updated XML with replaced BPMNDi positions.
- **`applyAutoLayout(defs)`**: exported from `@bpmnkit/core` — operates on `BpmnDefinitions` directly; handles plain processes and collaborations with pools/lanes; pool and lane shapes carry `isHorizontal: true`.
- **`BpmnEditor.autoLayout()`**: undoable auto-layout command in the editor; triggers `fitView` after layout.
- **Auto-layout button**: HUD action bar now has an auto-layout button (grid icon) between `btnTopMore` and optional inject buttons.
- **`BpmnDiShape.isHorizontal`**: new optional field parsed and serialized round-trip by parser/serializer.
- **[2026-06-30] Layout constants match canonical Camunda BPMN skill spec**: subprocess padding 50px, horizontal spacing 150px center-to-center.
- **[2026-06-30] Boundary event center-bottom placement**: single event at task center-bottom; multiple events symmetrically distributed.
- **[2026-06-30] adHocSubProcess tool grid layout**: agent tools tile into rows of up to 4 columns.
- **[2026-06-30] Lane proportional height**: pool lanes sized relative to content, not equal tiles.
- **[2026-07-03] Grid-based layout engine**: the Sugiyama layered layout + block-tree pipeline was replaced by a grid engine (`packages/core/src/layout/grid/`) — flow nodes placed on a fixed 150×140 grid, edges routed with an orthogonal Manhattan router. Public API unchanged.
- **[2026-07-03] Message-flow routing**: `applyAutoLayout` emits DI for collaboration `messageFlow` elements, docking on the nearest edge between source/target shapes.
- **[2026-07-03] DI completeness checker**: `checkDiCompleteness(defs)` reports any element, sequence flow, annotation, association, participant, or message flow missing DI.
- **[2026-07-03] Annotation packing**: `packAnnotations` packs text annotations above/below the content bounding box with overlap/crossing avoidance.

## ASCII rendering for DMN and Forms (2026-03-11) — `packages/ascii`

- **`renderDmnAscii(xml, options?)`**: renders DMN decision tables as double-line box-drawing ASCII grids. Column widths auto-fit to content; hit policy in header; multiple decisions separated by blank lines.
- **`renderFormAscii(json, options?)`**: renders Camunda Form JSON as text-mode mock-up. Supports all component types: inputs, selects, radios, checkboxes, buttons, groups, dynamic lists, tables, and display components.
- **`RenderOptions.title`**: control whether a title header is prepended (`false` to suppress, string to override, default uses file/definition name).

## Shared design system (2026-03-11) — `packages/ui`

- **`@bpmnkit/ui`**: Shared design tokens, theme management, and primitive UI components for all bpmn-sdk frontends.
- **Design tokens**: `--bpmnkit-bg`, `--bpmnkit-surface`, `--bpmnkit-surface-2`, `--bpmnkit-border`, `--bpmnkit-fg`, `--bpmnkit-fg-muted`, `--bpmnkit-accent` (blue), `--bpmnkit-success/warn/danger`, `--bpmnkit-radius`, `--bpmnkit-nav-bg/fg`. Light default, dark via `[data-theme="dark"]`.
- **Theme management**: `resolveTheme` (auto→light|dark), `persistTheme`/`loadPersistedTheme` (localStorage), `applyTheme` (sets `data-theme` on element).
- **Theme switcher component**: `createThemeSwitcher({ initial, onChange, persist })` — button+dropdown with Dark/Light/System options, icon updates to reflect selection.
- **Shared components**: `badge(state)`, `cell(text)`, `createStatsCard(label, value, mod)`, `createTable<T>(options)` — generic, use `--bpmnkit-*` tokens.
- **Icon library**: `IC_UI` — SVG icons for theme (moon/sun/auto/check) and navigation (dashboard/processes/instances/incidents/jobs/tasks).



## Monitoring & Operations frontend (2026-03-10) — `packages/operate`

- **`@bpmnkit/operate`**: Zero-dependency monitoring frontend. `createOperate({ container, mock?, proxyUrl?, profile?, theme? })` mounts full monitoring UI.
- **Dashboard**: Stats cards for active instances, open incidents, active jobs, pending tasks, deployed processes. Clickable cards navigate to respective views.
- **Processes view**: Table of deployed process definitions with name, ID, version, tag, tenant.
- **Instances view**: Paginated table with state filter bar (All / Active / Completed / Terminated). Incident warning indicator per row.
- **Instance detail**: BPMN canvas rendering with token-highlight (active = amber glow, visited = green tint, edge animations). Sidebar tabs: Variables, Incidents.
- **Incidents view**: Table with error type, message, process, instance, state, age.
- **Jobs view**: Table with type, worker, retries, state, error message.
- **User Tasks view**: Table with name, assignee, process, state, due date, priority.
- **Profile picker**: Header dropdown populated from `GET /profiles`; switching reconnects all SSE streams.
- **Mock/demo mode**: Self-contained fixture data, no proxy needed. Used at `/operate` on landing page.
- **SSE architecture**: proxy polls Camunda server-side, pushes events to frontend — clean frontend, no polling timers client-side.



## Landing page DMN/Form examples and live playground (2026-03-10) — `apps/landing`

- **DMN & Forms section**: New landing page section with 3-tab showcase — DMN decision table builder, Camunda Form scaffold, and a full BPMN process referencing both (userTask → formId, businessRuleTask → decisionId).
- **Live playground**: New interactive section where visitors write `Bpmn` / `Dmn` / `Form` builder code in a textarea and see the rendered BPMN diagram update instantly. `Ctrl+Enter` to run. Tab key inserts spaces. 4 example presets (linear flow, approval flow, DMN+Form, parallel gateway). Renders via `BpmnCanvas`.
- **AI companion file offer**: After applying an AI-generated BPMN with `businessRuleTask` or `userTask` references, the chat offers to scaffold the referenced DMN / Form files and open them as new tabs.

## DMN/Form layout, compact format, and MCP multi-type support (2026-03-10) — `packages/core`, `apps/ai-server`

- **DMN fluent builder**: `Dmn.createDecisionTable(id)` → `.name()` → `.input({ label, expression, typeRef })` → `.output({ label, name, typeRef })` → `.rule({ inputs, outputs })` → `.hitPolicy()` → `.build()`. Produces a `DmnDefinitions` object serializable via `Dmn.export(defs)`.
- **DMN auto-layout**: `layoutDmn(defs)` assigns DMNDI positions to all DRG elements using a left-to-right layered layout based on the requirement DAG. Sizes: decision=180×80, inputData=125×45, knowledgeSource=100×63, BKM=160×80. Exposed as `Dmn.layout()`.
- **DMN parse/export**: `Dmn.parse(xml)` → `DmnDefinitions`; `Dmn.export(defs)` → XML string. `Dmn.makeEmpty()` creates a minimal DmnDefinitions with one empty decision table.
- **DMN benchmark**: `benchmarkDmnLayout(xml, fileName)` compares auto-layout vs reference DMNDI. Exported from `@bpmnkit/core`.
- **DMN compact format**: `compactifyDmn(defs) → CompactDmn` / `expandDmn(compact) → DmnDefinitions` — token-efficient AI format. Exposed as `Dmn.compactify()` / `Dmn.expand()`.
- **Form scaffold**: `Form.makeEmpty(id?)` creates a minimal `FormDefinition` (schemaVersion 16, submit button). Extend `components` array with typed field objects.
- **Form compact format**: `compactifyForm(def) → CompactForm` / `expandForm(compact) → FormDefinition`. Exposed as `Form.compactify()` / `Form.expand()`.
- **Form parse/export**: `Form.parse(json)` → `FormDefinition`; `Form.export(def)` → JSON string.
- **BPMN cross-references**: `Bpmn.createProcess()` builder supports `userTask(id, { formId })` (links Camunda Form via zeebe:formDefinition) and `businessRuleTask(id, { decisionId, resultVariable })` (links DMN via zeebe:calledDecision).
- **MCP server multi-type**: `mcp-server.ts` now detects file type from content (BPMN/DMN/Form), exposes type-appropriate tool sets, and saves in the correct format. `compose_diagram` Bridge API works for all three types.
- **Bench script extended**: `scripts/bench-layout.mjs` processes `.bpmn`, `.dmn`, and `.form` files with type-specific reporting and summary.

## Auto-layout benchmark + compactness improvements (2026-03-10) — `packages/core`

- **`benchmarkLayout` API**: full pipeline to compare auto-generated positions against reference BPMN DI data — `benchmarkLayout`, `parseReferenceLayout`, `generateAutoLayout`, `compareLayouts`, `formatBenchmarkResult` exported from `@bpmnkit/core`.
- **Tighter spacing**: `GRID_CELL_WIDTH` reduced 200→130 (width ratio 1.51→1.0 vs bpmn.io reference), `GRID_CELL_HEIGHT` reduced 160→140 (140px parallel branch spacing matches bpmn.io).
- **Gateway labels below**: gateway labels now render centered below the diamond (standard BPMN convention).
- **`scripts/bench-layout.mjs`**: CLI benchmark script over any folder of `.bpmn` files; reports avg/p90/max distance, width/height ratio, order violations per file.
- **Reference BPMN samples**: `bpmn-samples/order-process.bpmn`, `bpmn-samples/parallel-approval.bpmn`.

## Layout + optimizer improvements (2026-03-09) — `packages/core`

- **Back-edge loop alignment**: `alignBranchBaselines` and `findBaselinePath` now correctly handle nodes with multiple successors caused by back-edge reversal, keeping sequential tasks on the main path aligned to the same center-y baseline.
- **`flow/multi-incoming-task` rule**: new optimizer rule detects non-gateway elements with more than 1 incoming flow and auto-fixes by inserting an exclusive gateway join.

## AI-assisted diagram design UX (2026-03-08) — `packages/editor`, `apps/landing`

- **New-diagram onboarding**: freshly-created diagrams show a full-coverage overlay instead of the canvas; three action cards let users choose "Start from scratch", "Generate example diagram", or "Ask AI"
- **Element-level Ask AI**: sparkle button in the contextual toolbar below any selected BPMN element; opens the AI chat panel with the element already in context
- `initEditorHud` returns `{ setActive, showOnboarding, hideOnboarding }` for lifecycle integration
- `HudOptions`: `onStartFromScratch`, `onGenerateExample`, `onAskAi` callbacks

## Camunda Admin API (SaaS) SDK + CLI (2026-03-06) — `packages/api`, `apps/cli`

Full support for the Camunda Console Admin API alongside the existing C8 REST API.

- **`AdminApiClient`** — generated from the SaaS Console swagger (`console.cloud.camunda.io`), same runtime as `CamundaClient` (OAuth2, retry, cache, typed events). Exported from `@bpmnkit/api`.
- **Admin API resources**: `MetaResource`, `MembersResource`, `ClustersResource`, `ActivityResource` — typed methods for every Admin API endpoint.
- **CLI command groups**: `casen meta`, `casen members`, `casen clusters`, `casen activity` — full list/get/create/delete/update support mirroring the C8 command structure.
- **Per-profile `apiType`**: each saved profile is tagged as `"c8"` (default) or `"admin"`. The CLI routes `getClient()` vs `getAdminClient()` accordingly.
- **`profile create --api-type admin`**: explicitly set the API type when creating a profile.
- **Auto-detect on `profile import`**: credentials files containing `CAMUNDA_CONSOLE_CLIENT_ID` or `CAMUNDA_CONSOLE_BASE_URL` are automatically classified as Admin API profiles; all others remain C8.
- **Admin env vars**: `CAMUNDA_CONSOLE_CLIENT_ID`, `CAMUNDA_CONSOLE_CLIENT_SECRET`, `CAMUNDA_OAUTH_URL`, `CAMUNDA_CONSOLE_BASE_URL`, `CAMUNDA_CONSOLE_OAUTH_AUDIENCE`.
- **Code generation**: `pnpm run generate:admin` in `packages/api`; tag derivation from URL path segments handles the tagless Admin API swagger.

## Process Runner Canvas Plugin (2026-03-03) — `canvas-plugins/process-runner`

Interactive BPMN execution toolbar embedded directly on the canvas.

- **Auto-play** — runs the entire process instance immediately with no configuration.
- **Play with JSON payload** — modal dialog lets you supply initial variables as a JSON object before executing.
- **Step-by-step** — starts in step mode; execution pauses after each element's I/O mapping. Click "→ Next" to advance one step at a time.
- **Stop** — cancels the running instance at any point.
- **Token-highlight integration** — pass `tokenHighlight: createTokenHighlightPlugin()` to see active/visited nodes and edges update in real-time.
- **Auto-deploy** — subscribes to `diagram:load`; automatically deploys the loaded diagram into the engine so the toolbar is always ready.
- **Structural typing** — depends only on `@bpmnkit/canvas`; engine and token-highlight are accepted via structural interfaces, no hard runtime coupling.

## Token Highlight Canvas Plugin (2026-03-03) — `canvas-plugins/token-highlight`

Visualizes live process execution state on the BPMN canvas when paired with `@bpmnkit/engine`.

- **Active elements** — amber glow pulse; marks nodes where a token is currently present.
- **Visited elements** — green tint; marks nodes the token has already left.
- **Active/visited edges** — colored and animated sequence flows; only highlights edges whose source has been visited, so untaken gateway branches stay neutral.
- **`trackInstance(instance)`** — one call auto-wires to any `ProcessInstance` via structural typing (no engine dependency required).
- **Manual API** — `setActive()`, `addVisited()`, `clear()` for custom control.

## BPMN Simulation Engine (2026-03-03) — `packages/engine` (`@bpmnkit/engine`)

Lightweight, zero-external-dependency BPMN simulation engine for browser and Node.js.

- **`Engine`** — Deploy BPMN/DMN/Form definitions; start process instances with optional input variables; register job workers by type.
- **`ProcessInstance`** — Token-based execution; `onChange(callback)` → real-time `ProcessEvent` stream; `cancel()`; `activeElements` / `state` / `variables_snapshot`.
- **Job workers** — Register handlers for service/user tasks. Auto-completes in simulation mode when no handler is registered.
- **Gateways** — Exclusive (condition eval), Parallel (split+join), Inclusive (all matching flows).
- **Timers** — ISO 8601 durations/dates/cycles via `setTimeout`.
- **DMN** — Business rule tasks evaluate decision tables via `@bpmnkit/feel`; supports all major hit policies.
- **Sub-processes** — Isolated child scope; completes when all tokens in sub-scope are consumed.
- **Error propagation** — Error end events propagate through scope chain to the nearest error boundary event.

## Native Rust AI server with embedded QuickJS (2026-03-03) — `apps/ai-server-rs`

The Tauri desktop app now bundles two native Rust binaries instead of a Node.js bundle:

- **`ai-server`** — HTTP server on port 3033 (axum, CORS, SSE). Detects and proxies Claude/Copilot/Gemini CLIs. Converts CompactDiagram ↔ BPMN XML via the embedded `@bpmnkit/core` bridge.
- **`bpmn-mcp`** — stdio MCP server (JSON-RPC 2.0). Used as the LLM's tool executor when MCP is supported. Maintains stateful BPMN diagram in-memory via the bridge.

**Core bridge** (`bridge.ts` → `bridge.bundle.js` → `include_str!`): `@bpmnkit/core` is compiled to an IIFE JS bundle at Rust build time and evaluated in a dedicated QuickJS (`rquickjs`) thread. When core changes, rebuilding the Rust package automatically picks up the update — no divergence between JS and Rust.

No Node.js required on the user's machine for the desktop app.

## History tab in sidebar dock (2026-03-03) — `canvas-plugins/history`, `packages/editor`

A dedicated "History" tab sits between Properties and AI in the right sidebar. It shows a chronological list of AI checkpoints for the currently open file with one-click restore (confirm dialog). The tab is disabled for in-memory files that have no storage context.

Day-based checkpoint retention: up to 50 checkpoints from today + 1 (latest) per day for the last 10 days. Older entries are pruned automatically on each save.

## MCP-based AI diagram editing (2026-03-03) — `apps/ai-server`

The AI server exposes a minimal stdio MCP server (`mcp-server.ts`) that gives the LLM structured tools to read and modify BPMN diagrams. Zero external dependencies — pure Node.js built-ins + `@bpmnkit/core`.

Tools: `get_diagram`, `add_elements`, `remove_elements`, `update_element`, `set_condition`, `add_http_call`, `replace_diagram`.

`add_http_call` always sets `jobType: "io.camunda:http-json:1"` — the Camunda HTTP REST connector is baked into the tool signature so the LLM can't use the wrong task type.

Adapters supported:
- **Claude** (`claude -p --mcp-config --allowedTools --strict-mcp-config`) — full MCP
- **Copilot** (`copilot -p --additional-mcp-config --allow-all-tools`, new `@github/copilot` GA Feb 2026) — full MCP
- **Gemini** (`gemini -p --yolo`) — fallback to system-prompt approach (no per-invocation MCP)

All diagram changes go through `expand()` + `Bpmn.export()` in core; the client receives validated XML via `{ type: "xml" }` SSE and never manipulates BPMN directly.

## Core-mediated AI pipeline (2026-03-03) — `apps/ai-server`

All AI chat requests now flow exclusively through the `@bpmnkit/core` package on the server:

1. **Operations format** — LLM outputs targeted ops (`add`, `remove`, `update`, `condition`) instead of re-generating the entire diagram for small changes. This is much more efficient for common tasks (add a node, rename, set a condition, add a REST connector task type).
2. **Fallback full diagram** — LLM can still output a full `CompactDiagram` for new diagrams or structural rewrites.
3. **Server-side validation** — `parseResponse()` applies ops to the current diagram, then `expand()` + `Bpmn.export()` validate and serialize the result. The frontend receives ready-made XML via a `{ type: "xml" }` SSE event.
4. **No client-side XML manipulation** — the apply button in the AI panel uses the server-produced XML directly.

## AI quick actions (2026-03-03) — `canvas-plugins/ai-bridge`

One-click AI operations on the current diagram, accessible via a quick-actions bar above the chat input:

- **Improve diagram** — analyzes the open diagram and returns an improved version in one shot, covering:
  - Sub-process consolidation (groups 3+ consecutive related tasks)
  - Simplification (removes redundant gateways and over-engineered paths)
  - Name normalization (verb-noun title case, consistent tone)
  - FEEL expression cleanup (minimal, readable conditions)
- Backend uses the core `optimize()` engine to pre-detect concrete issues (FEEL complexity, flow problems, task-reuse opportunities) before calling the LLM — the LLM receives a specific list of what to fix, not a generic "improve" instruction
- After streaming, the server validates the LLM's output by calling `expand()` + `Bpmn.export()` from core, then emits the result as a `{ type: "xml" }` SSE event — the client applies it directly without any client-side XML parsing
- The response appears as a normal AI message with an "Apply to diagram" button

## Tauri desktop app (2026-03-02) — `apps/desktop`

Native desktop application wrapping the BPMN Kit editor using Tauri v2:

- **Identical editor** to the browser version — same plugins, sidebar dock, AI integration
- **AI server auto-start** — on launch, spawns the bundled Node.js AI server automatically; no manual `pnpm ai-server` required
- **Small binary** — ~3–5 MB installer (vs 85+ MB Electron) via minimal Tauri features + release profile optimizations (`lto`, `opt-level = "s"`, `strip`)
- **Hot-reload dev** — `pnpm desktop:dev` opens a native window with Vite HMR
- **Cross-platform** — targets Linux/macOS/Windows via native OS WebView (WebKitGTK / WKWebView / Edge WebView2)
- **Placeholder icons** generated via `scripts/gen-icons.mjs`; replace with `pnpm tauri icon icon.png`

## Unified right sidebar dock (2026-03-02) — `apps/landing` + plugins

VS Code / Figma style dock that unifies the Properties config panel and the AI chat panel:

- **Single right dock** with Properties and AI tabs; no overlap, no z-index fighting
- **Properties tab**: shows config panel for selected element; "Select an element…" empty state when nothing selected
- **AI tab**: shows full AI chat panel (SSE streaming, Apply button, checkpoint history)
- **Collapse/expand**: width-based collapse (38px strip) — button always accessible; state persisted to `localStorage`
- **Resize**: left-edge drag; width 280–700px, persisted to `localStorage`
- **Auto-expand**: selecting an element expands dock to Properties tab; clicking AI button expands to AI tab
- **Backward compatible**: both plugins work without `container` (standalone/body mode unchanged)

## AI integration (2026-03-02) — `apps/ai-server` + `@bpmnkit/canvas-plugin-ai-bridge`

Local AI assistant for BPMN diagram creation and modification:

- **AI panel** in the editor (right-side slide-in) with streaming chat interface
- **Auto-apply**: AI responses containing a `CompactDiagram` JSON block get an "Apply to diagram" button; applies via `expand()` + auto-layout
- **Checkpoints**: IndexedDB stores up to 50 checkpoints per project/file; "History" button shows list with restore
- **Local server** (`pnpm ai-server`, port 3033): bridges browser to CLI-based AI — Claude CLI (`--output-format stream-json`) and GitHub Copilot CLI
- **Compact format** (`compactify`/`expand`): 5-10x token reduction vs raw XML; exported from `@bpmnkit/core`

## Reference navigation in element toolbar (2026-03-02) — `@bpmnkit/editor` HUD

When a BPMN element with a linked reference is selected, the cfg toolbar shows navigation buttons:

- **Call activity**: if `processId` set → "ProcessName ↗" navigate button; else → "Link process ▾" dropdown with available processes + "New process…" input modal
- **User task**: if `formId` set → "FormId ↗" navigate button; else → "Link form ▾" dropdown
- **Business rule task**: if `decisionId` set → "DecisionId ↗" navigate button; else → "Link decision ▾" dropdown
- Reference action buttons removed from config panel; process/form/decision text fields remain for manual editing

## Optimize plugin (2026-03-02) — `@bpmnkit/canvas-plugin-optimize`

New self-contained canvas plugin encapsulating the two-phase optimize dialog:

- `createOptimizePlugin(options)` returns `{ name, install(), button }` — button is injected into the HUD as `optimizeButton`
- Dialog logic (styles, phase 1 findings list, phase 2 results) fully self-contained in the plugin

## Custom storage dialogs (2026-03-02) — `@bpmnkit/canvas-plugin-storage`

All browser `prompt()`/`confirm()` calls replaced with themed custom modals:

- `showInputDialog(opts): Promise<string | null>` — text input modal with title, placeholder, default value
- `showConfirmDialog(opts): Promise<boolean>` — confirmation modal with optional `danger` styling
- Both exported from `@bpmnkit/canvas-plugin-storage`; used in storage and storage-tabs-bridge

## Optimize button (2026-03-02) — editor HUD + landing app

"Optimize Diagram" button in the BPMN editor action bar (wand+sparkle icon):

- **Phase 1** — shows all findings from `optimize(defs)` with severity badges; auto-fixable findings are pre-checked
- **Phase 2** — after applying selected fixes, shows results with "Open generated process in new tab" for extracted sub-processes
- Supports dark and light HUD themes
- Example diagram "Customer Notification Flow" on the welcome screen demonstrates 4 finding types

## `optimize()` — Static BPMN Optimization Analyzer (2026-03-02) — `@bpmnkit/core`

New `optimize(defs, options?)` function exported from `@bpmnkit/core`:

- **11 finding types** across 3 categories: `feel`, `flow`, `task-reuse`
- **FEEL analysis**: detects empty conditions, missing default flows, complex expressions (length/nesting/operators/variables), complex IO mappings, duplicate expressions
- **Flow analysis**: detects unreachable elements, dead-end nodes, missing end events, redundant gateways, empty sub-processes
- **Task reuse**: clusters service tasks by similarity (taskType + headers + IO) and flags groups that can be extracted to reusable call activities
- **`applyFix`** on each applicable finding mutates `defs` in-place; task reuse fix returns a generated `BpmnDefinitions` for the extracted sub-process
- **Configurable thresholds** via `OptimizeOptions`: FEEL length/nesting/operator/variable thresholds, reuse group minimum size, category filter

## Storage-tabs integration bridge (2026-03-02) — `@bpmnkit/canvas-plugin-storage-tabs-bridge`

New package that wires storage and tabs together so client apps don't need to manually manage the cross-plugin state:

- **`createStorageTabsBridge(options)`** — single factory that creates `tabsPlugin`, `storagePlugin`, and `bridgePlugin` pre-wired together
- **Tab↔file maps** — automatically tracks which tab corresponds to which storage file; handles project open/leave/rename
- **MRU tracking** — per-project most-recently-used file list; loaded on project open, updated on tab activate
- **File-search commands** — registers "Switch to file" and "Rename current file" commands in the command palette (when `palette` option provided)
- **Ctrl+E file switcher** — full keyboard-navigable switcher overlay; E to cycle, Tab/→ to search mode, Ctrl-release to commit
- **Auto-save** — wires `onTabChange` to `storageApi.scheduleSave` for DMN/Form tabs
- **Built-in download** — serializes BPMN/DMN/Form and triggers browser download (overridable)
- **Built-in recent projects** — maps `storageApi.getRecentProjects()` to welcome screen dropdown
- **`persistTheme`** on `BpmnEditor` — reads/writes `localStorage "bpmn-theme"` automatically
- **`enableFileImport`** on `createTabsPlugin` — built-in hidden file input + drag-and-drop; `api.openFilePicker()` to trigger programmatically
- **`Bpmn.makeEmpty()` / `Bpmn.SAMPLE_XML`** — convenience factories in `@bpmnkit/core`
- **`Dmn.makeEmpty()`** — returns minimal `DmnDefinitions` with one empty decision table

## DMN DRD Canvas (2026-03-01) — `@bpmnkit/canvas-plugin-dmn-editor` + `@bpmnkit/core`

- **Full DRG element model** — `DmnInputData`, `DmnKnowledgeSource`, `DmnBusinessKnowledgeModel`, `DmnTextAnnotation`, `DmnAssociation`, all three requirement types (`DmnInformationRequirement`, `DmnKnowledgeRequirement`, `DmnAuthorityRequirement`), waypoints, and diagram edges
- **Parser/serializer roundtrip** — all DRG elements, requirement child elements, and DMNDI edges (with `di:waypoint`) are parsed and serialized; `decisionTable` is now optional on decisions
- **Interactive SVG DRD canvas** — pan/zoom, drag-to-move nodes, connect mode, inline label editing, keyboard delete, auto-layout for nodes without diagram positions
- **5 node shapes**: Decision (rect), InputData (stadium), KnowledgeSource (wavy-bottom rect), BKM (clipped-corner rect), TextAnnotation (open bracket)
- **4 edge types**: InformationRequirement (solid filled arrow), KnowledgeRequirement (dashed open-V arrow), AuthorityRequirement (dashed + open circle), Association (dotted)
- **Toolbar**: add node buttons for each type, Connect tool, zoom controls
- **DRD as primary view** — opening a DMN file shows the DRD canvas; double-click a Decision → decision table; "← DRD" back button returns to DRD
- **Zero external dependencies** — pure TypeScript/DOM SVG rendering

## Form Editor drag-and-drop redesign (2026-02-28) — `@bpmnkit/canvas-plugin-form-editor`

- Three-panel layout: Palette (260px fixed) | Canvas (flex, scrollable) | Properties (300px fixed)
- **Palette**: 5 groups (Input, Selection, Presentation, Containers, Action); icon grid; live search; click or drag to add
- **Canvas**: card-based visual form preview; drop zones between cards; empty state; nested containers with inner drop zones
- **Drag-and-drop**: native HTML5 DnD; palette→canvas (copy), card→card (move); drop-zone highlight; self-move prevention
- **Component previews**: per-type non-interactive previews (faux input, textarea, select, checkbox, radio, button, badge, separator, spacer, image)
- **Properties panel**: colored icon header; label/key/required/text/expression/options inputs; label updates preview live without refocusing
- **CSS**: light theme by default; dark via `.dark` class; `--fe-*` CSS variables

## DMN Editor feature parity (2026-02-28) — `@bpmnkit/canvas-plugin-dmn-editor`

- Single-row column headers with "When"/"And" (inputs) and "Then"/"And" (outputs) clause labels
- Hit policy in table corner — abbreviated (U/F/A/P/C/C+/C</C>/C#/R/O); select overlay to change
- Collect aggregation: C, C+ (SUM), C< (MIN), C> (MAX), C# (COUNT)
- TypeRef dropdown per column — editable; round-trips through XML
- Annotations column bound to `rule.description`
- Context menu — right-click row number: add above/below/remove; right-click column header: add left/right/remove
- Double border separating input from output sections
- Light theme as default; dark theme via `.dark` class
- `DmnAggregation` type added to `@bpmnkit/core`; parsed and serialized in `aggregation` XML attribute

## DMN Editor + Form Editor (2026-02-27) — `@bpmnkit/canvas-plugin-dmn-editor` + `@bpmnkit/canvas-plugin-form-editor`

- **`@bpmnkit/canvas-plugin-dmn-editor`** — native editable decision table; zero external dependencies
  - **`DmnEditor`** class with `loadXML(xml)`, `getXML()`, `onChange(handler)`, `destroy()` API
  - Parses XML via `Dmn.parse`; serializes on demand via `Dmn.export`; model kept in memory
  - Editable decision name + hit policy dropdown per decision
  - Add / remove input columns, output columns, and rules (rows)
  - Each cell is a `<textarea>` bound directly to the model; structural changes trigger full re-render from model
  - CSS injected via `injectDmnEditorStyles()` — `--dme-*` CSS variables; dark default / `.light` override pattern

- **`@bpmnkit/canvas-plugin-form-editor`** — native two-panel form component editor; zero external dependencies
  - **`FormEditor`** class with `loadSchema(schema)`, `getSchema()`, `onChange(handler)`, `destroy()` API
  - Parses schema via `Form.parse`; exports via `Form.export`
  - Left panel: component list with type badge, label, up/down reorder, delete; nested containers shown indented
  - Right panel: property editor for selected component (label, key, required, options list, etc.)
  - "Add" dropdown grouped by Fields / Display / Advanced / Layout; all standard form component types supported
  - CSS injected via `injectFormEditorStyles()` — `--fe-*` CSS variables; dark default / `.light` override pattern

- **Tabs plugin wired for editing** — `@bpmnkit/canvas-plugin-tabs` mounts `DmnEditor` / `FormEditor`; `tab.config` kept in sync on every change
  - **`onTabChange(tabId, config)`** callback — fires whenever a DMN or Form tab's content changes; used for auto-save
  - Cleanup on tab close / `destroy()`

- **Auto-save wired in landing app** — `onTabChange` triggers `storagePlugin.api.scheduleSave()` for DMN and Form tabs

## IndexedDB Storage Plugin (2026-02-26, overhauled 2026-02-27) — `@bpmnkit/canvas-plugin-storage`

- **`@bpmnkit/canvas-plugin-storage`** — persists BPMN / DMN / Form files in the browser's IndexedDB in a `workspace → project → files` hierarchy
  - **Native IndexedDB** — zero-dependency wrapper; supports `get/add/update/delete`, `orderBy`, `where().equals()` with `toArray/sortBy/delete`, and `filter`
  - **6 record types**: `WorkspaceRecord`, `ProjectRecord`, `FileRecord` (with `isShared` and `gitPath`), `FileContentRecord`, `ProjectMruRecord` (per-project Ctrl+Tab history)
  - **Auto-save** — 500 ms debounce triggered by `diagram:change`; forced flush on page hide / `beforeunload`; multi-tab safe; bumps project `updatedAt` on each save
  - **Main-menu integration** — workspace/project navigation via drill-down menu (no sidebar); "Open Project", "Save All to Project", "Leave Project" actions in the ⋮ menu
  - **Welcome screen on load** — always shows welcome screen on startup; no auto-restore; `getRecentProjects()` provides top-10 recently-saved projects for the welcome dropdown
  - **`onLeaveProject` callback** — called when "Leave" is clicked; wired to close all tabs and show the welcome screen
  - **Export project as ZIP** — "Export Project…" in the main menu downloads a `.zip` of all project files; built-in CRC-32 + ZIP STORE implementation, no external dependencies
  - **Shared files** — any file can be marked `isShared: true` to make it accessible for cross-workspace reference resolution
  - **GitHub-sync ready** — every `FileRecord` carries a `gitPath: string | null` field reserved for future bidirectional GitHub sync
  - **`createStoragePlugin(options)`** returns `CanvasPlugin & { api: StorageApi }`; requires `mainMenu` and `getOpenTabs` options
  - **Project mode** — when a project is open: tabs cannot be closed by the user; all project files are always open; "Rename current file…" appears in the main menu; `onRenameCurrentFile` callback updates the tab display name
  - **MRU per project** — `getMru(projectId)` / `pushMruFile(projectId, fileId)` persist the most-recently-used file order in IndexedDB; used for Ctrl+Tab switching

## Main Menu Plugin (enhanced 2026-02-26, restyled 2026-02-27) — `@bpmnkit/canvas-plugin-main-menu`

- **`MainMenuApi`** — programmatic API: `setTitle(text)` updates title span; `setDynamicItems(fn)` injects items on every open
- **`MenuDrill`** — drill-down menu items with back-navigation stack; clicking drills into sub-menu; "← Back" button returns to parent
- **`MenuInfo`** — passive info row with optional action button (e.g. "Leave" for active project indicator)
- Theme picker now behind a "Theme" drill item instead of flat in root dropdown
- **Integrated into tab bar** — panel is flush with the tab bar (right-anchored, 36px tall, matching dark/light background colors); auto-reserves 160px via CSS `:has()` so the tab labels are never hidden behind it

## BPMN Element Config — Event Types (2026-02-27) — `@bpmnkit/canvas-plugin-config-panel-bpmn`

- **Timer events** — timerStartEvent, timerCatchEvent, timer boundaryEvent: "Timer type" select (Cycle / Duration / Date) + FEEL expression field for the chosen type; writes `BpmnTimerEventDefinition`
- **Message events** — messageStartEvent, messageCatchEvent, messageEndEvent, messageThrowEvent, message boundaryEvent, receiveTask, sendTask: "Message name" + "Correlation key" FEEL fields; writes `zeebe:message` extension element; receiveTask and sendTask support `messageName` option with root message de-duplication by name
- **Signal events** — signal start/catch/throw/end events and signal boundaryEvent: "Signal name" FEEL field; writes `zeebe:signal` extension element
- **Error events** — errorEndEvent and error boundaryEvent: "Error code" FEEL field; writes `zeebe:error` extension element
- **Escalation events** — escalation end/throw/catch events and escalation boundaryEvent: "Escalation code" FEEL field; writes `zeebe:escalation` extension element
- **Conditional events** — conditionalStartEvent, conditionalCatchEvent, conditional boundaryEvent: "Condition expression" FEEL field; writes `BpmnConditionalEventDefinition.condition`
- **Intermediate events** — all intermediate catch/throw events with any of the above definitions show the matching schema; plain intermediate events show name + documentation
- **Boundary events** — all boundary event variants (timer/message/signal/error/escalation/conditional) show their respective event-specific schemas; `boundaryEvent` type is now registered
- **General element coverage** — `subProcess`, `transaction`, `manualTask`, `task` (generic), `complexGateway` added; all show name + documentation

## BPMN Element Config — Call Activity, Script Task, Sequence Flow (2026-02-26, updated 2026-02-26)

- **Call activity** — configure `zeebe:calledElement processId` and `propagateAllChildVariables` in the config panel; "Select process…" button picks from open BPMN tabs; "New process" button creates a new blank BPMN and auto-links it; optional "Open Process ↗" action button navigates to the matching BPMN tab; navigate icon button in the element toolbar (HUD) above a selected call activity
- **Script task** — configure `zeebe:script expression` (FEEL expression, textarea) and `resultVariable`; replaces the generic name-only panel
- **Sequence flow condition expression** — clicking any sequence flow (edge) opens the config panel showing an editable `conditionExpression` FEEL textarea; works for gateway outgoing edges and any other flows; empty expression removes the condition element from the XML

## FEEL Language Support (2026-02-26) — `@bpmnkit/feel` + `@bpmnkit/canvas-plugin-feel-playground`

- **`@bpmnkit/feel`** — pure TypeScript FEEL engine; zero runtime dependencies; works in Node.js and browser
  - **Lexer** — position-aware tokenizer with full FEEL token set (temporal literals, backtick names, `..`, `**`, comments)
  - **Parser** — Pratt parser; `parseExpression()` and `parseUnaryTests()` entry points; greedy multi-word name resolution; error recovery
  - **Evaluator** — tree-walking evaluator; three-valued logic; ~60 built-in functions (string, numeric, list, context, temporal, range)
  - **Formatter** — pretty printer with configurable line-length-aware wrapping
  - **Highlighter** — `annotate()` / `highlightToHtml()` / `highlightFeel`; semantic token classification
- **`@bpmnkit/canvas-plugin-feel-playground`** — interactive FEEL panel in the editor
  - Expression and Unary-Tests modes; syntax-highlighted textarea; JSON context input; live evaluation; theme-aware (light/dark)
  - Opens as a full tab via `tabsPlugin.api.openTab({ type: "feel" })` — accessible from the command palette (Ctrl+K), the ⋯ main menu, and the welcome screen
  - `buildFeelPlaygroundPanel(onClose?)` exported for embedding in any container; `createFeelPlaygroundPlugin()` retained as a standalone overlay variant
- **`@bpmnkit/canvas-plugin-dmn-viewer` migration** — `feel.ts` now re-exports from `@bpmnkit/feel`; DMN cell highlighting uses the full FEEL highlighter

## Welcome Screen Examples (2026-02-26, updated 2026-02-27) — `@bpmnkit/canvas-plugin-tabs` + `apps/landing`

- **"Open recent" dropdown** — `getRecentProjects` option renders a dropdown button below "Import files…"; shows up to 10 most recently saved projects (Workspace / Project format); disabled when none; rebuilt on each welcome screen show
- **Dynamic sections on welcome screen** — `getWelcomeSections` option accepts a `() => WelcomeSection[]`; rebuilt on each show
- **Example entries on welcome screen** — the `examples` option accepts a `WelcomeExample[]`; each entry has a badge (BPMN / DMN / FORM / MULTI), label, optional description, and an `onOpen()` callback
- **4 built-in examples in the landing app**:
  - *Order Validation* (BPMN) — linear service-task flow
  - *Shipping Cost* (DMN) — FIRST hit-policy decision table: weight × destination
  - *Support Ticket* (FORM) — subject, category, priority, description, attachment
  - *Loan Application Flow* (MULTI) — BPMN + Credit Risk DMN + Application Form; opens all three tabs and registers resources in the resolver

## Welcome Screen + Grouped Tabs (2026-02-26, updated 2026-02-27) — `@bpmnkit/canvas-plugin-tabs`

- **Welcome screen** — shown when no tabs are open (and always on initial load); centered card with BPMN icon, title, "New diagram", "Import files…", and optional "Open recent" dropdown button; theme-aware (light/dark); `onNewDiagram` / `onImportFiles` / `onWelcomeShow` option callbacks
- **Plugin-managed tab XML** — subscribes to `diagram:change` internally; keeps `tab.config.xml` up to date for all open BPMN tabs; eliminates the need for client apps to track per-tab XML manually
- **Plugin-managed process tracking** — automatically parses BPMN XML on `openTab` and `diagram:change`; exposes `navigateToProcess(id)`, `getAvailableProcesses()`, `getAllTabContent()`, `closeAllTabs()` on `TabsApi`
- **Raw source toggle** — `</>` icon button in the bottom-left HUD panel; overlays a monospace `<pre>` with BPMN XML / DMN XML / Form JSON; stays in sync with live edits; disabled for FEEL tabs; button exposed via `TabsApi.rawModeButton` and placed in the HUD by `initEditorHud()`
- **Grouped tabs** — at most 3 tabs in the bar (one per type: BPMN, DMN, FORM); each group tab shows the active file name and a type badge; chevron opens a dropdown listing all files of that type; per-file close buttons in dropdown; close button on tab itself when group has only one file

## Multi-file Import + Tab Navigation in Editor (2026-02-26) — `apps/landing` + `canvas-plugins/*`

- **Import files via menu** — "Import files…" in the top-right menu opens a file picker accepting `.bpmn`, `.xml`, `.dmn`, `.form`, `.json`; each file opens in a separate tab
- **Drag-and-drop import** — drop any supported file onto the canvas to open it in a new tab
- **BPMN tab switching** — clicking a BPMN tab loads that diagram into the editor; BPMN panes are transparent so the editor canvas shows through
- **DMN/Form cross-navigation** — "Open Decision ↗" / "Open Form ↗" buttons in the config panel open the referenced file in a tab using the same `InMemoryFileResolver` populated by imports
- **`menuItems` option** added to main-menu plugin for injecting custom actions above the Theme section

## DMN Viewer + Form Viewer + Tabs Plugin (2026-02-26)

### `@bpmnkit/canvas-plugin-dmn-viewer`
- **Read-only DMN decision table viewer** — renders any `DmnDefinitions` as an HTML table; hit policy badge; input/output columns with type annotations
- **FEEL syntax highlighting** — tokenizes FEEL expressions in decision cells; colors keywords, strings, numbers, operators, ranges, function calls
- **Light/dark/auto themes** via CSS custom properties
- **`createDmnViewerPlugin(options)`** — canvas plugin wrapper; opens DMN viewer on click of call activities with `zeebe:calledDecision`

### `@bpmnkit/canvas-plugin-form-viewer`
- **Read-only Form viewer** — renders all 21 Camunda Form component types; built entirely in-repo (no `@bpmn-io/form-js` dependency)
- **Row-based grid layout** — respects `layout.row` grouping from the form schema
- **`createFormViewerPlugin(options)`** — canvas plugin wrapper; opens Form viewer on click of user tasks with `zeebe:formDefinition`

### `@bpmnkit/canvas-plugin-tabs`
- **Tab bar overlay** — fixed tab strip inside the canvas container for BPMN/DMN/Form tabs
- **`FileResolver` abstraction** — pluggable interface for resolving file references; `InMemoryFileResolver` default; designed for future FS/SaaS backends
- **`TabsApi`** — programmatic `openDecision(id)` / `openForm(id)` + full tab lifecycle management
- **Warning badge** — shown when a referenced DMN/Form file is not registered
- **Close-tab download prompt** — closing a tab with in-memory content shows a dialog (Cancel / Close without saving / Download & Close); the download callback serializes BPMN/DMN/Form to their respective formats and triggers a browser file download

### `@bpmnkit/core` — Extended form and Zeebe model
- **13 new Form component types** — number, datetime, button, taglist, table, image, dynamiclist, iframe, separator, spacer, documentPreview, html, expression, filepicker; `FormUnknownComponent` catch-all
- **`ZeebeFormDefinition`** and **`ZeebeCalledDecision`** typed interfaces in `ZeebeExtensions`

### `@bpmnkit/canvas-plugin-config-panel` + `config-panel-bpmn`
- **`"action"` FieldType** — clickable button fields in the config panel with `onClick` callback
- **Typed userTask panel** — `formId` field + "Open Form ↗" button wired to the tabs plugin
- **Typed businessRuleTask panel** — `decisionId` + `resultVariable` fields + "Open Decision ↗" button wired to the tabs plugin

## SubProcess Containment + Sticky Movement (2026-02-25) — `@bpmnkit/editor`
- **Sticky movement** — moving a subprocess moves all descendant shapes with it
- **Containment on create** — shapes dropped inside a subprocess become children in the BPMN model
- **Cascade delete** — deleting a subprocess removes all descendants from both the model and DI
- **Recursive label/connection updates** — renaming and connecting works for elements at any nesting depth

## Agentic AI Subprocess (2026-02-25) — `@bpmnkit/editor` + `@bpmnkit/canvas-plugin-config-panel-bpmn` + `@bpmnkit/core`
- **`adHocSubProcess` creatable in the editor** — appears in the Activities palette group (with tilde icon); 200×120 default size; resizable; type-switchable via `changeElementType`
- **AI Agent template wired end-to-end** — selecting the `io.camunda.connectors.agenticai.aiagent.jobworker.v1` template in the config panel's "Template" dropdown writes `zeebe:taskDefinition type="io.camunda.agenticai:aiagent-job-worker:1"`, `zeebe:adHoc outputCollection="toolCallResults"` + `outputElement` FEEL expression, and all required IO mappings and task headers; `zeebe:modelerTemplate`, `zeebe:modelerTemplateVersion`, and `zeebe:modelerTemplateIcon` are stamped on the element
- **`ZeebeAdHoc` typed interface** in `@bpmnkit/core` — `outputCollection`, `outputElement`, `activeElementsCollection`; `zeebeExtensionsToXmlElements` serialises it
- **`zeebe:adHoc` template binding** — `TemplateBinding` union extended; template engine reads/writes all three `zeebe:adHoc` properties correctly
- **Template-aware config panel for `adHocSubProcess`** — shows "Custom" or AI Agent template selector; `resolve()` delegates to full template form when template is active; clearing the template removes all modelerTemplate attributes

## Config Panel: Template Adapter Fix + Required Field Indicators (2026-02-25) — `@bpmnkit/canvas-plugin-config-panel` + `@bpmnkit/canvas-plugin-config-panel-bpmn`
- **Template adapter bug fixed** — changing any field while a connector template was active reverted the panel to the generic service task form (the write path used the base adapter which strips `zeebe:modelerTemplate`); now correctly uses the template-resolved adapter for all writes
- **Required field asterisk** — fields with `constraints.notEmpty: true` in connector templates show a red `*` next to the label
- **Required field red border** — input/select/textarea gets a red border when a required field is empty; clears as soon as the user enters a value

## Connector Template Icons in Canvas (2026-02-25) — `@bpmnkit/canvas` + `@bpmnkit/canvas-plugin-config-panel-bpmn`
- **Template icon rendering** — when a service task has `zeebe:modelerTemplateIcon` set (data URI from the connector template), the canvas renderer displays it as an SVG `<image>` in the top-left icon slot instead of the generic gear icon; works for all 116 Camunda connectors
- **Icon stamped on apply** — the config panel template engine writes `zeebe:modelerTemplateIcon` to the BPMN element whenever a connector template is applied, so the icon persists in the saved XML

## Connector Templates + Core Builder Integration (2026-02-25) — `@bpmnkit/canvas-plugin-config-panel-bpmn`
- **`templateToServiceTaskOptions(template, values)`** — converts any of the 116 connector templates into `ServiceTaskOptions` for the `Bpmn` builder; use any connector programmatically without hand-crafting extension XML
- **`CAMUNDA_CONNECTOR_TEMPLATES`** exported from the public API — find templates by id or name for programmatic use

## All 116 Camunda Connector Templates (2026-02-25) — `@bpmnkit/canvas-plugin-config-panel-bpmn`
- **`pnpm update-connectors`** — fetches all OOTB templates from the Camunda marketplace and regenerates `canvas-plugins/config-panel-bpmn/src/templates/generated.ts`
- **116 connectors** available in the connector selector: REST, Slack, Salesforce, ServiceNow, GitHub, Twilio, AWS EventBridge/Lambda/SQS/SNS, Azure, Google Sheets, WhatsApp, Facebook Messenger, and 100+ more
- **Template-ID-keyed selector** — each connector has its own distinct dropdown entry regardless of whether multiple connectors share the same underlying task definition type

## Element Templates System (2026-02-25) — `@bpmnkit/canvas-plugin-config-panel-bpmn` + `@bpmnkit/canvas-plugin-config-panel`
- **Camunda element template types** — full TypeScript type definitions (`ElementTemplate`, `TemplateProperty`, `TemplateBinding`, `TemplateCondition`) matching the Camunda zeebe-element-templates-json-schema
- **Template engine** — `buildRegistrationFromTemplate(template)` converts any element template descriptor to a `PanelSchema` + `PanelAdapter` pair; all binding types, condition types, and property types supported
- **REST Outbound Connector** — official Camunda template (`io.camunda.connectors.HttpJson.v2` v12) bundled; 8 groups, 5 auth modes (noAuth, API key, Basic, Bearer, OAuth 2.0), full output/error/retry configuration
- **Dynamic schema resolution** — `PanelAdapter.resolve?()` hook: config panel switches to the template-specific form when `zeebe:modelerTemplate` is present; re-renders on diagram change without losing state
- **`registerTemplate(template)`** — runtime API to register additional connector templates
- **`restConnector()` builder** — now stamps `zeebe:modelerTemplate` so programmatically-generated BPMN is recognized by the editor's template panel automatically

## Event Subgroups, Boundary Events & Ghost Fix (2026-02-25) — `@bpmnkit/editor`
- **3 event palette groups** — Start Events (5), End Events (7), Intermediate Events (10); each group contains only compatible types for type-switching
- **20 specific event palette types** — every BPMN event variant has a dedicated `CreateShapeType` with preset event definition; icons show the appropriate marker inside the ring
- **Boundary events** — any intermediate event type can be attached to an activity by hovering over it during creation; dashed blue highlight indicates attachment target; the event is positioned on the nearest boundary edge; boundary events move and delete with their host
- **Ghost shape preview** — the ghost preview now renders the correct shape for every element type (double ring for intermediate events, correct ring weight for start/end, diamond for gateways, bracket for annotations)
- **Type-switch restriction** — the configure toolbar only shows types within the same event subgroup; start, end, and intermediate events cannot be changed to each other
- **Escape to cancel** — canvas host auto-focuses when a create tool is activated, so Escape always cancels creation

## Full BPMN Element Type Coverage (2026-02-25) — `@bpmnkit/core` + `@bpmnkit/canvas` + `@bpmnkit/editor`
- **New core model types** — `BpmnTask`, `BpmnManualTask`, `BpmnTransaction`, `BpmnComplexGateway`; `BpmnLane`/`BpmnLaneSet` swimlane hierarchy; `BpmnMessageFlow` for inter-pool communication; five new event definition types (conditional, link, cancel, terminate, compensate)
- **Pool & lane rendering** — pools and lanes render as container rects with rotated title bars; correct nesting in the renderer
- **Message flow rendering** — dashed inter-pool arrows between participants
- **Non-interrupting boundary events** — dashed inner ring distinguishes non-interrupting from interrupting boundary events
- **Transaction subprocess** — double inner border distinguishes transaction subprocesses
- **New event markers** — conditional, link, cancel, terminate, compensate; complete event marker set
- **Complex gateway** — asterisk marker; added to creatable types with proper default bounds
- **21 element creation commands** — command palette and shape palette updated to cover all standard BPMN elements

## Element Colors & Text Annotations (2026-02-25) — `@bpmnkit/editor` + `@bpmnkit/canvas` + `@bpmnkit/core`
- **Shape colors** — `bioc:fill`/`bioc:stroke` (bpmn-js) and `color:background-color`/`color:border-color` (OMG) attributes rendered as inline fill/stroke on shape bodies; fully round-trips through import/export
- **Color picker** — 6 preset color swatches in the contextual toolbar for any selected flow element; clicking active swatch clears the color
- **Text annotations** — `BpmnTextAnnotation` text rendered inside the bracket shape; correct in both viewer and editor
- **Create annotation** — "Text Annotation" tool in the shape palette (Annotations group); click canvas to place; label editor opens immediately
- **Linked annotation** — "Add annotation" button in contextual toolbar creates an annotation linked to the selected shape via a `BpmnAssociation` edge
- **Annotation editing** — double-click annotation to edit its text; standard label editor
- **Cascade delete** — deleting a flow element also removes linked associations and their DI edges; deleting an annotation removes the association edges pointing to it
- **Association move** — moving a shape recomputes association edge waypoints
- **`DiColor` helpers** — `readDiColor`, `writeDiColor`, `BIOC_NS`, `COLOR_NS` exported from `@bpmnkit/core`

## BPMN Diagram Editor (2026-02-23) — `@bpmnkit/editor`
- **Full diagram editing** — create, move, resize, connect, delete, label-edit, undo/redo, copy/paste; type switching within BPMN groups
- **Edge split on drop** — drag a shape over a sequence flow to highlight it (green); release to insert the shape between source and target, splitting the edge
- **Configure bar (above element)** — shows all element types in the same BPMN group for quick type switching; label position picker for events and gateways
- **Group toolbar** — bottom toolbar shows one button per BPMN group (Events, Activities, Gateways); click to use last-selected type; long-press (500ms) opens a horizontal picker with all types in the group; standard BPMN notation icons throughout
- **`changeElementType(id, newType)`** — changes a flow element's type while preserving id, name, and connections
- **Orthogonal edges** — all sequence flows rendered as H/V-only Z-shaped paths; routes recomputed on shape move; endpoint repositioning via drag
- **Obstacle-avoiding edge routing** — new edges automatically route around existing shapes by trying all 16 port combinations and picking the first non-intersecting route
- **Edge segment drag** — hover over an edge segment to reveal a blue dot (projected cursor position) and a resize cursor (`ns-resize` for horizontal, `ew-resize` for vertical); drag perpendicularly to move the entire segment while keeping adjacent segments orthogonal
- **Edge waypoint insertion** — drag an edge at a shallower (more parallel) angle to insert a free-form bend point; diagonal edges allowed for waypoint insertion only
- **Edge endpoint repositioning** — click edge to select; drag start/end balls to reposition on source/target port (top/right/bottom/left); route recomputed via port-aware orthogonal routing
- **External label positions** — events and gateways show labels outside the shape; 8 positions via `setLabelPosition(id, pos)`; contextual toolbar compass icon to choose
- **Magnet snap** — shapes snap to aligned edges/centers of neighbors during drag; blue dashed guide lines shown
- **Contextual toolbar** — arrow icon to draw freehand connections; quick-add buttons for connected elements; label position picker for events/gateways
- **Tool system** — `setTool("select" | "pan" | "space" | "create:serviceTask" | ...)` with `editor:tool` event
- **Space tool** — click-and-drag to push elements apart; drag right/left to move elements in that half, drag up/down to move elements in that half; axis locks after 4px; amber dashed guide line shown; edges remain connected
- **Selection** — click, shift-click, rubber-band box-select; `setSelection(ids)` API; `editor:select` event; edge selection independent of shape selection
- **Undo/redo** — snapshot-based `CommandStack` (100 entries); `canUndo()` / `canRedo()` queries
- **Inline label editing** — double-click activates `contenteditable` div positioned over the shape
- **Copy/paste** — clipboard preserves inter-element flows; all IDs regenerated on paste with configurable offset
- **Export** — `exportXml()` returns BPMN 2.0 XML; `loadDefinitions(defs)` for programmatic model loading
- **Plugin compatibility** — identical `CanvasApi`; minimap and other canvas plugins work unchanged
- **Keyboard shortcuts** — Delete (shapes and edges), Ctrl+Z/Y, Ctrl+A, Ctrl+C/V, Escape
- **Events** — `diagram:change`, `editor:select`, `editor:tool` extend `CanvasEvents`

## Watermark Plugin (2026-02-25) — `@bpmnkit/canvas-plugin-watermark`
- **Attribution bar** — bottom-right overlay bar with configurable links and an optional square SVG logo; logo is always rightmost
- **`createWatermarkPlugin({ links?, logo? })`** — factory; `links` is an array of `{ label, url }` objects; `logo` is an SVG markup string
- Works with both canvas viewer and editor

## Canvas Plugins Workspace (2026-02-23) — `canvas-plugins/*`
- New pnpm workspace `canvas-plugins/*` for first-party canvas plugin packages
- **`@bpmnkit/canvas-plugin-minimap`** — minimap as an opt-in plugin; install via `plugins: [createMinimapPlugin()]`; handles `diagram:load`, `viewport:change`, `diagram:clear`; navigates via `CanvasApi.setViewport()`; fully self-contained CSS injection
- **`@bpmnkit/canvas-plugin-command-palette`** (2026-02-24) — Ctrl+K / ⌘K command palette; built-in commands: toggle theme, zoom to 100%/fit, export BPMN XML, zen mode; `addCommands(cmds)` extension point; works with both canvas viewer and editor
- **`@bpmnkit/canvas-plugin-command-palette-editor`** (2026-02-24) — editor extension plugin adding 21 BPMN element creation commands to the palette; requires `@bpmnkit/canvas-plugin-command-palette`
- **`@bpmnkit/canvas-plugin-config-panel`** (2026-02-24) — schema-driven property panel; `registerSchema(type, schema, adapter)` for extensible element forms; compact right-rail panel for single-element selection; 65%-wide full overlay with grouped tabs; auto-save on change; in-place value refresh preserves focus
- **`@bpmnkit/canvas-plugin-config-panel-bpmn`** (2026-02-24) — BPMN schemas for all standard element types; full Zeebe REST connector form for service tasks (method, URL, headers, body, auth, output mapping, retries)

## BPMN Canvas Viewer (2026-02-23) — `@bpmnkit/canvas`
- **Zero-dependency SVG viewer** — renders BPMN diagrams parsed by `@bpmnkit/core` with no external runtime deps
- **Framework-agnostic** — plain TypeScript/DOM; works in React, Vue, Svelte, or vanilla JS
- **Pan & zoom** — pointer-drag panning, mouse-wheel / two-finger pinch zoom, zoom-toward-cursor; RAF-batched at 60fps
- **Infinite dot-grid** — SVG `<pattern>` background that scrolls with the viewport
- **Minimap** — 160×100px overview; click-to-pan; synced viewport indicator rectangle
- **Themes** — `"light"` / `"dark"` / `"auto"` (follows `prefers-color-scheme`); implemented via CSS custom properties
- **Fit modes** — `"contain"` (scale to fit), `"center"` (1:1 centred), `"none"` (no auto-fit)
- **Accessibility** — `role="application"`, focusable shapes (Tab/Shift+Tab), keyboard pan/zoom/fit, Enter/Space to activate
- **Plugin system** — `CanvasPlugin` with `install(CanvasApi)` / `uninstall()` lifecycle
- **Events** — `diagram:load`, `diagram:clear`, `element:click`, `element:focus`, `element:blur`, `viewport:change`; `on()` returns unsubscribe fn
- **Zoom controls** — built-in +/−/⊡ buttons
- **Auto-refit** — ResizeObserver re-fits diagram on container resize
- **Small bundle** — 112KB JS / 25.95KB gzip

## Roundtrip Tests (2026-02-18)
- **34 example files tested** — 30 BPMN, 1 DMN, 3 Form files roundtrip through parse→export→re-parse
- **Typed model comparison** — validates semantic equivalence at the model level, not byte-level XML
- **XML-level roundtrip** — additional structural validation at the raw XML element tree level

## BPMN Support (2026-02-19)
- **Parse BPMN XML** — `Bpmn.parse(xml)` parses BPMN XML into a typed `BpmnDefinitions` model
- **Export BPMN XML** — `Bpmn.export(model)` serializes a `BpmnDefinitions` model back to BPMN XML
- **Fluent builder** — `Bpmn.createProcess(id)` creates processes with method chaining
- **Auto-layout** — `.withAutoLayout()` populates diagram interchange (shapes + edges) via Sugiyama layout engine
  - Opt-in: call `.withAutoLayout()` on `ProcessBuilder` before `.build()`
  - Without it, `diagrams` array remains empty (backward-compatible)
  - Handles gateway branches, sub-process containment, and orthogonal edge routing
  - Element sizing: events 36×36, tasks 100×80, gateways 36×36
  - Virtual grid: 200×160 cells with centered element placement
  - Baseline path alignment: process spine (start → gateways → end) shares same Y
  - L-shaped edge routing preferred over Z-shaped
  - Split gateways receive edges from left; join gateways from top/bottom/left based on position
  - Expanded sub-processes: containers with children are auto-sized and children laid out inside
  - Layout data survives export→parse→export round-trips
- **Gateway support** — exclusive, parallel, inclusive, event-based gateways with `branch(name, callback)` pattern
- **Auto-join gateways** — split gateways automatically get matching join gateways inserted when branches converge (BPMN best practice)
- **Loop support** — `connectTo(targetId)` for merge points and back-edge loops
- **Sub-process builders** — `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with nested content; `eventSubProcess()` emits canonical `<bpmn:subProcess triggeredByEvent="true">` with no illegal sequence flows; start events inside event sub-processes accept `isInterrupting: false` for non-interrupting triggers
- **Multi-instance** — parallel/sequential multi-instance with Zeebe extension elements
- **Aspirational elements** — businessRuleTask builder
- **REST connector builder** — `restConnector(id, config)` convenience method generates service tasks with `io.camunda:http-json:1` task type, IO mappings (method, url, auth, body, headers, queryParameters, timeouts), and task headers (resultVariable, resultExpression, retryBackoff)
- **Extension preservation** — zeebe:*, modeler:*, camunda:* extensions roundtrip as `XmlElement[]`
- **Root-level messages** — `bpmn:message` elements parsed, preserved, and serialized at definitions level
- **Message start events** — builder creates proper `<bpmn:message>` root elements with ID references
- **Webhook/connector config** — `zeebe:properties` support for connector configuration (e.g. webhook inbound type, method, context)
- **Agentic AI sub-process** — `adHocSubProcess()` supports full AI agent pattern: `taskDefinition`, `ioMapping`, `taskHeaders`, `outputCollection`/`outputElement` on `zeebe:adHoc`, modeler template attributes
- **Call activity** — `callActivity(id, {processId, propagateAllChildVariables})` with `zeebe:calledElement` extension
- **Diagram interchange** — BPMNDI shapes and edges preserved on roundtrip

## Form Support (2026-02-18)
- **Parse Form JSON** — `Form.parse(json)` parses Camunda Form JSON into a typed `FormDefinition` model
- **Export Form JSON** — `Form.export(model)` serializes a `FormDefinition` model to JSON
- **8 component types** — text, textfield, textarea, select, radio, checkbox, checklist, group
- **Recursive groups** — nested group components with arbitrary depth

## DMN Support (2026-02-18)
- **Parse DMN XML** — `Dmn.parse(xml)` parses DMN XML into a typed `DmnDefinitions` model
- **Export DMN XML** — `Dmn.export(model)` serializes a `DmnDefinitions` model back to DMN XML
- **Fluent builder** — `Dmn.createDecisionTable(id)` creates decision tables with method chaining
- **Multi-output tables** — support for 2+ output columns per decision table
- **Hit policies** — UNIQUE (default), FIRST, ANY, COLLECT, RULE ORDER, OUTPUT ORDER, PRIORITY
- **Roundtrip fidelity** — semantic equivalence preserved on parse→export cycle
- **Namespace preservation** — DMN, DMNDI, DC, modeler namespace declarations roundtrip correctly

## AIKit — Intent-Driven Process Automation (2026-04-04)

- **`/implement` skill** — Claude Code slash command: pattern lookup → BPMN generation → worker wiring → validation → coverage check → deploy prompt
- **`/review` skill** — validate any BPMN file, structured findings by severity, auto-fix offer
- **`/test` skill** — process structure analysis, worker coverage report, scenario suggestions
- **`/deploy` skill** — validation gate + deploy to local reebe or Camunda 8
- **`casen skills install`** — copies bundled skill files to `.claude/commands/` in any project
- **BPMNKit AIKit MCP server** (`bpmn-aikit` binary) — 11 MCP tools callable by Claude: `bpmn_create`, `bpmn_read`, `bpmn_update`, `bpmn_validate`, `bpmn_deploy`, `bpmn_simulate`, `bpmn_run_history`, `worker_list`, `worker_scaffold`, `pattern_list`, `pattern_get`
- **`@bpmnkit/patterns` package** — domain pattern library with 7 seed patterns: invoice-approval, employee-onboarding, supplier-contract-review, incident-response, loan-origination, content-moderation, order-fulfillment
- **Pattern schema** — each pattern includes: domain readme (regulations, conventions), compact BPMN template, worker specs with real API options, and common variations
- **Keyword-based pattern matching** — `findPattern(query)` matches user descriptions to patterns via keyword scoring
- **`@bpmnkit/worker-client` package** — thin Zeebe REST client for standalone workers; OAuth2 support for Camunda SaaS; `createWorkerClient()` + async `poll()` generator
- **Worker scaffolder** — `worker_scaffold` MCP tool generates TypeScript workers (`index.ts`) using `@bpmnkit/worker-client`; `tsx` for dev (no build step), `tsc` for production; multi-stage Docker in README
- **`casen worker start [name]`** — starts scaffolded workers from `./workers/` directory via `npm start`
- **`.claude/mcp.json`** — project-level MCP config registers `bpmnkit-aikit` server with Claude Code automatically

## Code Mode MCP Tools (2026-06-13)

Implements the Cloudflare Code Mode pattern: two meta-tools per domain replace enumerated API tools. The AI writes JS to introspect a spec, then writes JS to call the API.

### Camunda REST API (`camunda_search` + `camunda_execute`)
- **`camunda_search`** — runs arbitrary JS in a sandboxed V8 isolate (`isolated-vm`) with `CAMUNDA_SPEC` in scope (34 resource groups, 179 methods); returns whatever the code returns as JSON. Use to explore the API before executing.
- **`camunda_execute`** — runs arbitrary JS in a sandboxed V8 isolate with a `camunda` Proxy that routes `camunda.resource.method(args)` calls to a real `CamundaClient` on the host. Full Camunda REST API accessible in one tool.
- **`CAMUNDA_SPEC`** — auto-generated from `@bpmnkit/api` types; includes description, endpoint, params, returns for every method.
- **Sandbox** — `isolated-vm` V8 isolate per call; 64 MB memory limit; 5s timeout for search, 10s for execute; host never exposed beyond explicit `ivm.Reference` dispatch function.

### TypeScript SDK (`sdk_search` + `sdk_execute`)
- **`sdk_search`** — runs arbitrary JS in a Node `vm` context with `SDK_SPEC` in scope (5 SDK functions + compact diagram shape); returns whatever the code returns as JSON.
- **`sdk_execute`** — runs arbitrary JS with `sdk.{parse, exportXml, optimize, layout, analyzeVariables}` helpers bound to `@bpmnkit/core`; optional `xml` argument pre-loaded into context. Use to generate, transform, or analyze BPMN diagrams.
- **`SDK_SPEC`** — documents each SDK function with description, params, returns, usage example.
