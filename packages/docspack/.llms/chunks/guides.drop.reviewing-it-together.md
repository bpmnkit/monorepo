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

---
Source: https://bpmnkit.com/docs/guides/drop
