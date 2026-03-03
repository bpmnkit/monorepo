import type { BpmnTimerEventDefinition } from "@bpmn-sdk/core";

/**
 * Schedule a timer from a BPMN timer event definition.
 * Supports ISO 8601 durations (PT2M), dates (2025-06-01T00:00:00Z),
 * and cycles (R3/PT5S — fires N times or indefinitely when R/...).
 * Returns a cancel function.
 */
export function scheduleTimer(def: BpmnTimerEventDefinition, callback: () => void): () => void {
	if (def.timeDuration !== undefined) {
		return scheduleAfterDuration(def.timeDuration, callback);
	}
	if (def.timeDate !== undefined) {
		return scheduleAtDate(def.timeDate, callback);
	}
	if (def.timeCycle !== undefined) {
		return scheduleCycle(def.timeCycle, callback);
	}
	// No timer definition — fire immediately
	const id = setTimeout(callback, 0);
	return () => clearTimeout(id);
}

function scheduleAfterDuration(duration: string, cb: () => void): () => void {
	const ms = parseDurationMs(duration);
	const id = setTimeout(cb, ms);
	return () => clearTimeout(id);
}

function scheduleAtDate(dateStr: string, cb: () => void): () => void {
	const target = new Date(dateStr).getTime();
	const ms = Math.max(0, target - Date.now());
	const id = setTimeout(cb, ms);
	return () => clearTimeout(id);
}

function scheduleCycle(cycle: string, cb: () => void): () => void {
	// Format: R<n>/<duration> or R/<duration> (infinite) or just <duration>
	const cycleMatch = /^R(\d*)\/(.+)$/.exec(cycle);
	if (cycleMatch === null) {
		return scheduleAfterDuration(cycle, cb);
	}
	const countStr = cycleMatch[1];
	const durationStr = cycleMatch[2] ?? "";
	const maxFires =
		countStr === "" || countStr === undefined ? Number.POSITIVE_INFINITY : Number(countStr);
	const ms = parseDurationMs(durationStr);

	let fired = 0;
	let cancelled = false;
	let timerId: ReturnType<typeof setTimeout> | undefined;

	const fire = (): void => {
		if (cancelled) return;
		cb();
		fired++;
		if (fired < maxFires) {
			timerId = setTimeout(fire, ms);
		}
	};

	timerId = setTimeout(fire, ms);
	return () => {
		cancelled = true;
		if (timerId !== undefined) clearTimeout(timerId);
	};
}

/**
 * Parse an ISO 8601 duration string into milliseconds.
 * Handles: PT#S, PT#M, PT#H, P#D, P#W, and combinations.
 */
export function parseDurationMs(duration: string): number {
	const re =
		/^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
	const m = re.exec(duration.trim());
	if (m === null) return 0;

	const years = Number(m[1] ?? 0);
	const months = Number(m[2] ?? 0);
	const weeks = Number(m[3] ?? 0);
	const days = Number(m[4] ?? 0);
	const hours = Number(m[5] ?? 0);
	const minutes = Number(m[6] ?? 0);
	const seconds = Number(m[7] ?? 0);

	return (
		years * 365.25 * 24 * 3600 * 1000 +
		months * 30.44 * 24 * 3600 * 1000 +
		weeks * 7 * 24 * 3600 * 1000 +
		days * 24 * 3600 * 1000 +
		hours * 3600 * 1000 +
		minutes * 60 * 1000 +
		seconds * 1000
	);
}
