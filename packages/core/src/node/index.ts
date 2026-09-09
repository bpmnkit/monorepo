/**
 * Node-only entry point.
 *
 * Everything here touches the filesystem, so it lives behind the
 * `@bpmnkit/core/node` subpath. Importing `@bpmnkit/core` itself stays free of
 * `node:` builtins and keeps working in browsers, workers and edge runtimes.
 */
export { writeBpmn } from "./write.js"
export type { WriteBpmnOptions, WriteBpmnResult } from "./write.js"
