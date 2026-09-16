# Update agent instance

`PATCH /agent-instances/{agentInstanceKey}`

Updates the mutable fields of an agent instance (status, metric counters, and
tools) and appends a batch of history items to its conversation history. Metric
values are treated as deltas and applied immediately to the aggregate counters.
Tool updates replace the existing tool list. Each history item created for this
request is echoed back in the response.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  agentInstanceKey (path, string, required)

Request body:
  application/json: AgentInstanceUpdateRequest (required)
    elementInstanceKey (ElementInstanceKey, required) — The key of the currently-active element instance for this agent instance. Used for ownership/equality validation against the stored agent instance and, when…
    status (AgentInstanceUpdateStatusEnum) — The new status of the agent instance.
    metrics (AgentInstanceMetricsDelta) — Metric increments to apply to the aggregate counters.
    tools (AgentTool[]) — The complete list of tools available to the agent, replacing any previously stored tools. When provided, the engine replaces the existing tool list with this…
    jobKey (JobKey) — The key of the job activation during which this update is being made. Required whenever history is provided.
    jobLease (string) — Opaque lease token received from the job activation response. Disambiguates this activation from any other activation of the same job: if the job is later…
    history (AgentInstanceHistoryItem[]) — A batch of history items to append to the agent instance's conversation history, in request order. Each created item is echoed back in the response's…

Responses:
  200 AgentInstanceUpdateResult — The agent instance was updated successfully.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The agent instance with the given key was not found. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/update-agent-instance.api
