# Using BPMN Kit with AI — From the library instead of the CLI — The other route: `docspack index`

Upstream [docspack](https://docspack.dev) 1.1.0 added
[a second way to do this](https://docspack.dev/docs/your-own-corpus/). Rather than
building a pack, it keeps an SQLite index of loose sources, and answers from it
with `recall` instead of `ask`:

```sh
npm i -D docspack

npx docspack index --from ./flow-docs
npx docspack recall "when does an order need manager approval"
```

```
indexing @local/flow-docs
+ @local/flow-docs  10 chunks  ~527 tokens
```

Pick it over `bpmnkit-docs build` when the corpus is not a folder of Markdown.
Anything that emits JSON can be indexed without a database driver:

```sh
sqlite3 -json shop.db 'select id, title, body as text from orders'   | npx docspack index --from-json -
```

It also tracks each source's size, mtime and hash, so a re-run does nothing when
nothing changed, and `recall` leads with a warning rather than quoting a passage
that has since been edited:

```
NOTE: the corpus is out of date. 1 indexed source has changed since it was
built: flow-docs/04-shipping.md. The passages below may be superseded — run
`docspack index` again before relying on them.
```

`recall` is deliberately not `ask`: your notes are never an installed version, so
a corpus cannot reach an answer about a dependency and a dependency cannot reach
an answer about your notes. The index lands in `.docspack/local.db` as plaintext
and the tool writes a `.gitignore` beside it.

The two routes do not merge. `bpmnkit-docs` searches your corpus and the
installed packs together because a pack directory is just a directory; upstream
keeps them in separate query paths on purpose. Build a pack when you want one
answer drawn from both; use `docspack index` when the corpus is a database, or
when you want the staleness check.

> **Use `docspack@1.2.0` or newer for the Camunda pack.** Earlier versions named
> one pack per npm scope, so `docspack sync` read `@bpmnkit/camunda-docspack` as
> an ordinary dependency and indexed its type declarations — `0 chunks
> (declarations)` — leaving a Camunda question to be answered out of the wrong
> pack. 1.2.0 discovers `@<vendor>/<name>-docspack` and indexes all 1,054 chunks.
> `bpmnkit-docs` has read the suffix from the start and needs no version floor.

---
Source: https://bpmnkit.com/docs/guides/using-bpmnkit-with-ai
