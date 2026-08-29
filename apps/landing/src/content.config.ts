import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const blog = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		author: z.string().default("BPMN Kit"),
		tags: z.array(z.string()).default([]),
	}),
})

const docs = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		/** Position inside its section. Pages without one sort last, alphabetically. */
		sidebar: z.object({ order: z.number().optional(), label: z.string().optional() }).optional(),
	}),
})

export const collections = { blog, docs }
