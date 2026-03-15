/**
 * Example 05 — Content Publishing Pipeline
 *
 * Demonstrates:
 * - Event-based gateway waiting for either approval or timeout
 * - Intermediate message catch and timer catch events
 * - Parallel review tracks (legal + editorial)
 * - REST connector for publishing to CMS
 * - Multiple terminal outcomes
 */

import { writeFileSync } from "node:fs"
import { Bpmn } from "@bpmnkit/core"

const definitions = Bpmn.createProcess("ContentPublishing")
	.withAutoLayout()
	.name("Content Publishing Pipeline")
	.versionTag("1.0.0")

	.startEvent("start", { name: "Content Submitted" })

	// Automated quality checks (spelling, SEO score, plagiarism)
	.serviceTask("qualityCheck", {
		name: "Run Quality Checks",
		taskType: "content-quality-checker",
		ioMapping: {
			inputs: [{ source: "=content.body", target: "text" }],
			outputs: [
				{ source: "=seoScore", target: "seoScore" },
				{ source: "=plagiarismFree", target: "plagiarismFree" },
			],
		},
	})

	.exclusiveGateway("qualityGateway", { name: "Quality OK?" })

	.branch("quality-failed", (b) =>
		b
			.condition("=seoScore < 60 or plagiarismFree = false")
			.serviceTask("notifyAuthorQuality", {
				name: "Notify Author — Quality Issues",
				taskType: "email-sender",
				taskHeaders: { template: "content-quality-fail" },
			})
			.endEvent("endQualityFailed", { name: "Returned to Author" }),
	)

	.branch("quality-passed", (b) =>
		b.condition("=seoScore >= 60 and plagiarismFree = true").connectTo("forkReview"),
	)

	// Run legal and editorial review in parallel
	.parallelGateway("forkReview", { name: "Start Reviews" })

	.branch("legal-review", (b) =>
		b
			.userTask("legalReview", {
				name: "Legal Review",
				formId: "legal-review-form",
			})
			.connectTo("joinReview"),
	)

	.branch("editorial-review", (b) =>
		b
			.userTask("editorialReview", {
				name: "Editorial Review",
				formId: "editorial-review-form",
			})
			.connectTo("joinReview"),
	)

	.parallelGateway("joinReview", { name: "All Reviews Done" })

	// Check review outcomes
	.exclusiveGateway("reviewOutcome", { name: "Reviews Passed?" })

	.branch("review-rejected", (b) =>
		b
			.condition("=legalApproved = false or editorialApproved = false")
			.serviceTask("notifyAuthorRevision", {
				name: "Notify Author — Revisions Required",
				taskType: "email-sender",
				taskHeaders: { template: "content-revision-required" },
				ioMapping: {
					inputs: [
						{ source: "=content.authorEmail", target: "to" },
						{ source: "=legalFeedback", target: "legalNotes" },
						{ source: "=editorialFeedback", target: "editorialNotes" },
					],
				},
			})
			.endEvent("endRevisionRequired", { name: "Revision Required" }),
	)

	.branch("review-passed", (b) =>
		b
			.condition("=legalApproved = true and editorialApproved = true")
			.connectTo("awaitPublishDecision"),
	)

	// Event-based gateway: wait for either an explicit publish command or a scheduled timer
	.eventBasedGateway("awaitPublishDecision", {
		name: "Await Publish Decision",
	})

	.branch("publish-now", (b) =>
		b
			.intermediateCatchEvent("publishCommand", {
				name: "Publish Command Received",
				messageName: "publish-approved",
			})
			.connectTo("publishContent"),
	)

	.branch("scheduled-publish", (b) =>
		b
			.intermediateCatchEvent("publishTimer", {
				name: "Scheduled Publish Time",
				timerDate: "=content.scheduledPublishAt",
			})
			.connectTo("publishContent"),
	)

	// Publish to CMS via REST connector
	.restConnector("publishContent", {
		name: "Publish to CMS",
		method: "POST",
		url: '=cmsBaseUrl + "/api/content/publish"',
		authentication: { type: "bearer", token: "=secrets.CMS_API_TOKEN" },
		body: "={slug: content.slug, body: content.body, tags: content.tags}",
		resultVariable: "cmsResponse",
		resultExpression: "=cmsResponse.body",
	})

	// Notify author and update analytics
	.parallelGateway("forkPostPublish", { name: "Post-Publish Actions" })

	.branch("notify-author", (b) =>
		b
			.serviceTask("notifyAuthorPublished", {
				name: "Notify Author",
				taskType: "email-sender",
				taskHeaders: { template: "content-published" },
				ioMapping: {
					inputs: [
						{ source: "=content.authorEmail", target: "to" },
						{ source: "=cmsResponse.url", target: "publishedUrl" },
					],
				},
			})
			.connectTo("joinPostPublish"),
	)

	.branch("track-analytics", (b) =>
		b
			.serviceTask("trackEvent", {
				name: "Track Publish Event",
				taskType: "analytics-tracker",
				ioMapping: {
					inputs: [
						{ source: '"content_published"', target: "event" },
						{ source: "=content.id", target: "contentId" },
						{ source: "=cmsResponse.url", target: "url" },
					],
				},
			})
			.connectTo("joinPostPublish"),
	)

	.parallelGateway("joinPostPublish", { name: "Done" })

	.endEvent("end", { name: "Content Published" })
	.build()

const xml = Bpmn.export(definitions)
writeFileSync("output/05-content-publishing.bpmn", xml)
console.log("✓ 05-content-publishing.bpmn")
