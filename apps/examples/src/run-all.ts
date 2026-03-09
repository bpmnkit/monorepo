/**
 * Run all examples and write BPMN files to output/
 */

import { mkdirSync } from "node:fs"

mkdirSync("output", { recursive: true })

await import("./01-employee-onboarding.js")
await import("./02-incident-response.js")
await import("./03-loan-approval.js")
await import("./04-invoice-processing.js")
await import("./05-content-publishing.js")
await import("./06-ai-code-review-agent.js")

console.log("\nAll examples written to output/")
