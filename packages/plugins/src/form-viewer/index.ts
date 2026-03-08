/**
 * @bpmn-sdk/canvas-plugin-form-viewer — read-only Camunda Form viewer.
 *
 * Renders all Camunda Form component types as a static HTML preview.
 * Built entirely in-repo — no dependency on @bpmn-io/form-js.
 *
 * @packageDocumentation
 */

export { FormViewer } from "./form-viewer.js";
export type { FormViewerOptions } from "./form-viewer.js";
export { FORM_VIEWER_CSS, injectFormViewerStyles } from "./css.js";
