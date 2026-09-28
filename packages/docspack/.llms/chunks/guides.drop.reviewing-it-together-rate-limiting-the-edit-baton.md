# Drop — Share & Co-edit — Reviewing it together — Rate limiting the edit baton

Because a drop is editable by anyone holding the link, claiming the baton can be put behind
a [Turnstile](https://developers.cloudflare.com/turnstile/) challenge — one challenge per
editing session, not per keystroke. It is invisible to somebody who takes the baton once and
edits for half an hour, and a real cost to a script that wants to rewrite every drop it can
find. On a self-hosted deployment it is configuration (`TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET`); with neither set, claims are not challenged.

---
Source: https://bpmnkit.com/docs/guides/drop
