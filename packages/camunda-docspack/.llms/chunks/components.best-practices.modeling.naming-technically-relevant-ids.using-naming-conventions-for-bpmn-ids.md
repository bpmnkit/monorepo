# Naming technically relevant IDs — Using naming conventions for BPMN IDs

Define developer-friendly and business-relevant IDs for the process itself, as well as all activities, messages, and errors. Also consider events, gateways, and the sequence flows that carry conditional expressions. Even though IDs are just identifiers, keep in mind that they will show up regularly on the technical level. Meaningful IDs will help a lot.

One case where an ID is more than an identifier is an element inside an [ad-hoc sub-process](https://docs.camunda.io/docs/next/reference/glossary#ad-hoc-sub-process) that an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) uses as a tool. There, the ID is the tool name passed to the model, and it directly affects which tool the model selects, so describe what the tool does rather than applying the type prefixes below. See [write a tool name and description](https://docs.camunda.io/docs/next/components/agentic-orchestration/add-tool-to-ai-agent#write-a-tool-name-and-description) for more details.

Examine the IDs shown in the following example:

Diagram (BPMN): Tweet Approval
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [No: =not(approved)] service task "Send rejection notification" → end "Tweet rejected"
    — [Yes: =approved] service task "Publish on Twitter" → end "Tweet published"

The following table provides you with a guideline that we would use in a context where developers are comfortable with _Java_ and _PascalCase_ naming style. You may adapt these suggestions to typical naming conventions used in your programming context.

|       |                   | XML Attribute        | Prefix or Suffix | Resulting ID                  |
| ----- | ----------------- | -------------------- | ---------------- | ----------------------------- |
| **1** | Tweet Approval    | process/@id          | Process          | TweetApprovalProcess          |
| **2** | New tweet written | startEvent/@id       | StartEvent\_     | StartEvent_NewTweetWritten    |
|       |                   | message/@id          | Message\_        | Message_NewTweetWritten       |
|       |                   | message/@name        | Msg\_            | Msg_NewTweetWritten           |
| **3** | Review tweet      | userTask/@id         | Task\_           | Task_ReviewTweet              |
| **4** | Tweet approved?   | exclusiveGateway/@id | Gateway\_        | Gateway_TweetApproved         |
| **5** | No                | sequenceFlow/@id     | SequenceFlow\_   | SequenceFlow_TweetApprovedNo  |
| **6** | Tweet duplicated  | boundaryEvent/@id    | BoundaryEvent\_  | BoundaryEvent_TweetDuplicated |
|       |                   | error/@id            | Error\_          | Error_TweetDuplicated         |
|       |                   | error/@errorCode     | Err\_            | Err_TweetDuplicated           |
| **7** | Tweet published   | EndEvent\_/@id       | EndEvent\_       | EndEvent_TweetPublished       |

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-technically-relevant-ids
