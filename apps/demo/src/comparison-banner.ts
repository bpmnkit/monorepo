import { formatTokenCount } from "./format-tokens.js"
import type { PanelRunResult } from "./sources.js"

export function buildComparisonBanner(withSdk: PanelRunResult, withoutSdk: PanelRunResult): string {
	const withSdkMs = withSdk.durationMs
	const withoutSdkMs = withoutSdk.durationMs

	const [fasterLabel, fasterMs, slowerLabel, slowerMs] =
		withSdkMs <= withoutSdkMs
			? (["With SDK", withSdkMs, "Without SDK", withoutSdkMs] as const)
			: (["Without SDK", withoutSdkMs, "With SDK", withSdkMs] as const)

	const durationRatio = fasterMs > 0 ? (slowerMs / fasterMs).toFixed(1) : "—"

	if (!withSdk.usage || !withoutSdk.usage) {
		return (
			`With SDK: ${(withSdkMs / 1000).toFixed(1)}s · ` +
			`Without SDK: ${(withoutSdkMs / 1000).toFixed(1)}s · ` +
			`${fasterLabel} was ${durationRatio}× faster than ${slowerLabel}`
		)
	}

	const withSdkTokens = withSdk.usage.inputTokens
	const withoutSdkTokens = withoutSdk.usage.inputTokens

	const [moreLabel, moreTokens, fewerLabel, fewerTokens] =
		withSdkTokens >= withoutSdkTokens
			? (["With SDK", withSdkTokens, "Without SDK", withoutSdkTokens] as const)
			: (["Without SDK", withoutSdkTokens, "With SDK", withSdkTokens] as const)

	const tokenRatio = fewerTokens > 0 ? (moreTokens / fewerTokens).toFixed(1) : "—"

	return (
		`With SDK: ${(withSdkMs / 1000).toFixed(1)}s, ` +
		`${formatTokenCount(withSdk.usage.inputTokens)} in / ${formatTokenCount(withSdk.usage.outputTokens)} out · ` +
		`Without SDK: ${(withoutSdkMs / 1000).toFixed(1)}s, ` +
		`${formatTokenCount(withoutSdk.usage.inputTokens)} in / ${formatTokenCount(withoutSdk.usage.outputTokens)} out · ` +
		`${fasterLabel} was ${durationRatio}× faster than ${slowerLabel}, ` +
		`${moreLabel} used ${tokenRatio}× more input tokens than ${fewerLabel}`
	)
}
