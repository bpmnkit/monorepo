# Stability and Versioning — What is a breaking change

### Runtime behaviour

Breaking: removing or renaming an export or an entry point; removing a function parameter or
making an optional one required; throwing where a value used to be returned; changing a
documented default.

### Types

Type-level breakage is real breakage: a build that no longer compiles is a broken build. The
direction matters, and it is the opposite for things we hand you and things you hand us.

| Change | Verdict |
|---|---|
| Adding an export, or a new entry point | minor |
| Adding an **optional** property to an options object | minor |
| Adding a member to a union we **accept** | minor |
| Adding a member to a union we **return** | **major** — your exhaustive `switch` stops compiling |
| Adding a **required** property to anything you construct | **major** |
| Making a returned property optional | **major** — you now have to narrow it |
| Narrowing a return type | **major** |
| Widening a parameter type | minor |
| Renaming an exported type | **major**, even when the shape is identical |

### Generated BPMN, DMN and Form documents

This is the promise that matters most here, and the one a general semver policy has nothing
to say about. The rule is:

> **A change is breaking if it moves `semanticHash` for the same input. A change to the bytes
> alone is not.**

`semanticHash` is BPMN Kit's canonical, presentation-free projection of a model, and it is
exported for exactly this purpose. Verified against the current build:

| Property | Holds |
|---|---|
| The same input rebuilt produces the same hash | ✅ |
| `applyAutoLayout` does not move it | ✅ |
| Renaming an element moves it | ✅ |
| Changing an element **id** moves it | ✅ |

So, concretely:

- **Major** — different element ids, a changed document structure, a different default
  attribute on an emitted element, a changed FEEL expression. Anyone diffing generated files
  in review, or deploying them by id, sees these.
- **Minor or patch** — different layout coordinates, different attribute order, different
  whitespace, a nicer waypoint route. The picture moved; the model did not.

For the avoidance of doubt about precedent: `@bpmnkit/core` 0.4.0 derived element ids from the
model instead of generating them randomly. That moved `semanticHash` for every document, and
shipped as a *minor*. Under this policy it is a major, and 0.x is the only reason it was not.

### Formats outside the package

These are contracts even though no TypeScript signature describes them, and the same rule
applies — a change that makes an existing file, store or caller stop working is major:

- The **`.bpmn.tests.json` sidecar** read by `casen test` and the runner's Tests tab.
- **Profile storage on disk** — `~/.config/casen` on Linux, `~/Library/Application Support/casen`
  on macOS, `%APPDATA%\casen` on Windows. A format change must migrate existing profiles, not
  invalidate them.
- The **`@bpmnkit/proxy` HTTP surface**, for the routes the documentation names.
- **Element template validation** — a template that validates today does not start failing in
  a minor.

---
Source: https://bpmnkit.com/docs/getting-started/stability
