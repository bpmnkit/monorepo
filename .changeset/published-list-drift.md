---
"@bpmnkit/create-casen-plugin": patch
"@bpmnkit/user-tasks": patch
"@bpmnkit/cli-sdk": patch
---

Ship a LICENSE file. These three packages were published to npm without one.

`scripts/published-packages.mjs` is the single list that `sync-license.mjs`,
`check-packages.mjs`, `check-package-consumable.mjs` and the landing site's ecosystem
page all read. All three packages are non-private and have been publishing for months —
and none of them was on it. Each declared `"LICENSE"` in its `files` array with no
LICENSE file on disk, so each reached npm marked MIT with the licence text missing;
none was metadata-checked, none had its tarball opened before release, and none appeared
on bpmnkit.com's package list.

Adding them to the list is the whole fix — the scripts do the rest. `@bpmnkit/user-tasks`
also gains a generated README: its old one was hand-written in the generator's own style,
which meant the next `pnpm build` would have deleted it, and it carried a stale
`docs.bpmnkit.com` link and a related-packages table four packages out of date.
