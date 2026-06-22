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
		<div className="flex flex-col items-center justify-center h-full gap-5 text-center p-8">
			<div className="rounded-full bg-danger/10 p-3.5">
				<AlertTriangle size={22} className="text-danger" />
			</div>
			<div className="max-w-xs">
				<h2 className="text-base font-semibold text-fg">{title}</h2>
				<p className="text-sm text-muted mt-1.5 leading-relaxed">{description}</p>
				{hint && (
					<code className="mt-3 block rounded-md bg-surface-2 border border-border px-3 py-2 text-xs font-mono text-muted text-left">
						{hint}
					</code>
				)}
			</div>
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
