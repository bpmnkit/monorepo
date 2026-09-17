import { createUserTaskWidget } from "@bpmnkit/user-tasks"
import type { UserTaskWidgetApi } from "@bpmnkit/user-tasks"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "preact/hooks"
import { useParams } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import { keys } from "../api/keys.js"
import { useUserTask } from "../api/queries.js"
import { ErrorState } from "../components/ErrorState.js"
import { useThemeStore } from "../stores/theme.js"
import { useUiStore } from "../stores/ui.js"

export function TaskDetail() {
	const { key } = useParams<{ key: string }>()
	const { data: task, isLoading, isError } = useUserTask(key)
	const widgetContainerRef = useRef<HTMLDivElement>(null)
	const widgetRef = useRef<UserTaskWidgetApi | null>(null)
	const qc = useQueryClient()
	const { theme } = useThemeStore()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		const label = task?.name || `Task ${key}`
		setBreadcrumbs([{ label: "Tasks", href: "/tasks" }, { label }])
	}, [key, task?.name, setBreadcrumbs])

	// Mount / update widget when task data arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: widget is created once per task load; key/qc/theme are stable
	useEffect(() => {
		const container = widgetContainerRef.current
		if (!container || !task) return

		// If widget already exists, update it
		if (widgetRef.current) {
			widgetRef.current.setTask(task)
			return
		}

		widgetRef.current = createUserTaskWidget({
			container,
			task,
			proxyUrl: getProxyUrl(),
			profile: getActiveProfile() ?? undefined,
			theme,
			onComplete: () => {
				void qc.invalidateQueries({ queryKey: ["tasks"] })
				void qc.invalidateQueries({ queryKey: keys.task(key) })
			},
			onClaim: () => {
				void qc.invalidateQueries({ queryKey: keys.task(key) })
			},
			onUnclaim: () => {
				void qc.invalidateQueries({ queryKey: keys.task(key) })
			},
		})

		return () => {
			widgetRef.current?.destroy()
			widgetRef.current = null
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [task])

	if (isError) {
		return (
			<ErrorState
				title="Task not found"
				description="This task may have already been completed, cancelled, or the task key is invalid."
			/>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Widget area */}
			<div className="flex-1 overflow-hidden">
				{isLoading ? (
					<div className="p-6 space-y-4">
						{(["s0", "s1", "s2", "s3"] as const).map((sk) => (
							<div key={sk} className="h-8 animate-pulse bg-surface-2" />
						))}
					</div>
				) : (
					<div ref={widgetContainerRef} className="h-full" />
				)}
			</div>
		</div>
	)
}
