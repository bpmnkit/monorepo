# Drop — Share & Co-edit — Reviewing it together

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

Editing is limited to BPMN files with a single process — the editor handles one process at
a time — and the built-in demo drop is read-only, though **Edit a copy** will upload it as a
drop of your own.

### Rate limiting the edit baton

Because a drop is editable by anyone holding the link, claiming the baton can be put behind
a [Turnstile](https://developers.cloudflare.com/turnstile/) challenge — one challenge per
editing session, not per keystroke. It is invisible to somebody who takes the baton once and
edits for half an hour, and a real cost to a script that wants to rewrite every drop it can
find. On a self-hosted deployment it is configuration (`TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET`); with neither set, claims are not challenged.

---
Source: https://bpmnkit.com/docs/guides/drop
