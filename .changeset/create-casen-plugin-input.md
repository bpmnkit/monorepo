---
"@bpmnkit/create-casen-plugin": patch
---

The scaffolder now validates `--name` in non-interactive mode the same way the prompt does. Before, a name such as `../outside` wrote the project outside the working directory. It also refuses to scaffold into a directory that already exists and is not empty, where before it silently overwrote the files there.

A display name that contains quotes or backslashes now produces a `src/index.ts` that parses: the values are written as escaped string literals. The plugin id is derived from the author after lower-casing it, so `--author Acme` gives `com.acme.…` rather than `com.cme.…`.
