/**
 * The five Markdown files the AI examples index.
 *
 * They stand in for what a team already has when it wants a BPMN diagram: a
 * folder of prose that describes a flow, written for people, never written for
 * retrieval. Nothing here is BPMN, and nothing here mentions BPMN Kit.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const DOCS: Record<string, string> = {
	"01-intake.md": `---
title: Order intake
---

## Receiving an order

An order arrives on the \`orders.received\` queue carrying a \`customerId\`, a
\`total\` in EUR and a list of \`lines\`. Intake writes it to the order book
before anything else runs, so a crash mid-flow never loses the order itself.

## Screening the customer

Every order is screened against the blocklist. A blocked customer is rejected
straight away with reason \`CUSTOMER_BLOCKED\` and no further step runs.
`,

	"02-approval.md": `---
title: Approval
---

## When approval is needed

An order over 10000 EUR needs a regional manager to approve it before anything
is picked. At or under that figure the order goes straight to fulfilment.

## How a manager decides

The manager sees the customer's payment history and the margin on the order.
They either approve it or reject it with a reason, which is written back to the
order book. A rejection ends the flow.
`,

	"03-fulfilment.md": `---
title: Fulfilment
---

## Picking and packing

The warehouse picks the lines, then packs them. Packing cannot start before
picking finishes.

## Raising the invoice

Finance raises the invoice at the same time as the warehouse works. The two run
in parallel and the order is not shipped until both have finished.
`,

	"04-shipping.md": `---
title: Shipping
---

## Booking a carrier

Once the order is packed and invoiced, a carrier is booked. The booking call is
an HTTP request to the carrier's API.

## When the carrier will not take it

If the carrier refuses the booking the order escalates to a human dispatcher,
who books it by hand. The flow ends either way with the order shipped.
`,

	"05-notifications.md": `---
title: Notifications
---

## Telling the customer

The customer is emailed once the carrier is booked, with the tracking number.

## Telling the warehouse

Nothing is sent to the warehouse: they read the pick list from the order book
and there is no notification step for them in this flow.
`,
}

/** Write the corpus to `dir`, creating it if needed. Returns the file count. */
export function writeFlowDocs(dir: string): number {
	mkdirSync(dir, { recursive: true })
	for (const [name, markdown] of Object.entries(DOCS)) {
		writeFileSync(join(dir, name), markdown)
	}
	return Object.keys(DOCS).length
}
