# @bpmnkit/markdown

## 0.1.0

### Minor Changes

- 56ad670: New package: real BPMN diagrams in Markdown. Fenced ` ```bpmn ` (BPMN 2.0 XML, laid out
  automatically when it has no DI) and ` ```bpmn-compact ` / ` ```bpmn-json ` (compact JSON) blocks
  render to inline SVG at build time — themed from the page's `--bpmnkit-*` tokens or the reader's
  colour scheme, labelled for screen readers with the process name and its steps, and drawn as a
  readable error box instead of breaking the build when a block does not parse.

  One function, `renderBpmnBlock()`, with thin adapters over it: `remarkBpmn` (Astro, Docusaurus,
  Next.js MDX — it emits hast, so MDX renders it too), `markdownItBpmn` (VitePress),
  `renderBpmnInHtml` for plain HTML pipelines, and the `bpmnkit-md` CLI, which pre-renders the
  blocks of a README to committed SVG files between markers, idempotently, with `--check` for CI.
  No dependencies beyond `@bpmnkit/core`.

### Patch Changes

- 56ad670: Each README now shows the package's product tier (Core, Tools or Experimental) and what that tier promises. The `@bpmnkit/reebe-wasm` README and description say that Reebe is a dev/test engine, not for production: a clean-room implementation of the Zeebe API, not affiliated with Camunda.
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
  - @bpmnkit/core@1.1.0
