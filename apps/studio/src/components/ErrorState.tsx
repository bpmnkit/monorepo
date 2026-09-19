import { AlertTriangle, RefreshCw, Settings } from "lucide-react"
import { useLocation } from "wouter"
import { Button } from "./ui/button.js"

interface ErrorStateProps {
	title: string
	description: string
	/** Shell command displayed in a code block as a quick fix hint. */
	hint?: string
	onRetry?: () => void
	/** Show a link to the Settings page. */
	settingsHint?: boolean
}

export function ErrorState({ title, description, hint, onRetry, settingsHint }: ErrorStateProps) {
	const [, navigate] = useLocation()
	return (
		<div className="ds-empty h-full">
			<AlertTriangle size={22} className="text-danger" />
			<div className="max-w-sm">
				<h2 className="ds-title text-base">{title}</h2>
				<p className="ds-lede mt-1.5">{description}</p>
			</div>
			{hint && <code className="ds-code w-full max-w-sm text-left">{hint}</code>}
			<div className="flex items-center gap-2">
				{onRetry && (
					<Button variant="outline" size="sm" onClick={onRetry}>
						<RefreshCw size={13} />
						Retry
					</Button>
				)}
				{settingsHint && (
					<Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
						<Settings size={13} />
						Settings
					</Button>
				)}
			</div>
		</div>
	)
}
