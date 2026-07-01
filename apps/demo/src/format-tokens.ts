export function formatTokenCount(n: number): string {
	if (n < 1000) return String(n)
	return `${(n / 1000).toFixed(1)}k`
}
