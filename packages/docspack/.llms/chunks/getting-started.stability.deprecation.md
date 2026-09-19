# Stability and Versioning — Deprecation

Nothing that is public API disappears without warning.

1. It is marked `@deprecated` in the type declarations, naming what to use instead. Your editor
   and your build show it; nothing breaks.
2. It keeps working for **at least one minor release**, and is listed in the changelog entry
   that deprecated it.
3. It is removed only in a major, and the major's release notes list every removal.

An alias kept purely for compatibility is documented as such — `ProcessBuilder`'s `strict`
option is the existing example, a deprecated alias for `explicitJoins`.

---
Source: https://bpmnkit.com/docs/getting-started/stability
