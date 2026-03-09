/** Options for renderBpmnAscii(). */
export interface RenderOptions {
	/**
	 * Process name shown as a header above the diagram.
	 * Pass `false` to suppress the header entirely.
	 * Defaults to the process name from the BPMN XML.
	 */
	title?: string | false
}
