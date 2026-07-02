process LoanApproval "Loan Approval Process"
start start "Application Received"
service fetchCreditScore "Fetch Credit Score" job=io.camunda:http-json:1 h.resultVariable=creditBureauResponse h.resultExpression="=creditBureauResponse.body"
xgw preScreen "Credit Score >= 580?"
service sendRejectionLetter "Send Rejection Letter" job=email-sender h.template=loan-rejected-credit
end endRejectedAutomatic "Rejected - Credit Score"
rule riskScoring "Calculate Risk Score" decision=loan-risk-scoring result=riskAssessment
xgw riskGateway "Risk Tier?"
script calculateRate "Calculate Interest Rate" result=interestRate
service generateOffer "Generate Loan Offer" job=offer-generator result=loanOfferId
user underwriterReview "Underwriter Review" form=underwriter-review-form
service sendHighRiskRejection "Send Rejection Letter" job=email-sender h.template=loan-rejected-risk
end endRejectedRisk "Rejected - High Risk"
xgw underwriterDecision "Underwriter Approved?"
service sendManualRejection "Send Rejection Letter" job=email-sender h.template=loan-rejected-underwriter
end endRejectedManual "Rejected - Underwriter"
service notifyApplicant "Send Offer to Applicant" job=email-sender h.template=loan-offer
end endApproved "Loan Approved"
start -> fetchCreditScore
fetchCreditScore -> preScreen
preScreen -> sendRejectionLetter "rejected-prescreening" if="=creditBureauResponse.score < 580"
sendRejectionLetter -> endRejectedAutomatic
preScreen -> riskScoring "passed-prescreening" if="=creditBureauResponse.score >= 580"
riskScoring -> riskGateway
riskGateway -> calculateRate "low-risk" if="=riskAssessment.tier = \"low\""
calculateRate -> generateOffer
generateOffer -> notifyApplicant
riskGateway -> underwriterReview "medium-risk" if="=riskAssessment.tier = \"medium\""
underwriterReview -> underwriterDecision
riskGateway -> sendHighRiskRejection "high-risk"
sendHighRiskRejection -> endRejectedRisk
underwriterDecision -> notifyApplicant "uw-approved" if="=underwriterApproved = true"
underwriterDecision -> sendManualRejection "uw-rejected"
sendManualRejection -> endRejectedManual
notifyApplicant -> endApproved
