import type { ToastOptions } from "@cascivo/react"

// cascivo's imperative `enqueue` isn't exported — only the `useToast()` hook
// exposes it. <ToastBridge> (app.tsx) binds it here so the existing imperative
// `toast.*` call sites keep working from non-component code (stores, async
// handlers). Rendering is handled by the <ToastProvider> in app.tsx.
let enqueue: ((options: ToastOptions) => void) | null = null

export function bindToast(fn: (options: ToastOptions) => void) {
	enqueue = fn
}

export const toast = {
	success: (message: string) => enqueue?.({ title: message, variant: "success" }),
	error: (message: string) => enqueue?.({ title: message, variant: "destructive" }),
	info: (message: string) => enqueue?.({ title: message, variant: "default" }),
}
