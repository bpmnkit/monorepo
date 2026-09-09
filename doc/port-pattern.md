# The port pattern

How a canvas plugin talks to the application hosting it, without knowing what that
application is.

BPMN Kit now runs the same plugins in four places — the studio, the desktop app, Drop, and
(per [`doc/roadmap.md`](roadmap.md)) a VS Code extension. They disagree about almost
everything: what a file is, where templates come from, whether there is a filesystem, what
"open this" means. A plugin that knew any of that would work in one of them.

The rule is one sentence: **a plugin computes what it can from the model, and takes everything
else as an injected function.** That injected function is a *port*.

The pattern is not invented here. `Miragon/bpmn-modeler` runs one modeler core in VS Code,
Theia and IntelliJ, and their `CodeLinkPort` / `ModelNavigationPort` / `InlineScriptingPort` are
why — see [`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md).

---

## The shape

`@bpmnkit/plugins/model-navigation` is the worked example. A Call Activity names a process, a
Business Rule Task names a decision, a User Task names a form. Following one means opening a
file — and a canvas has no idea what a file is.

So the plugin splits the problem at the line where host knowledge starts:

```typescript
/** What an element points at, as the model states it. Pure model reading. */
export interface ModelReference {
	elementId: string
	kind: "process" | "decision" | "form"
	ref: string
}

/** The host's half. */
export interface ReferencePort {
	open(reference: ModelReference): void
	resolve?(references: readonly ModelReference[]): Promise<readonly string[]> | readonly string[]
}
```

The plugin reads `zeebe:calledElement`, `zeebe:calledDecision` and `zeebe:formDefinition` —
model work, identical everywhere. The host answers "does that resolve, and what happens when
someone follows it" — different in every surface. Neither knows how the other does its job.

```typescript
// studio: a row in IndexedDB
createModelNavigationPlugin({
	port: {
		open: (ref) => navigate(`/models/${findModelIdByProcessId(ref.ref)}`),
		resolve: (refs) => refs.filter((r) => modelsStore.has(r.ref)).map((r) => r.elementId),
	},
})

// drop: another file in the same share
createModelNavigationPlugin({
	port: { open: (ref) => showTab(ref.ref), resolve: (refs) => refs.filter(inThisDrop) },
})

// an editor extension: a path on disk, resolved in the extension host
createModelNavigationPlugin({
	port: { open: (ref) => post({ type: "open", ref }), resolve: (refs) => post({ type: "resolve", refs }) },
})
```

## Four rules

**1. The port takes model data, never host data.** `open(reference)` passes what the *model*
said. A port that took a file path would mean the plugin knew about paths, and the split would
already have failed.

**2. Optional means "assume it works".** `resolve` is optional, and a host that omits it gets
every syntactically valid reference treated as available. A port whose absence disables the
feature is not optional, it is required with extra steps.

**3. Optimistic, then corrected.** Affordances appear as soon as the model has them and are
withdrawn only once the host says otherwise. Waiting for the host means every diagram shows
its links late; assuming means being wrong for one round trip. Late is worse, because it
happens every time.

**4. A late answer is discarded, not applied.** Ports are usually async and diagrams change
underneath them. Every plugin here stamps a generation before it asks and drops the answer if
the diagram moved on — otherwise a stale "nothing resolves" silently strips a diagram it was
never about.

## Ports in this repo

| Plugin | Port | The host knows |
|---|---|---|
| `model-navigation` | `ReferencePort` | what a file is, and whether one exists |
| `lint` | `onReport(report)` | where findings belong — a problems panel, CI, a list |
| `diff` | `onDiff(result)` | how to present a change summary |
| `connector-catalog` | `TemplateRegistrar`, `workspaceTemplates`, `workspaceRoot` | where a project's templates come from |
| `flow-navigation` | `onMove(elementId)` | whether anything else should follow the cursor |
| `process-runner`, `ai-bridge` | `proxyUrl` | where a local service lives |

A callback is a port with one method. It counts, and it is usually the right size.

## Two shapes that are not ports

**A callback that hands back host objects.** `onSelect(vscodeUri)` binds the plugin to a host,
whatever its name suggests.

**A capability flag.** `if (options.isVsCode)` is a plugin with two implementations and no
seam. If behaviour must differ, the difference belongs behind a function the host supplies.

## Where the seam sits for a data result

A plugin that produces data a host consumes has a second decision: what shape crosses the
boundary. `@bpmnkit/plugins/lint` reports a `LintReport` from
[`lintDiagram`](../packages/core/src/bpmn/lint.ts) rather than the optimizer's own
`OptimizationFinding`, because a finding carries an `applyFix` **function** and cannot cross a
`postMessage` or a JSON boundary — which is exactly the boundary an editor extension sits
behind. A `LintDiagnostic` says `fixable: true` instead and leaves the fix where it can still
be called.

The rule generalises: **anything a host might forward should be plain data.** If it must be
serialisable, make it serialisable at the seam, not at the third call site that discovers it
is not.

## Testing a port

A port makes a plugin testable without a host: pass a fake, assert what the plugin asked for.
Every port test in `packages/plugins/tests/` does this — the interesting assertions are that
the plugin declined to call the port (an element with no reference), and that it ignored an
answer arriving after the diagram changed.
