# Accessibility

bpmnkit's viewer (`@bpmnkit/canvas`) and editor (`@bpmnkit/editor`) are built to
be usable with assistive technology and keyboard-only, and deliberately keep a
lead over bpmn.io in this area.

## Semantics (canvas)

Every rendered element carries an ARIA role and an accessible name derived from
its BPMN label (falling back to its type):

| Element | `role` | Name source |
| --- | --- | --- |
| Task / event / gateway | `button` | element `name` → type |
| Pool / lane | `region` | participant/lane name |
| Text annotation | `note` | annotation text |
| Data object / store | `img` | element `name` |
| Group | `group` | category value |
| Drill-down affordance | `button` | "Open sub-process" |

Expandable containers (sub-process, ad-hoc sub-process, event sub-process,
transaction, call activity) expose **`aria-expanded`** reflecting their
collapsed/expanded state, so screen-reader users can tell a collapsed
sub-process (with a drill-down) from an expanded one.

## Keyboard & focus (editor)

- The editor host is focusable (`role="application"`, `tabindex="0"`) and shows a
  **distinct keyboard-focus ring** (`:focus-visible`, a dashed `accent-bright`
  outline) that is visually different from the solid selection outline — so
  "which element is selected" and "where is keyboard focus" never look the same.
- All primary actions have keyboard shortcuts (see the in-app **Keyboard
  shortcuts** panel): undo/redo, delete, select-all, copy/cut/paste, duplicate,
  find, command palette, sidebar toggle.

## Announcements (editor)

The editor mounts a visually-hidden `aria-live="polite"` region (the SVG itself
is `aria-hidden`, so this is the channel to AT). It announces:

- **Selection** — `"<name> selected"` for a single element, `"<n> elements
  selected"` for a multi-selection.
- **Edit results** — the command label of every mutation (`"Delete"`, `"Move"`,
  `"Resize"`, `"Connect"`, `"Paste"`, `"Align left"`, `"Change type"`, …).

## Localization

All HUD strings — including the live-region announcements above — pass through
the injectable `translate` hook (`EditorOptions.translate`), so an application
can localize both the visible UI and screen-reader output. See the i18n note in
`render-gap-analysis.md` (P3-1).

## Touch / coarse pointers

On coarse pointers (`@media (pointer: coarse)`) the editor enlarges drag targets
to finger size — resize handles grow to 24px and connection/endpoint/waypoint
dots to a 12px radius. A **long-press** opens the context menu and a
**double-tap** on a shape starts label editing, so the core editing gestures work
without a mouse.

## Known gaps

- SVG element roles are exposed by the **viewer**; the **editor** marks its SVG
  `aria-hidden` and drives AT through the live region instead. Direct
  element-by-element keyboard traversal of the editor canvas is not yet wired.
- A real-device Playwright touch-emulation smoke test is not yet set up (the repo
  has no Playwright harness); touch behavior is covered by unit tests.
