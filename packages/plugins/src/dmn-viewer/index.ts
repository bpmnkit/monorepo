/**
 * @bpmn-sdk/canvas-plugin-dmn-viewer — DMN decision table viewer.
 *
 * Provides a standalone `DmnViewer` class that renders a DMN decision table
 * as an HTML table with FEEL syntax highlighting.
 *
 * @packageDocumentation
 */

export { DmnViewer } from "./dmn-viewer.js";
export type { DmnViewerOptions } from "./dmn-viewer.js";
export { tokenizeFeel, highlightFeel } from "./feel.js";
export type { FeelToken, FeelTokenType } from "./feel.js";
export { DMN_VIEWER_CSS, injectDmnViewerStyles } from "./css.js";
