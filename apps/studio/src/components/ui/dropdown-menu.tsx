import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"
import type { ComponentPropsWithoutRef } from "preact/compat"
import { forwardRef } from "preact/compat"
import { cn } from "./utils.js"

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal
export const DropdownMenuSub = DropdownMenuPrimitive.Sub
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

export const DropdownMenuSeparator = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.Separator
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn("my-1 h-px bg-border", className)}
		{...props}
	/>
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export const DropdownMenuContent = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Content
			ref={ref as unknown as React.RefObject<HTMLDivElement>}
			sideOffset={sideOffset}
			className={cn(
				"z-50 min-w-32 overflow-hidden border border-border bg-panel p-1",
				"data-[state=open]:animate-in data-[state=closed]:animate-out",
				"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
				"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
				className,
			)}
			{...props}
		/>
	</DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = "DropdownMenuContent"

export const DropdownMenuItem = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
	<DropdownMenuPrimitive.Item
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn(
			"relative flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm text-fg outline-none",
			"focus:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			inset && "pl-8",
			className,
		)}
		{...props}
	/>
))
DropdownMenuItem.displayName = "DropdownMenuItem"

export const DropdownMenuLabel = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
	<DropdownMenuPrimitive.Label
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn("ds-label px-2 py-1.5", inset && "pl-8", className)}
		{...props}
	/>
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

export const DropdownMenuCheckboxItem = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
	<DropdownMenuPrimitive.CheckboxItem
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn(
			"relative flex cursor-pointer select-none items-center py-1.5 pl-8 pr-2 text-sm text-fg outline-none",
			"focus:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			className,
		)}
		checked={checked}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<DropdownMenuPrimitive.ItemIndicator>
				<Check size={12} />
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

export const DropdownMenuRadioItem = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
	<DropdownMenuPrimitive.RadioItem
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn(
			"relative flex cursor-pointer select-none items-center py-1.5 pl-8 pr-2 text-sm text-fg outline-none",
			"focus:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<DropdownMenuPrimitive.ItemIndicator>
				<Circle size={8} fill="currentColor" />
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

export const DropdownMenuSubTrigger = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
	<DropdownMenuPrimitive.SubTrigger
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn(
			"flex cursor-default select-none items-center gap-2 px-2 py-1.5 text-sm text-fg outline-none focus:bg-surface-2",
			inset && "pl-8",
			className,
		)}
		{...props}
	>
		{children}
		<ChevronRight size={14} className="ml-auto" />
	</DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger"

export const DropdownMenuSubContent = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.SubContent
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn(
			"z-50 min-w-32 overflow-hidden border border-border bg-panel p-1",
			"data-[state=open]:animate-in data-[state=closed]:animate-out",
			className,
		)}
		{...props}
	/>
))
DropdownMenuSubContent.displayName = "DropdownMenuSubContent"
