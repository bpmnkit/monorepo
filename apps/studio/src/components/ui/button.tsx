import {
	Button as CascivoButton,
	type ButtonProps as CascivoButtonProps,
	IconButton,
} from "@cascivo/react"

type StudioVariant = "default" | "ghost" | "outline" | "danger"
type StudioSize = "sm" | "md" | "lg" | "icon"

const VARIANT_MAP: Record<StudioVariant, NonNullable<CascivoButtonProps["variant"]>> = {
	default: "primary",
	ghost: "ghost",
	outline: "secondary",
	danger: "destructive",
}

export interface ButtonProps extends Omit<CascivoButtonProps, "variant" | "size"> {
	variant?: StudioVariant
	size?: StudioSize
}

export function Button({ variant = "default", size = "md", ...props }: ButtonProps) {
	// Icon-only buttons map to cascivo's dedicated IconButton (square, label-required).
	if (size === "icon") {
		const { "aria-label": ariaLabel, children, ...rest } = props
		return (
			<IconButton
				label={typeof ariaLabel === "string" ? ariaLabel : ""}
				variant={variant === "outline" ? "outline" : "ghost"}
				size="sm"
				{...rest}
			>
				{children}
			</IconButton>
		)
	}
	return <CascivoButton variant={VARIANT_MAP[variant]} size={size} {...props} />
}
