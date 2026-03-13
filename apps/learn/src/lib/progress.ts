import type { AllProgress, TutorialProgress } from "./types.js"

const KEY = "bpmn_learn_progress"

export function loadAllProgress(): AllProgress {
	try {
		const raw = localStorage.getItem(KEY)
		return raw ? (JSON.parse(raw) as AllProgress) : {}
	} catch {
		return {}
	}
}

export function loadProgress(tutorialId: string): TutorialProgress | null {
	const all = loadAllProgress()
	return all[tutorialId] ?? null
}

export function saveProgress(tutorialId: string, progress: TutorialProgress): void {
	const all = loadAllProgress()
	all[tutorialId] = { ...progress, lastActivityAt: new Date().toISOString() }
	try {
		localStorage.setItem(KEY, JSON.stringify(all))
	} catch {
		// ignore storage errors
	}
}

export function markStepComplete(tutorialId: string, stepIndex: number, totalSteps: number): void {
	const existing = loadProgress(tutorialId) ?? {
		currentStep: 0,
		completedSteps: [],
		startedAt: new Date().toISOString(),
		lastActivityAt: new Date().toISOString(),
	}
	const completedSteps = Array.from(new Set([...existing.completedSteps, stepIndex]))
	const nextStep = stepIndex + 1 < totalSteps ? stepIndex + 1 : stepIndex
	saveProgress(tutorialId, { ...existing, currentStep: nextStep, completedSteps })
}

export function saveCanvasXml(tutorialId: string, xml: string): void {
	const existing = loadProgress(tutorialId)
	if (existing) {
		saveProgress(tutorialId, { ...existing, savedXml: xml })
	}
}

export function resetProgress(tutorialId: string): void {
	const all = loadAllProgress()
	const updated: AllProgress = {}
	for (const [k, v] of Object.entries(all)) {
		if (k !== tutorialId) updated[k] = v
	}
	try {
		localStorage.setItem(KEY, JSON.stringify(updated))
	} catch {
		// ignore
	}
}

export function getTutorialStatus(
	tutorialId: string,
	totalSteps: number,
): "not-started" | "in-progress" | "completed" {
	const p = loadProgress(tutorialId)
	if (!p) return "not-started"
	if (p.completedSteps.length >= totalSteps) return "completed"
	return "in-progress"
}
