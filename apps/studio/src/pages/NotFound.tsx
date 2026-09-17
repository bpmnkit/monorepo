import { Link } from "wouter"

export function NotFound() {
	return (
		<div className="ds-empty h-full">
			<span className="ds-datum text-5xl text-muted">404</span>
			<div>
				<p className="ds-title">Page not found</p>
				<p className="ds-lede mt-1">The page you're looking for doesn't exist.</p>
			</div>
			<Link href="/" className="text-accent text-sm hover:underline">
				← Back to Dashboard
			</Link>
		</div>
	)
}
