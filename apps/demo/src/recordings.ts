import type { Recording } from "../shared/recording-types.js"

const modules = import.meta.glob<Recording>("../recordings/*.json", {
	eager: true,
	import: "default",
})

export const recordings: Recording[] = Object.values(modules)
