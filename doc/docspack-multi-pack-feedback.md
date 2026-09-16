# docspack — feedback: a vendor with two corpora in one scope

**Status:** open — to file as a Discussion on [docspack/docspack](https://github.com/docspack/docspack)
**Filed against:** `docspack@1.1.0`, spec v1 (`https://docspack.dev/schema/v1.json`)
**Reporter:** BPMN Kit — publisher of `@bpmnkit/docspack` and `@bpmnkit/camunda-docspack`

We publish two docspack packs under one npm scope. The spec says not to, and
offers two alternatives, neither of which we can take. The result today is not a
refusal — it is a **silently wrong answer**: the second pack installs, passes
`docspack doctor`, and is never consulted, so a question it should answer is
answered by the other pack instead.

This document sets out the case, why the documented escape hatches do not fit it,
and three possible changes ordered by preference — plus one small change worth
making even if all three are rejected.

---

## The two packs

| | `@bpmnkit/docspack` | `@bpmnkit/camunda-docspack` |
|---|---|---|
| Content | BPMN Kit's own APIs, CLI and guides | The Camunda 8 documentation |
| Author of the prose | us | Camunda Services GmbH |
| Licence | MIT | **CC BY-SA 3.0** |
| Version tracks | BPMN Kit releases | Camunda 8.10 + one upstream commit |
| Rebuilt | on every docs edit | weekly, from a `camunda-docs` checkout |
| Size | 191 chunks, ~44,000 tokens | 1,054 chunks, ~302,200 tokens |

They are not two halves of one subject. Ours answers *how do I drive this
library*; the other answers *what does the engine do*. Those are different
questions and the right answer to one is the wrong answer to the other — which is
exactly why we wanted them separable at query time.

---

## What happens today

Two packs in one scope, both produced by `docspack build`, both passing
`docspack doctor`:

```console
$ docspack doctor --cwd node_modules/@acme/docspack
ok 2 chunks, ~68 tokens (2 notes)

$ docspack doctor --cwd node_modules/@acme/extra-docspack
ok 2 chunks, ~72 tokens (3 notes)
```

`sync` opens the second one and then drops it without a word:

```console
$ docspack sync
indexing @acme/docspack@1.0.0
reading @acme/extra-docspack@1.0.0
reading docspack@1.1.0
+ @acme/docspack@1.0.0   2 chunks  indexed
+ docspack@1.1.0         7 chunks  indexed (declarations)
```

`@acme/extra-docspack` is read, then appears in no line of the output. `list`
does not mention it either, and `list --json` reports:

```json
"packages":     [ "@acme/docspack@1.0.0" ],
"declarations": [ "docspack@1.1.0" ],
"problems":     []
```

The failure then surfaces as a confident answer from the wrong corpus. This
question names the second pack's content verbatim — `dlq.extra-docspack` appears
only in that pack and nowhere else on the machine:

```console
$ docspack ask "dead letter queue dlq.extra-docspack retry"
## @acme/docspack@1.0.0/docspack-guide-retry-policy-in-docspack
…routed to the dead-letter queue `dlq.docspack`…
$ echo $?
0
```

Exit 0. An agent cannot tell that the corpus it asked about was never consulted,
and the answer it gets names a different queue.

**`doctor` and the indexer disagree.** `doctor` is documented as checking "a
package the way the indexer and a reviewer would". It checks the manifest, the
chunks, the `files` list and the prose — and not the name, which is the only
property that decides whether the indexer will read the package at all. A
publisher gets `ok` on a package nothing can read.

In our own case the pack that goes unread is 1,054 chunks and ~302,000 tokens of
Camunda documentation, and the question it silently loses is every question about
the engine we generate processes for.

## Why the documented alternatives do not fit

The spec is explicit, and we read it before publishing:

> One pack per npm scope is deliberate, and it is the constraint to design a
> package layout around. It is what makes `@vendor/docspack` derivable from a
> dependency's own name, so a project's documentation set is a function of its
> `package.json` alone. A vendor shipping two unrelated products under one scope
> documents both in one pack, or publishes the second under a scope of its own.

### "documents both in one pack"

- **Licence.** Our prose is MIT. Camunda's is CC BY-SA 3.0, and chunking it and
  rendering its embedded diagrams as text makes the result an Adaptation under §1
  rather than a Collection — so ShareAlike applies. Merging the two would
  relicense our own documentation as CC BY-SA 3.0. That is not a packaging
  preference we are declining; it is a licensing consequence we cannot accept.
- **Version.** A pack's version is the package version, and the installed
  `package.json` version supersedes the manifest's — your rule, and a good one.
  One package cannot version-lock to two upstreams. Merged, neither corpus is
  version-locked to anything, which discards the property the format is for.
- **Cadence.** Ours rebuilds whenever our docs change. The Camunda pack rebuilds
  weekly from upstream, behind a workflow that verifies the build is
  byte-reproducible. Merged, every Camunda refresh republishes our documentation
  and every typo fix in ours republishes Camunda's.
- **Attribution.** The `NOTICE` naming the upstream commit and every change made
  is per-package. Merged, it would have to cover a package that is mostly not
  derived from that source.
- **Cost.** 191 chunks against 1,245. Every question would pay to index both. In
  our own reader, scoping to one pack is ~150ms against ~650ms — and `--package`
  cannot separate what is one package.

### "publishes the second under a scope of its own"

Three candidate scopes, three problems:

- **`@camunda/docspack`** — we do not own it, and publishing Camunda's
  documentation under a scope that reads as Camunda's would be brand
  impersonation whatever the intent. Non-starter.
- **`@bpmnkit-camunda/docspack`** — a new npm organisation per redistributed
  corpus. It scales badly, and it *weakens* the trust signal rather than
  preserving it: a reader can see at a glance that `@bpmnkit/*` is us, and cannot
  see that `@bpmnkit-camunda` is us without checking.
- **`@docspack-community/camunda`** — spec-legal and discoverable today, and the
  closest fit. But every answer would be labelled `(community)` and "marked
  untrusted data". That is the wrong signal for a pack with an identifiable
  publisher, a reproducible build, weekly CI and a NOTICE — arguably more
  provenance-tracked than most first-party packs. Teaching agents to discount it
  costs more than the naming saves. The community scope is also open, so the name
  is squattable by someone else.

---

## Requested changes

### 1. Accept `@<vendor>/<name>-docspack` as a trusted sibling — preferred

Discovery matches a declared dependency name against `@<scope>/docspack` **or**
`@<scope>/<name>-docspack`. Everything else is unchanged.

This keeps the rationale intact, which is the part worth arguing:

- **Still a pure name check against `package.json`.** No registry call, no
  manifest fetch, nothing that can fail offline. `@bpmnkit/camunda-docspack` is
  *in* the consumer's `package.json` the moment they depend on it, so a project's
  documentation set remains a function of its `package.json` alone. Matching a
  pattern against declared names is the same class of operation as comparing one.
- **Trust is unchanged.** npm scope ownership is the boundary the rule actually
  rests on, and a suffix does not cross it. Whoever can publish
  `@bpmnkit/docspack` can publish `@bpmnkit/camunda-docspack` and nobody else
  can. Both are trusted for the same reason.
- **Enumeration is already in the design.** `@docspack-community/<name>` is
  discovered by matching a shape rather than deriving one name. This asks for the
  same operation inside a scope the vendor owns, where the trust argument is
  *stronger* than in the open community scope.
- **Derivation keeps working where it is needed.** Inferring `@bpmnkit/docspack`
  from a dependency on `@bpmnkit/core` — to suggest installing it — only ever
  made sense for the canonical name, and this does not change it. *Derive to
  suggest; match to discover.* The two do not have to be the same rule.
- **Cost:** one pattern match instead of one string compare. No migration: every
  existing pack keeps working, and a vendor with one pack sees no difference.

### 2. Or: let the consumer name extra packs — acceptable fallback

If the naming rule should not move, let the project owner opt in:

```json
{
  "docspack": {
    "packs": ["@bpmnkit/camunda-docspack"]
  }
}
```

Safe by construction — the consumer chooses what enters their agent's context,
and nothing is discovered that was not asked for. The cost is a line of setup per
project, and no help for an agent that arrives at a repo without it. We would
take this over the status quo.

### 3. Not this: a `docspack` key as the marker

For completeness, since it is the obvious suggestion and we think it is wrong:
treat any installed package carrying a `docspack` field and a
`.llms/manifest.json` as a pack. It is offline, it is cheap, and `sync` already
opens every dependency's `package.json`.

It is also a supply-chain regression. Today only a scope owner can put content in
front of a model. Under a field check, any transitive dependency at any depth
could declare itself documentation and be indexed as trusted. The name check is
doing real security work and should not be traded for convenience. We raise it
only so it is visibly considered rather than overlooked.

### 4. Regardless of the above: say when a pack is installed but not indexed

This one is worth doing even if all three proposals are rejected, and it is the
change we would most like to see.

A package that ships `.llms/manifest.json` with a name outside the discoverable
shapes is nearly always a mistake — a typo, a rename, or a publisher who read the
naming rule the way we did. Today it produces no error, no warning, and no
`problems` entry; it is filed under `declarations` with `0 chunks` and the
corpus is silently absent from every answer.

Suggested behaviour: `sync` and `list` name the package, the chunk count its
manifest declares, and why it was not indexed.

```
! @acme/extra-docspack@1.0.0  2 chunks in .llms/manifest.json, not indexed
    The name is not a discoverable pack shape (@vendor/docspack or
    @docspack-community/<name>), so the payload was skipped.
```

And `doctor` — which checks a package "the way the indexer would" — should fail,
or at least warn, when the name it is given is one the indexer will not accept.
It currently reports `ok` on a package nothing can read.

A one-line `--name` check in `doctor` and one `problems` entry in `sync` would
between them have turned this whole document into a five-minute fix on our side.

Silence here is what turns a naming disagreement into a wrong answer.

---

## What we shipped in the meantime

We could not leave our users with commands that return the wrong corpus, so
`@bpmnkit/docspack`'s bundled reader (`bpmnkit-docs`) implements proposal 1
locally: within each scope it accepts `docspack` and `*-docspack`. It stays a
pure name check inside a scope the vendor owns, so the trust argument above holds
unchanged.

This is a divergence from the spec and we would rather not carry it. We will drop
it the day upstream supports the shape, and we have documented the caveat so our
users know the Camunda pack is reachable through `bpmnkit-docs` and not through
`docspack`. Flagging it here rather than quietly maintaining a fork: if the
answer is no, we would rather hear it and take option 2 or 3.

---

## Reproduction

Self-contained — no BPMN Kit packages needed. Two packs in one scope, both built
by `docspack build`:

```sh
mkdir docspack-scope-repro && cd docspack-scope-repro
npm init -y && npm i -D docspack@1.1.0

for NAME in docspack extra-docspack; do
  mkdir -p "src-$NAME" "node_modules/@acme/$NAME"
  cat > "src-$NAME/guide.md" <<EOF
# $NAME guide

## Retry policy in $NAME

A failed job is retried three times with an exponential backoff, then routed to
the dead-letter queue \`dlq.$NAME\` for an operator to inspect and replay.
EOF
  echo "{\"name\":\"@acme/$NAME\",\"version\":\"1.0.0\",\"files\":[\"llms.txt\",\".llms\"]}" \
    > "node_modules/@acme/$NAME/package.json"
  npx docspack build --from "src-$NAME" --name "@acme/$NAME" \
    --pkg-version 1.0.0 --out "node_modules/@acme/$NAME"
  npx docspack doctor --cwd "node_modules/@acme/$NAME"      # ok, both
done

npm pkg set devDependencies.@acme/docspack=1.0.0 \
            devDependencies.@acme/extra-docspack=1.0.0

npx docspack sync  --store ./store.db          # extra-docspack read, then dropped
npx docspack list  --store ./store.db --json   # "problems": []
npx docspack ask   --store ./store.db "dead letter queue dlq.extra-docspack retry"
```

Expected: the answer comes from `@acme/extra-docspack`, or the tool says why it
cannot. Actual: `@acme/docspack`'s chunk, naming a different queue, exit 0.

## Summary

One pack per scope is a good rule for a vendor documenting its own products. It
breaks for a vendor that also **redistributes somebody else's documentation**,
where licence, version, cadence and attribution all belong to a different
upstream and cannot be merged into one package. That case has no spec-legal home
today that does not either misattribute the content or mislabel it as untrusted.

`@<vendor>/<name>-docspack` solves it while keeping every property the rule
protects — offline, no registry call, a function of `package.json`, and trusted
through scope ownership. Failing that, an explicit opt-in works. Failing both,
please at least make the current behaviour say something.
