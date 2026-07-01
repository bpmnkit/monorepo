export interface Scenario {
	id: string
	label: string
	prompt: string
}

export const DEFAULT_SCENARIO_ID = "loan-approval"

const LOAN_APPROVAL_PROMPT = `Generate a Loan Approval BPMN process for Camunda 8. It should include:
- Credit score check via REST connector
- Exclusive gateway for pre-screening (reject below 580)
- DMN business rule task for risk scoring
- User task for manual underwriter review
- Separate end events for approved and rejected outcomes

Output code only. No explanation. No markdown prose outside the code block.`

const QUOTE_TO_CASH_PROMPT = `Generate a Quote-to-Cash BPMN process for Camunda 8. It should include:
- Quote/offer generation from a product catalog with tiered pricing
- Exclusive gateway for discount approval: manager approval above one threshold,
  escalating to VP approval above a higher threshold
- Contract generation and e-signature via a REST connector to an external
  e-signature service
- Exclusive gateway routing standard orders directly to provisioning, or complex
  bundled orders through a dedicated multi-line provisioning subprocess
- Multi-instance subprocess provisioning each ordered line item in parallel
- Invoice generation triggered once provisioning completes
- Payment processing via a REST connector to a payment gateway
- Event-based gateway for payment outcome: paid immediately, or move to a
  dunning subprocess
- Dunning/cash-collection subprocess with escalating reminder cycles (timer
  boundary events on each reminder) before escalating to a collections agency
- Separate end events for: contract rejected, payment received, and written
  off after collections failure

Output code only. No explanation. No markdown prose outside the code block.`

const KYC_PROMPT = `Generate a KYC (Know Your Customer) onboarding BPMN process for Camunda 8. It
should include:
- Identity document upload and verification via a REST connector to an OCR
  service
- Exclusive gateway on document quality: reject and loop back to re-upload
  (up to 2 retries) if verification fails
- Sanctions and PEP (politically exposed person) screening via a REST
  connector
- Risk-based gateway routing to standard due diligence or enhanced due
  diligence based on the screening result
- User task for enhanced due diligence manual review by a compliance officer
- DMN business rule task for final risk classification
- Separate end events for approved, rejected, and escalated-to-compliance
  outcomes

Output code only. No explanation. No markdown prose outside the code block.`

export const SCENARIOS: Scenario[] = [
	{ id: "loan-approval", label: "Loan Approval", prompt: LOAN_APPROVAL_PROMPT },
	{ id: "quote-to-cash", label: "Quote-to-Cash", prompt: QUOTE_TO_CASH_PROMPT },
	{ id: "kyc", label: "KYC", prompt: KYC_PROMPT },
]

export function getScenario(id: string): Scenario | undefined {
	return SCENARIOS.find((s) => s.id === id)
}
