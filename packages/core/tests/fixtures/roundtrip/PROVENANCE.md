# Round-trip corpus — provenance

Fixtures consumed by `tests/roundtrip-corpus.test.ts`. Every `.bpmn` file in this
directory is picked up automatically; adding one requires no code change, only an entry in
that test's `ALLOWED` map (an empty array if the file round-trips cleanly).

Record every file here before committing it. A fixture with no row below is a licensing
question nobody can answer later.

## Current corpus

| File | Source | Terms | Added |
|---|---|---|---|
| `01-root-elements.bpmn` | Written for this repository | MIT, with the repository | 2026-09-07 |
| `02-collaboration.bpmn` | Written for this repository | MIT, with the repository | 2026-09-07 |
| `03-data-elements.bpmn` | Written for this repository | MIT, with the repository | 2026-09-07 |
| `04-artifacts.bpmn` | Written for this repository | MIT, with the repository | 2026-09-07 |
| `05-zeebe-extensions.bpmn` | Written for this repository | MIT, with the repository | 2026-09-07 |
| `06-events-and-containers.bpmn` | Written for this repository | MIT, with the repository | 2026-09-07 |

| `miwg-*.bpmn` (22 files) | The `Reference/` models of the [OMG BPMN Model Interchange Working Group test suite](https://github.com/bpmn-miwg/bpmn-miwg-test-suite), commit `2ff82d4` (2026-09-21), copied unmodified with a `miwg-` prefix | [CC BY 3.0](http://creativecommons.org/licenses/by/3.0/) — © the BPMN MIWG contributors; see the suite's `LICENSE.txt`. Test data only: not part of any published package | 2026-09-24 |

These were authored from the BPMN 2.0 specification and the `zeebe-bpmn-moddle` descriptor
(MIT), targeting the constructs `doc/bpmn-sdk-comparison.md` §4 measured as lost plus the
full surface `bpmn-parser.ts` claims to handle. They are **not** derived from any other
project's test suite.

Each file isolates a group of constructs, so a failure names its own cause:

| File | Covers |
|---|---|
| `01-root-elements.bpmn` | root `message` / `error` / `escalation` / `signal`, `zeebe:subscription`, documentation at definitions and process level, `zeebe:versionTag` |
| `02-collaboration.bpmn` | participants (including a black-box pool), message flows, lanes and `flowNodeRef`, collaboration-level extensions, a non-executable process |
| `03-data-elements.bpmn` | data objects, object and store references, `dataInputAssociation` / `dataOutputAssociation`, `bpmn:property` |
| `04-artifacts.bpmn` | text annotations, associations, groups, `category` / `categoryValue`, task documentation |
| `05-zeebe-extensions.bpmn` | the Zeebe task surface — task definition, IO mapping, headers, properties, form, called decision, called element, script, user task, assignment, schedule, priority |
| `06-events-and-containers.bpmn` | every event definition kind, interrupting and non-interrupting boundaries, event sub-process, multi-instance loop with cardinality and completion condition, an exclusive gateway with a default flow, and diagram interchange |

### The MIWG reference models

The MIWG suite is the standard way BPMN tools prove interchange. Its reference models
(`A.*` layout, `B.*` conformance-class coverage, `C.*` complex scenarios) were exported by
Trisotech, Signavio, W4, BOC and other modelers, so they carry the vendor namespaces,
label styles and optional-attribute spellings a real file does. The suite checks that a
tool can import a model and export it again without losing content; here the same check
is the round-trip gate above, keyed by namespace so prefix choices do not count as a
change. Remaining differences are listed per file in `ALLOWED`. Refresh them from a new
suite commit by copying `Reference/*.bpmn` again and updating the commit above.

## Adding real-world models

A hand-written corpus only contains constructs someone thought of. Real files from Camunda
Web Modeler, the blueprint marketplace or a customer project are what catch the rest — the
losses in §4 of `doc/bpmn-sdk-comparison.md` were found exactly that way.

Before adding one:

1. **Check the terms.** Camunda marketplace blueprints, vendor samples and customer models
   each carry their own; "publicly downloadable" is not a licence. Confirm redistribution is
   permitted under terms compatible with this repository's MIT licence.
2. **Add a row above** with the exact source URL, the terms, and the date retrieved.
3. **Strip anything sensitive** — real endpoints, tenant identifiers, credentials in task
   headers, personal names in assignees or documentation.
4. **Run the suite and record the result.** New losses show up as failures; each one is
   either a fix or a new `ALLOWED` entry with a reason.

Do not copy fixtures out of another project's test suite. Take them from the original
source, so the terms are the ones you actually checked.
