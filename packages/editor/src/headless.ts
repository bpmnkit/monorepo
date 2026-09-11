/**
 * The editor's DOM-free surface: operations, and the ids they mint.
 *
 * `@bpmnkit/editor` itself reaches for `document` the moment it is imported —
 * it is an editor. But the part that decides *what an edit does* never touches
 * the DOM, and that part has to run in two more places: a Durable Object
 * replaying a writer's op to verify it, and a watcher applying the same op
 * without an editor loaded at all.
 *
 * So this entry exists to be importable from a Worker. Everything reachable
 * from here is pure, and the subpath keeps it that way — importing the package
 * root instead would pull the canvas in behind it.
 */
export { applyOp } from "./ops.js"
export type { EditorOp, OpResult, ShapeMove } from "./ops.js"
export { createIdFactory, genId, newIdSeed } from "./id.js"
export type { IdFactory } from "./id.js"
export { createEmptyDefinitions } from "./modeling.js"
export type { Clipboard } from "./modeling.js"
export type { CreateShapeType, PortDir } from "./types.js"
