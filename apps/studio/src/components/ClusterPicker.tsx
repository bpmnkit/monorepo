import { Link } from "wouter"
import { useClusterStore } from "../stores/cluster.js"
import { ProfileTag } from "./ProfileTag.js"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu.js"

export function ClusterPicker() {
	const { profiles, activeProfile, status, setActiveProfile } = useClusterStore()

	const statusColor =
		status === "connected" ? "bg-success" : status === "loading" ? "bg-warn" : "bg-danger"

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className="ds-datum flex items-center gap-1.5 border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
				aria-label="Select cluster profile"
			>
				<span className={`h-2 w-2 rounded-full shrink-0 ${statusColor}`} aria-hidden="true" />
				<span className="max-w-32 truncate">
					{activeProfile ?? (status === "offline" ? "No cluster" : "Select profile")}
				</span>
				<span className="text-muted">▾</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-52">
				{profiles.length === 0 ? (
					<>
						<DropdownMenuLabel>No profiles found</DropdownMenuLabel>
						<DropdownMenuSeparator />
					</>
				) : (
					<>
						<DropdownMenuLabel>Profiles</DropdownMenuLabel>
						{profiles.map((p) => (
							<DropdownMenuItem
								key={p.name}
								onSelect={() => setActiveProfile(p.name)}
								className="flex flex-col items-start gap-1 py-2"
							>
								<div className="flex w-full items-center gap-2">
									{p.name === activeProfile && (
										<span className="text-accent shrink-0" aria-label="Active">
											●
										</span>
									)}
									<span
										className={`ds-datum flex-1 truncate ${p.name === activeProfile ? "text-accent" : ""}`}
									>
										{p.name}
									</span>
								</div>
								{p.tags && p.tags.length > 0 && (
									<div className="flex flex-wrap gap-1 pl-4">
										{p.tags.map((t) => (
											<ProfileTag key={t} tag={t} />
										))}
									</div>
								)}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuItem asChild>
					<Link href="/settings" className="cursor-pointer text-muted">
						Add profile →
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
