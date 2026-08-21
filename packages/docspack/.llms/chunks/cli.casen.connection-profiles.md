# casen CLI — Connection Profiles

A profile stores the connection details for a Camunda cluster:

```sh
# Add a new profile
casen profile add

# You'll be prompted for:
# Name: my-saas-cluster
# Base URL: https://api.cloud.camunda.io
# Auth type: oauth2 | bearer | none
# Client ID, Client Secret, Audience, Token URL (for oauth2)
```

Profiles are saved to `~/.casen/profiles.json`.


## Common Workflows

### List process definitions

```
Navigate to: process → list → Enter

Result:
  bpmnProcessId                name                    ver
  ──────────────────────────────────────────────────────────
▶ invoice-approval              Invoice Approval          2
  order-fulfillment             Order Fulfillment         1
  customer-onboarding           Customer Onboarding       3
```

### Start a process instance

```
Navigate to: process → start → Enter

Select process: invoice-approval
Variables (JSON): {"invoiceId": "inv-001", "amount": 5000}
```

### Resolve an incident

```
Navigate to: incident → list → Enter
```

Select the incident with Enter, choose "Resolve" from the action menu.

### Publish a message

```
Navigate to: message → publish → Enter

Message name: payment-confirmed
Correlation key: ord-456
Variables (JSON): {"method": "card"}
```

---
Source: https://docs.bpmnkit.com/cli/casen/
