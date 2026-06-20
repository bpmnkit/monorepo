import { Badge as CascivoBadge, type BadgeProps as CascivoBadgeProps } from "@cascivo/react"

type StudioVariant = "default" | "success" | "warn" | "danger" | "muted"

const VARIANT_MAP: Record<StudioVariant, NonNullable<CascivoBadgeProps["variant"]>> = {
	default: "default",
	success: "success",
	warn: "warning",
	danger: "destructive",
	muted: "secondary",
}

export interface BadgeProps extends Omit<CascivoBadgeProps, "variant"> {
	variant?: StudioVariant
}

export function Badge({ variant = "default", ...props }: BadgeProps) {
	return <CascivoBadge variant={VARIANT_MAP[variant]} {...props} />
}
