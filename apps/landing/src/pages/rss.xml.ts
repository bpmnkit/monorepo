import { getCollection } from "astro:content"
import rss from "@astrojs/rss"
import type { APIRoute } from "astro"

export const GET: APIRoute = async (context) => {
	const posts = await getCollection("blog")
	return rss({
		title: "BPMN Kit Blog",
		description:
			"Guides on generating, simulating, and deploying BPMN 2.0 diagrams with TypeScript.",
		site: context.site ?? "https://bpmnkit.com",
		items: posts
			.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
			.map((post) => ({
				title: post.data.title,
				description: post.data.description,
				pubDate: post.data.pubDate,
				link: `/blog/${post.id}/`,
			})),
	})
}
