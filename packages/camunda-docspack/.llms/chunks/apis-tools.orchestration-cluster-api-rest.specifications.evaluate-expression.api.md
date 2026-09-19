# Evaluate an expression

`POST /expression/evaluation`

Evaluates a FEEL expression and returns the result. Supports references to tenant scoped
cluster variables when a tenant ID is provided. Optionally, provide a `scopeKey` to make the
variables of a specific process instance or element instance visible while evaluating the
expression.

When the expression references a secret (`camunda.secrets.<name>`), the endpoint never
returns the resolved secret value. Instead, each reference resolves to its own literal
placeholder text `camunda.secrets.<name>`, which composes like any other string. This
changed in 8.10; previously such references evaluated to `null` and logged a warning:

- `=camunda.secrets.TEST` now returns `"camunda.secrets.TEST"`.
- `="Bearer " + camunda.secrets.TEST` now returns `"Bearer camunda.secrets.TEST"`.

This placeholder mechanism is bypassed if the request-body `variables` include a variable
literally named `camunda`. In that case the request-body variable takes precedence, so
`camunda.secrets.<name>` resolves against it instead of producing a placeholder (typically
evaluating to `null`).

Every secret reference the evaluation encountered from a trusted source is listed in the
`referencedSecrets` array of the response. That array reports every `camunda.secrets.<name>`
name that was referenced, whether or not a matching secret is configured: a misspelled or
unconfigured name is still listed here and only surfaces as an error later, in the `errors`
array of the follow-up `POST /v2/secrets/resolve` call. To obtain the actual secret values,
resolve those references yourself with that endpoint
([`POST /v2/secrets/resolve`](/apis-tools/orchestration-cluster-api-rest/specifications/resolve-secrets.api.mdx)).

For background on how the cluster resolves secret references in other contexts, such as
during job activation, see
[Secret resolution and job activation](/components/concepts/secret-resolution-and-job-activation.md).
That page describes a different mechanism than this endpoint uses.

- Added in Camunda 8.9.
- Required permissions: EVALUATE on EXPRESSION.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ExpressionEvaluationRequest (required)
    expression (string, required) — The expression to evaluate (e.g., "=x + y")
    tenantId (string) — Required when the expression references tenant-scoped cluster variables
    scopeKey (ScopeKey) — Key of the process instance or element instance whose variables should be made visible to the expression. Use a process instance key to evaluate against the…
    variables (object) — Optional variables for expression evaluation. These variables are only used for the current evaluation and do not persist beyond it.

Responses:
  200 ExpressionEvaluationResult — Expression evaluated successfully
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/evaluate-expression.api
