interface StatusPillProps {
	state: string
}

const STATE_CONFIG: Record<
	string,
	{ label: string; tone: "success" | "muted" | "danger" | "warn" }
> = {
	ACTIVE: { label: "Active", tone: "success" },
	COMPLETED: { label: "Completed", tone: "muted" },
	INCIDENT: { label: "Incident", tone: "danger" },
	TERMINATED: { label: "Terminated", tone: "muted" },
	CANCELED: { label: "Canceled", tone: "muted" },
	FAILED: { label: "Failed", tone: "danger" },
	RESOLVED: { label: "Resolved", tone: "muted" },
	PENDING: { label: "Pending", tone: "warn" },
}

/**
 * A state readout, which the design system sets in mono and tints rather than
 * fills — a column of filled pills reads as a column of buttons.
 */
export function StatusPill({ state }: StatusPillProps) {
	const config = STATE_CONFIG[state] ?? { label: state, tone: "muted" as const }
	return (
		<span className={config.tone === "muted" ? "ds-mark" : `ds-mark ds-mark--${config.tone}`}>
			{config.label}
		</span>
	)
}
