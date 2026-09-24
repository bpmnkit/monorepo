---
"@bpmnkit/profiles": patch
---

The profile store (`config.json`), which holds client secrets and passwords, is now written readable by its owner only (`0600`, in a `0700` directory on first creation). A store written by an earlier release is tightened the next time it is saved.

Deleting a profile now deletes its metadata too, so a new profile saved under the same name no longer inherits the old description, tags and creation date.

`getAuthHeader` caches OAuth2 tokens per token URL, client id, audience and scope instead of per client id alone, so two profiles that share a client id — one cluster's Zeebe and Operate audiences, or two clusters behind one identity provider — no longer receive each other's token.
