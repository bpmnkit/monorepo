---
title: Drop — Share & Co-edit
description: Turn a BPMN, DMN or Camunda Form file — or a FEEL expression and the variables it reads — into a link anyone can open, watch live, comment on, and edit one writer at a time. No account, no modeler install, no Camunda cluster.
sidebar:
  order: 12
---

[BPMN Kit Drop](/drop) is the shortest path between a diagram on your machine and the
person who needs to look at it. Drag a file onto the page, get a short link back, send it.
Whoever opens the link sees the diagram rendered in their browser — no account, no modeler
install, and no Camunda cluster anywhere in the story.

It is also where a review happens. A drop is not frozen: anyone with the link can comment
on an element and @mention the people reviewing with them, take the edit baton and change
the diagram while everyone else watching sees the change arrive, and a shared FEEL
statement can be opened, run against different values, and saved back.

## Sharing a file

Open <https://bpmnkit.com/drop> and drop a file onto the page — the whole page is the
target — or paste one from the clipboard. `.bpmn`, `.dmn`, `.form` and `.feel` are all
rendered; `.xml` and `.json` are accepted and sniffed for the kinds above.

| Limit | Value |
| --- | --- |
| Files per drop | 20 |
| Size of a single file | 900 KB |
| Total per drop | 5 MB |
| Retention | 90 days after the last view or edit |

The share id is 11 base58 characters — about 64 bits, so a drop is unguessable and
unlistable, but it is **not** access-controlled: anyone holding the link can view the
diagram and take a turn editing it. Treat a drop the way you would treat an unlisted link,
not the way you would treat a private repository.

You can also start a drop from a diagram you just drew rather than a file you already had:
the [browser editor](/editor) has **Share as a drop** in its main menu, which uploads the
open diagram through the same endpoint and the same checks.

### From the command line

A drop is a plain HTTP upload, so `curl` works:

```sh
curl -s -X POST https://bpmnkit.com/drop/api/drops \
  -F files=@order-process.bpmn
# → { "shareId": "7Fq2mKd9xTs", "url": "https://bpmnkit.com/drop/7Fq2mKd9xTs", "files": [...] }
```

And the stored file comes back either as uploaded or as the parsed model:

```sh
curl -s https://bpmnkit.com/drop/<shareId>/manifest.json
curl -s "https://bpmnkit.com/drop/<shareId>/f/order-process.bpmn"                # original bytes
curl -s "https://bpmnkit.com/drop/<shareId>/f/order-process.bpmn?format=json"    # @bpmnkit/core model
```

A FEEL statement is a file like any other, so the same upload carries one:

```sh
echo '{"expression":"amount > limit","context":{"amount":90,"limit":50}}' \
  | curl -s -F "files=@-;filename=condition.feel" https://bpmnkit.com/drop/api/drops
```

## Sharing a FEEL expression

A gateway condition or a decision-table entry is unreadable on its own: `order.amount * (1
+ vat)` says nothing until you know what `order` and `vat` were. So a FEEL drop carries
both halves — the expression **and** the context it runs against — and the share page
evaluates them in the reader's browser rather than showing a value you typed in by hand.

Three ways in, all producing the same thing:

- **The composer on [/drop](/drop).** Two boxes and a result that updates as you type,
  then **Get a share link**.
- **The [FEEL playground](/feel-functions).** **Share as a drop** posts whatever is in the
  expression and context boxes.
- **A `.feel` file.** Drop or `curl` it like any other file.

A `.feel` file is either the bare expression:

```text
if risk.score < 40 then "approve" else "refer to underwriting"
```

or a JSON document, which is what the composer and the playground post and what a drop
stores:

```json
{
  "expression": "if risk.score < 40 then \"approve\" else \"refer to underwriting\"",
  "context": { "risk": { "score": 22, "band": "low" } },
  "mode": "expression"
}
```

