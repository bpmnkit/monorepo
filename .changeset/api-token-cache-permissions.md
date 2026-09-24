---
"@bpmnkit/api": patch
---

The OAuth token cache file is now written readable by its owner only (0600, in a 0700 directory), and a cache written earlier is tightened on its next write.
