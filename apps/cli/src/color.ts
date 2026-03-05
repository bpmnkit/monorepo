/**
 * ANSI color helpers. Auto-disabled when:
 *  - NO_COLOR env var is set
 *  - stdout is not a TTY (piped output)
 *  - --no-color flag is passed (checked externally via isEnabled)
 */

const ESC = "\x1b[";

function wrap(code: string, reset: string) {
	return (text: string, enabled: boolean) =>
		enabled ? `${ESC}${code}m${text}${ESC}${reset}m` : text;
}

export const bold = wrap("1", "22");
export const dim = wrap("2", "22");
export const italic = wrap("3", "23");

export const red = wrap("31", "39");
export const green = wrap("32", "39");
export const yellow = wrap("33", "39");
export const blue = wrap("34", "39");
export const magenta = wrap("35", "39");
export const cyan = wrap("36", "39");
export const white = wrap("37", "39");

/** Check if colors should be enabled given env + TTY state. */
export function shouldUseColor(noColorFlag: boolean): boolean {
	if (noColorFlag) return false;
	if (process.env.NO_COLOR !== undefined) return false;
	if (process.env.FORCE_COLOR !== undefined) return true;
	return process.stdout.isTTY === true;
}

/** Produce a state-colored string for Camunda entity states. */
export function stateColor(state: string, enabled: boolean): string {
	switch (state.toUpperCase()) {
		case "ACTIVE":
		case "EVALUATED":
		case "COMPLETED":
			return green(state, enabled);
		case "TERMINATED":
		case "FAILED":
		case "CANCELED":
		case "REJECTED":
			return red(state, enabled);
		case "SUSPENDED":
		case "INCIDENT":
			return yellow(state, enabled);
		default:
			return state;
	}
}
