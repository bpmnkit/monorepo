/**
 * `@bpmnkit/camunda-docspack` — Camunda 8 documentation as a docspack package.
 *
 * The published artefact is the `.llms/` payload; these exports are the build that produces
 * it, so the weekly workflow and the tests can drive the same code the CLI does.
 *
 * @see https://docspack.dev/spec for the package format.
 */

export { type BuildOptions, type BuildReport, build } from "./build.js"
export { bpmnToText } from "./bpmn-text.js"
export { SITE_URL, absoluteLinks } from "./links.js"
export { type StripOptions, UnknownConstructError, stripMdx } from "./mdx.js"
export { LICENCE_URL, UPSTREAM, notice } from "./notice.js"
export { type Operation, readOperations } from "./openapi.js"
export { INCLUDED, type StageOptions, type StageResult, stage } from "./stage.js"