`mode` is `"expression"` (the default) or `"unary-tests"`. In `unary-tests` mode the
statement is read the way a decision-table input entry is, and the value under test is
whatever the context bound to `?`:

```json
{ "expression": "[18..65]", "context": { "?": 30 }, "mode": "unary-tests" }
```

A bare expression is stored as the document it became, so the **Original** download always
round-trips back through the same parser. Expressions that do not parse are refused at
upload, exactly as unparseable BPMN is — a link that renders a syntax error is not worth
sending.

### Trying it with your own numbers

The reason to open somebody else's expression is usually to run it against your own data:
change the amount, see whether the gateway still goes the way they said it does. So the
share page has an **Edit** button for a statement too, and it opens the same two boxes the
composer has, on whatever the drop currently says. Everything you type there stays in your
browser — it evaluates as you type, and the link is untouched until you press a button that
says otherwise:

- **Save to this drop** writes your statement back to the link, so everyone opening it
  afterwards sees the new one. The statement it replaces becomes a milestone in the
  [version log](#reviewing-it-together), and the expression the drop was uploaded with is
  still there as **Original**, as always.
- **Share as new** posts what is in the boxes as a drop of its own and takes you there. The
  original link is left exactly as it was — this is the way out when you were only playing,
  or when the drop is one you may not rewrite.
- **Reset** puts the drop's own statement back in the boxes.

A statement is not edited through the baton: there is no op vocabulary for two boxes of
text, and no live replay to watch, so nothing is claimed and nothing is locked. What
protects the drop instead is the save itself. A save carries the hash of the statement the
page opened, and one made against a statement that has since been replaced is refused with
what the drop says now — so two people editing the same link cannot quietly overwrite each
other, and a reader who sees that message can reload, or keep theirs with **Share as new**.
Where the deployment configures Turnstile, the challenge is on the save and not on opening
the editor: trying an expression out is never worth a challenge, and writing to somebody
else's link is.

## Reviewing it together

Everything below happens on the share page itself — there is nothing to install on either
end.

**Live presence.** The topbar counts the people who have the drop open, and says when one
of them is editing. A diagram moving under a reader's eyes is only unsettling when nothing
on the page explains it.

**One writer at a time.** Editing is a baton, not a merge. Press **Edit** to claim it and
the diagram becomes editable for you and stays live for everyone else; press **Done** to
hand it back. A second person pressing Edit while you hold it is told who has it. There is
no conflict resolution because there is never a second writer to conflict with.

**No save button.** Changes persist as you make them, so there is no moment at which a
reviewer can lose work by closing the tab — and none at which they can be asked whether
they meant it. That is what makes the version log below load-bearing rather than a nicety.

**Version history.** Every file keeps the original it was uploaded as, pinned and never
overwritten, plus its ten most recent milestones. Repeated saves inside an hour collapse
into one milestone, and a new editing session always starts its own, so a stranger editing
at 10:45 cannot overwrite the previous editor's 10:30 state. Restoring **appends**: the
state being replaced becomes a milestone first, so restoring can never be the thing that
loses work. Undoing a restore is another restore.

**Visual diff.** Two drops can be put side by side at `/drop/<before>/diff/<after>`: added,
removed, changed and *moved* elements marked on synchronised canvases, with pan and zoom
locked together. The same diff is available offline as
[`casen diff bpmn`](/docs/cli/diff) and as a plugin in `@bpmnkit/plugins`.

**Comments.** Press **Comments** to open the review panel. With it open, click an element
on the diagram to comment on that element, or just write to comment on the file as a
whole. DMN, form and FEEL files take whole-file comments only. Each element with open
threads gets a small numbered marker on the canvas; click it to jump to its threads.
Threads take replies, and anyone who has commented on the drop can **Resolve** a thread or
**Reopen** it. New comments, edits and resolutions reach everyone who has the drop open
as they happen.

A comment is anchored by the element's id, not by its position. It stays with the element
when the element moves, and survives any number of edits. If a later edit deletes the
element, the comment is still listed, marked **on a removed element** with the name the
element had when the comment was written. While you preview an older version from
**History**, the same label reads **not in this version**.

**@mentions.** Type `@` in a comment to pick from the names this drop has seen: the people
who have it open now and everyone who has commented on it. A mentioned name is highlighted
in the comment. If the mentioned person has the drop open, a notice appears at the top of
their page with a button that opens the thread. Drop has no accounts and stores no email
addresses, so **a mention sends no email and no push notification**. Someone who does not
have the drop open sees the mention the next time they open it. If it matters, send them
the link yourself.

**Who you are, without an account.** Your display name is whatever you type into the
comment box. The browser remembers it and shows it to the other people viewing the drop.
Nothing checks it, so two people can both call themselves Anna. Your first comment on a
drop gives your browser a private key for that drop, and the server stores only a hash
of it. That key is what lets you edit or delete **your own** comments, and nobody else's.
It lives in this browser only: clear the site data, or change browsers, and your earlier
comments can no longer be edited or deleted from there. A deleted comment that has replies
leaves a "Comment deleted" placeholder, so the replies still make sense.

Comments follow the same abuse rules as edits. Where the deployment configures Turnstile,
your first comment on a drop needs one challenge, and your later comments on it do not.
Each address can make 60 comment writes an hour. A drop holds at most 500 comments, and a
comment is at most 2,000 characters. A drop whose content is on the ban list takes no new
comments. The demo drop and drops an operator has pinned are read-only for comments as
well as for edits. Comments are deleted with their drop: when it expires, or when an
operator removes it.

Diagram editing is limited to BPMN files with a single process — the editor handles one
process at a time — and the built-in demo drop is read-only, though **Edit a copy** will
upload it as a drop of your own. A FEEL statement is edited differently and on its own
terms; see [trying it with your own numbers](#trying-it-with-your-own-numbers) above.

### Rate limiting the edit baton

Because a drop is editable by anyone holding the link, claiming the baton can be put behind
a [Turnstile](https://developers.cloudflare.com/turnstile/) challenge — one challenge per
editing session, not per keystroke. It is invisible to somebody who takes the baton once and
edits for half an hour, and a real cost to a script that wants to rewrite every drop it can
find. On a self-hosted deployment it is configuration (`TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET`); with neither set, claims are not challenged.

## Running your own

Drop is a single Cloudflare Worker in the monorepo (`apps/drop`), MIT-licensed like
everything else. Files live in D1 as the typed `@bpmnkit/core` model alongside the
byte-faithful original; presence and live editing are a Durable Object per share.

```sh
pnpm --filter @bpmnkit/drop build
wrangler d1 migrations apply bpmnkit-drop --local
wrangler dev --local --port 8787 \
  --var DROP_ADMIN_TOKEN:devtoken --var REPORT_IP_SALT:devsalt
```

That runs the Worker, D1 and the Durable Object in a local simulator, so the whole app works
offline with no Cloudflare account. For a real deployment,
`pnpm --filter @bpmnkit/drop provision` is an idempotent script that creates the database,
applies the migrations, builds the client bundles and deploys the Worker; re-running it
skips whatever is already in place. See `apps/drop/DEPLOY.md` for the full runbook.

## What Drop is not

- **Not a permission system.** Link-holders are editors and commenters. If a diagram
  should not be editable by whoever it reaches, do not put it in a drop.
- **Not a notification service.** A mention reaches someone only if they have the drop
  open. There is no email, no inbox, and no account to send one to.
- **Not storage.** A drop expires 90 days after it was last touched, and the version log
  holds eleven states, not every state.
- **Not a modeler.** It renders and edits one process at a time. For authoring, use the
  [browser editor](/editor), the [VS Code extension](/docs/guides/vscode) or the
  [builder API](/docs/packages/core).
