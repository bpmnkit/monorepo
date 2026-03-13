import type { ValidationConfig } from "./types.js"

export interface ValidationResult {
	passed: boolean
	message: string
}

/** Validate a canvas step. canvasContainer is the container element with the BpmnCanvas. */
export function validateStep(
	config: ValidationConfig,
	canvasContainer: HTMLElement | null,
): ValidationResult {
	if (config.type === "manual") {
		return { passed: true, message: config.successMessage }
	}

	if (!canvasContainer) {
		return { passed: false, message: "Canvas not ready" }
	}

	if (config.type === "bpmn-element-count") {
		const elements = canvasContainer.querySelectorAll(`[data-bpmn-type="${config.elementType}"]`)
		if (elements.length >= config.min) {
			return { passed: true, message: config.successMessage }
		}
		return { passed: false, message: config.errorMessage }
	}

	if (config.type === "bpmn-has-connection") {
		const edges = canvasContainer.querySelectorAll(".bpmn-edge")
		if (edges.length > 0) {
			return { passed: true, message: config.successMessage }
		}
		return { passed: false, message: config.errorMessage }
	}

	if (config.type === "bpmn-element-labeled") {
		const labels = canvasContainer.querySelectorAll(".bpmn-label")
		for (const label of labels) {
			if (label.textContent && label.textContent.trim().length > 0) {
				return { passed: true, message: config.successMessage }
			}
		}
		return { passed: false, message: config.errorMessage }
	}

	return { passed: false, message: "Unknown validation type" }
}
