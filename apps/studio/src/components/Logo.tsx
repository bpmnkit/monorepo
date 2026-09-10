interface LogoProps {
	className?: string
}

/**
 * The wordmark, not the logo lockup: the design system spends its one accent
 * on "kit" and has no second brand colour to give the 2026 mark.
 */
export function BpmnkitLogo({ className = "" }: LogoProps) {
	return (
		<span className={`font-bold text-fg text-lg tracking-tight ${className}`}>
			bpmn<span className="text-accent">kit</span>
		</span>
	)
}
