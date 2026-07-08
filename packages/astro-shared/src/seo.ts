import { SITE } from "./site.js"

/** schema.org Organization — brand identity, safe to include on every page. */
export function organizationJsonLd() {
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: SITE.name,
		url: SITE.url,
		logo: `${SITE.url}/favicon.svg`,
		sameAs: [SITE.github, SITE.npm],
	}
}

/** schema.org SoftwareApplication — for package/product pages (landing, package docs). */
export function softwareApplicationJsonLd(input: {
	name: string
	description: string
	url: string
	applicationCategory?: string
}) {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: input.name,
		description: input.description,
		url: input.url,
		applicationCategory: input.applicationCategory ?? "DeveloperApplication",
		operatingSystem: "Cross-platform",
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
	}
}

/** schema.org Article — for blog posts. */
export function articleJsonLd(input: {
	title: string
	description: string
	url: string
	datePublished: string
	dateModified?: string
	authorName: string
	image?: string
}) {
	return {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: input.title,
		description: input.description,
		url: input.url,
		datePublished: input.datePublished,
		dateModified: input.dateModified ?? input.datePublished,
		author: { "@type": "Person", name: input.authorName },
		publisher: {
			"@type": "Organization",
			name: SITE.name,
			logo: { "@type": "ImageObject", url: `${SITE.url}/favicon.svg` },
		},
		...(input.image ? { image: input.image } : {}),
	}
}

/** schema.org BreadcrumbList — for docs/learn/blog nested pages. */
export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: item.url,
		})),
	}
}

/** schema.org FAQPage — for glossary/comparison pages with Q&A content. */
export function faqJsonLd(items: Array<{ question: string; answer: string }>) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: { "@type": "Answer", text: item.answer },
		})),
	}
}
