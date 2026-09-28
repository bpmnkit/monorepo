---
"@bpmnkit/profiles": patch
---

A profile store that is not valid JSON (or not a JSON object) now raises an error that names the file, instead of being read as empty — the next save used to overwrite every profile in it. A store with missing keys (`profiles`, `active`, `meta`) is read with those keys empty instead of throwing a `TypeError`.
