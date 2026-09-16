# Create agent instance history item

`POST /agent-instances/{agentInstanceKey}/history`

Appends a single history item to an agent instance's conversation history.
The created item has commitStatus PENDING until the job identified by jobLease
completes successfully, at which point it transitions to COMMITTED. If the job
fails or is superseded by a retry, the item is marked DISCARDED.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  agentInstanceKey (path, string, required)

Request body:
  application/json: AgentInstanceHistoryItemRequest (required)
    elementInstanceKey (ElementInstanceKey, required) — The key of the currently-active element instance.
    jobKey (JobKey, required) — The key of the current job activation during which this history item was produced.
    jobLease (string, required) — Opaque lease token received from the job activation response.
    loopIteration (LoopIterationId) — The loop iteration this item belongs to. Omit if not grouping items by loopIteration.
    role (AgentInstanceHistoryRoleEnum, required) — The role of this history item in the conversation.
    content (AgentInstanceMessageContent[], required) — The content blocks of this history item.
    toolCalls (AgentInstanceToolCall[]) — Tool calls associated with this history item. For ASSISTANT items: tool calls dispatched by this LLM response. For TOOL_RESULT items: single-entry array…
    metrics (AgentInstanceHistoryItemMetrics) — Per-call token and latency metrics. Present on ASSISTANT items only.
    producedAt (string, required) — The agent-side timestamp of when this message was produced.

Responses:
  201 AgentInstanceHistoryItemCreationResult — The history item was created.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The agent instance with the given key was not found, or the specified jobKey does not correspond to an active job. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-agent-instance-history-item.api
