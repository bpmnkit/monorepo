import { Button as CascivoButton, type ButtonProps as CascivoButtonProps } from "@cascivo/react"

type StudioVariant = "default" | "ghost" | "outline" | "danger"

const VARIANT_MAP: Record<StudioVariant, NonNullable<CascivoButtonProps["variant"]>> = {
	default: "primary",
	ghost: "ghost",
	outline: "secondary",
	danger: "destructive",
}

export interface ButtonProps extends Omit<CascivoButtonProps, "variant"> {
	variant?: StudioVariant
}

export function Button({ variant = "default", ...props }: ButtonProps) {
	return <CascivoButton variant={VARIANT_MAP[variant]} {...props} />
}
