import { Bpmn, Form } from "@bpmnkit/core"
import type { ProcessTemplate } from "./types.js"

export const fourEyesReview: ProcessTemplate = {
	id: "four-eyes-review",
	title: "Four-Eyes Change Review",
	description:
		"A maker–checker loop for changes that need a second person: a maker prepares the change, a checker from a different group approves or sends it back, and a counter kept by a FEEL script stops the ping-pong after three rounds by escalating to the change board. Only an approved change is applied.",
	category: "human-in-the-loop",
	tags: ["maker-checker", "loop", "script task", "user task", "compliance"],
	build: () =>
		Bpmn.createProcess("four-eyes-review")
			.name("Four-Eyes Change Review")
			.versionTag("1.0.0")
			.startEvent("change-requested", { name: "Change requested" })
			.scriptTask("start-count", {
				name: "Start revision count",
				expression: "=0",
				resultVariable: "revisions",
			})
			.exclusiveGateway("prepare-merge")
			.userTask("prepare-change", {
				name: "Prepare change",
				zeebeUserTask: true,
				candidateGroups: "makers",
			})
			.userTask("check-change", {
				name: "Check change",
				zeebeUserTask: true,
				candidateGroups: "checkers",
			})
			.exclusiveGateway("approved", { name: "Approved?" })
			.branch("yes", (b) =>
				b
					.condition("=checkApproved")
					.serviceTask("apply-change", {
						name: "Apply change",
						taskType: "change-apply",
						ioMapping: { outputs: [{ source: "=changeRef", target: "changeRef" }] },
					})
					.endEvent("change-applied", { name: "Change applied" }),
			)
			.branch("no", (b) =>
				b
					.defaultFlow()
					.scriptTask("count-revision", {
						name: "Count revision",
						expression: "=revisions + 1",
						resultVariable: "revisions",
					})
					.exclusiveGateway("limit-reached", { name: "Three rounds?" })
					.branch("escalate", (e) =>
						e
							.condition("=revisions >= 3")
							.userTask("change-board", {
								name: "Decide at change board",
								zeebeUserTask: true,
								candidateGroups: "change-board",
							})
							.endEvent("escalated", { name: "Escalated" }),
					)
					.branch("revise", (r) => r.defaultFlow().connectTo("prepare-merge")),
			)
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "approved-first-time",
			name: "The checker approves the first version",
			inputs: { changeId: "CHG-1" },
			mocks: {
				userTask: { outputs: { checkApproved: true } },
				"change-apply": { outputs: { changeRef: "APPLIED-1" } },
			},
			expect: {
				path: ["prepare-change", "check-change", "apply-change", "change-applied"],
				variables: { revisions: 0, changeRef: "APPLIED-1" },
			},
		},
		{
			id: "three-rejections",
			name: "Three rejections escalate to the change board",
			inputs: { changeId: "CHG-2" },
			mocks: { userTask: { outputs: { checkApproved: false } } },
			expect: {
				path: [
					"check-change",
					"count-revision",
					"prepare-change",
					"check-change",
					"count-revision",
					"prepare-change",
					"check-change",
					"count-revision",
					"change-board",
					"escalated",
				],
				variables: { revisions: 3 },
			},
		},
	],
}

export const contentReview: ProcessTemplate = {
	id: "content-review",
	title: "Editorial Content Review",
	description:
		"Runs automated checks on a draft, then puts it in front of an editor with a Camunda form that records the verdict — publish, revise or reject — and a comment. The verdict routes the draft to the CMS, back to its author with the comment, or to the archive.",
	category: "human-in-the-loop",
	tags: ["camunda form", "user task", "exclusive gateway", "publishing"],
	build: () =>
		Bpmn.createProcess("content-review")
			.name("Editorial Content Review")
			.versionTag("1.0.0")
			.startEvent("draft-submitted", { name: "Draft submitted" })
			.serviceTask("automated-checks", {
				name: "Run automated checks",
				taskType: "content-lint",
				ioMapping: {
					outputs: [
						{ source: "=issues", target: "lintIssues" },
						{ source: "=readingTime", target: "readingTime" },
					],
				},
			})
			.userTask("editorial-review", {
				name: "Editorial review",
				zeebeUserTask: true,
				formId: "editorial-review",
				candidateGroups: "editors",
			})
			.exclusiveGateway("verdict", { name: "Verdict?" })
			.branch("publish", (b) =>
				b
					.condition('=decision = "publish"')
					.serviceTask("publish", {
						name: "Publish to CMS",
						taskType: "cms-publish",
						ioMapping: { outputs: [{ source: "=url", target: "publishedUrl" }] },
					})
					.endEvent("published", { name: "Published" }),
			)
			.branch("revise", (b) =>
				b
					.condition('=decision = "revise"')
					.serviceTask("return-to-author", {
						name: "Return to author",
						taskType: "author-notify",
						ioMapping: { inputs: [{ source: "=editorComment", target: "message" }] },
					})
					.endEvent("returned", { name: "Returned for revision" }),
			)
			.branch("reject", (b) =>
				b
					.defaultFlow()
					.serviceTask("archive-draft", { name: "Archive draft", taskType: "cms-archive" })
					.endEvent("rejected", { name: "Rejected" }),
			)
			.withAutoLayout()
			.build(),
	forms: () => [
		Form.create("editorial-review")
			.text("Read the draft and its automated check results, then record your verdict.")
			.radio(
				"Verdict",
				"decision",
				[
					{ label: "Publish", value: "publish" },
					{ label: "Revise", value: "revise" },
					{ label: "Reject", value: "reject" },
				],
				{ validate: { required: true } },
			)
			.textarea("Comment for the author", "editorComment")
			.build(),
	],
	scenarios: [
		{
			id: "published",
			name: "The editor publishes the draft",
			inputs: { draftId: "D-1", title: "Release notes 4.2" },
			mocks: {
				"content-lint": { outputs: { issues: 0, readingTime: 4 } },
				userTask: { outputs: { decision: "publish", editorComment: "" } },
				"cms-publish": { outputs: { url: "https://example.com/blog/release-4-2" } },
			},
			expect: {
				path: ["automated-checks", "editorial-review", "publish", "published"],
				variables: { publishedUrl: "https://example.com/blog/release-4-2" },
			},
		},
		{
			id: "revise",
			name: "The editor asks for a revision",
			inputs: { draftId: "D-2", title: "Untitled" },
			mocks: {
				"content-lint": { outputs: { issues: 3, readingTime: 9 } },
				userTask: { outputs: { decision: "revise", editorComment: "Needs a title." } },
				"author-notify": {},
			},
			expect: { path: ["editorial-review", "return-to-author", "returned"] },
		},
	],
}
