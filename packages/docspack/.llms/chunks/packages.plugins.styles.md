# @bpmnkit/plugins — Styles

Plugins that render their own UI export their CSS as a string and an injector — for example
`FORM_VIEWER_CSS` and `injectFormViewerStyles` from `form-viewer`. The injectors are
id-guarded, so calling one twice is free, and a host that would rather ship the CSS itself can
take the string instead.

Brand colours come from `@bpmnkit/ui` tokens with hex fallbacks, so a plugin looks right
standalone and themes correctly inside an app that sets them.


## Stability

`@bpmnkit/plugins` carries the [1.0 stability promise](/docs/getting-started/stability): the
entry points listed above, and the exports and option types they name, will not change shape
without a major version.

Two clarifications, because a plugin package is where the edges are:

- **Adding a plugin is a minor.** A new entry point breaks nobody.
- **Rendered DOM and class names are not API.** How a panel is laid out, which elements it
  builds, and the class names inside it are presentation. Style through the documented CSS
  custom properties rather than by reaching into the markup.

---
Source: https://bpmnkit.com/docs/packages/plugins
