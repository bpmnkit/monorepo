# @bpmnkit/docspack — Overview

`@bpmnkit/docspack` ships the documentation you are reading as an npm package. An agent
installs it, asks a question, and gets back the two or three passages that answer it —
not a whole documentation site, and not whatever the model remembers about an older
release.

It follows the [docspack package format](https://docspack.dev/spec), so the upstream
`docspack` CLI indexes it like any other vendor pack. The bundled `bpmnkit-docs` command
does the same job with no extra tooling.

- **Offline** — `ask`, `search` and `list` read the filesystem only. No server, no network
  call, nothing resident between questions
- **Version-locked** — the installed `package.json` version wins over the manifest, so an
  agent reads the docs for the release the project actually has
- **Bounded** — three chunks and 3,000 tokens by default, budgeted from the manifest
  before any content is read
- **Real retrieval** — BM25 with Porter stemming, so `authenticate` finds a passage that
  only says `authentication`; tags and API identifiers weigh 3× prose
- Zero runtime dependencies

---
Source: https://bpmnkit.com/docs/packages/docspack
