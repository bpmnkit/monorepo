import type { PanelRunResult } from "./sources.js"

export function buildDurationBanner(withSdk: PanelRunResult, withoutSdk: PanelRunResult): string {
	const withSdkMs = withSdk.durationMs
	const withoutSdkMs = withoutSdk.durationMs

	const [fasterLabel, fasterMs, slowerLabel, slowerMs] =
		withSdkMs <= withoutSdkMs
			? (["With SDK", withSdkMs, "Without SDK", withoutSdkMs] as const)
			: (["Without SDK", withoutSdkMs, "With SDK", withSdkMs] as const)

	const ratio = fasterMs > 0 ? (slowerMs / fasterMs).toFixed(1) : "—"

	return (
		`With SDK: ${(withSdkMs / 1000).toFixed(1)}s · ` +
		`Without SDK: ${(withoutSdkMs / 1000).toFixed(1)}s · ` +
		`${fasterLabel} was ${ratio}× faster than ${slowerLabel}`
	)
}
